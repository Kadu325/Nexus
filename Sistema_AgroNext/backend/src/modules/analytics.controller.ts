import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../common/prisma.service';
import { Auth, AuthCtx } from '../common/auth-context';
import { computeBusinessCase } from '../domain/business-case';
import { addDays, isoDate, toDateOnly, weekStart } from '../domain/dates';
import { centsToNumber, toCents } from '../domain/money';
import { riskBand, riskExposure } from '../domain/risk';
import { EvmService } from './evm.service';

/** Catálogo de indicadores (sistema.md, B28): todo número exibido tem definição verificável. */
export const METRICS = [
  { key: 'PV', name: 'Valor Planejado', purpose: 'Trabalho planejado até a data de corte', formula: 'Σ orçamento da linha de base × fração de dias úteis planejados decorridos', unit: 'moeda', source: 'Linha de base', periodicity: 'Sob demanda (data de corte)', missing: 'Indisponível sem linha de base' },
  { key: 'EV', name: 'Valor Agregado', purpose: 'Trabalho realizado em termos de orçamento', formula: 'Σ orçamento da linha de base × % físico', unit: 'moeda', source: 'Linha de base + histórico de avanço', periodicity: 'Sob demanda', missing: 'Indisponível sem linha de base' },
  { key: 'AC', name: 'Custo Real', purpose: 'Custo incorrido', formula: 'Σ despesas realizadas por competência até o corte', unit: 'moeda', source: 'Lançamentos financeiros', periodicity: 'Sob demanda', missing: 'Zero quando não há despesas realizadas' },
  { key: 'CPI', name: 'Índice de Desempenho de Custo', purpose: 'Eficiência de custo', formula: 'EV / AC', unit: 'índice', source: 'EVM', periodicity: 'Sob demanda', missing: 'Indisponível com AC = 0 ou sem linha de base' },
  { key: 'SPI', name: 'Índice de Desempenho de Prazo', purpose: 'Eficiência de prazo', formula: 'EV / PV', unit: 'índice', source: 'EVM', periodicity: 'Sob demanda', missing: 'Indisponível com PV = 0 ou sem linha de base' },
  { key: 'EAC', name: 'Estimativa no Término', purpose: 'Custo projetado', formula: 'BAC / CPI', unit: 'moeda', source: 'EVM', periodicity: 'Sob demanda', missing: 'Indisponível sem CPI' },
  { key: 'ROI', name: 'Retorno sobre Investimento', purpose: 'Atratividade do projeto', formula: '(Benefícios − Custos) / Custos, sem desconto', unit: '%', source: 'Business Case', periodicity: 'Na aprovação do Business Case', missing: 'Indisponível com custos = 0' },
  { key: 'TCO', name: 'Custo Total de Propriedade', purpose: 'Custo no horizonte', formula: 'Σ custos do Business Case', unit: 'moeda', source: 'Business Case', periodicity: 'Na aprovação', missing: 'Zero sem custos' },
  { key: 'PAYBACK', name: 'Payback', purpose: 'Tempo de retorno', formula: 'Primeiro mês com fluxo acumulado ≥ 0', unit: 'meses', source: 'Business Case', periodicity: 'Na aprovação', missing: '"Não atingido" no horizonte' },
  { key: 'EXPOSICAO', name: 'Exposição ao risco', purpose: 'Priorizar riscos', formula: 'Probabilidade (1–5) × Impacto (1–5)', unit: 'pontos (1–25)', source: 'Registro de riscos', periodicity: 'Contínua', missing: '—' },
  { key: 'UTILIZACAO', name: 'Utilização de recurso', purpose: 'Carga × capacidade', formula: 'max(alocado, apontado aprovado) / capacidade semanal', unit: '%', source: 'Alocações, timesheet, recursos', periodicity: 'Semanal', missing: 'Indisponível sem capacidade cadastrada' },
  { key: 'CONFORMIDADE', name: 'Conformidade de controles', purpose: 'Situação dos controles avaliados', formula: 'Conformes / avaliados', unit: '%', source: 'Avaliações de controle', periodicity: 'Conforme periodicidade do controle', missing: 'Indisponível sem avaliações' },
  { key: 'LEAD_TIME', name: 'Lead time', purpose: 'Tempo da criação à conclusão', formula: 'Média de (concluída em − criada em) nas últimas 12 semanas', unit: 'dias corridos', source: 'Tarefas', periodicity: 'Semanal', missing: 'Indisponível sem tarefas concluídas' },
  { key: 'THROUGHPUT', name: 'Throughput', purpose: 'Vazão de entrega', formula: 'Tarefas concluídas por semana', unit: 'tarefas/semana', source: 'Tarefas', periodicity: 'Semanal', missing: 'Zero sem conclusões' },
  { key: 'CYCLE_TIME', name: 'Cycle time', purpose: 'Tempo em execução', formula: 'Concluída em − primeira entrada em andamento', unit: 'dias', source: 'Histórico de status', periodicity: 'Semanal', missing: 'Pendente: histórico estruturado de status ainda não registrado (etapa 2)' },
];

@ApiTags('Analytics Avançado')
@Controller('analytics')
export class AnalyticsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly evm: EvmService,
  ) {}

  @Get('metrics')
  metrics() {
    return METRICS;
  }

  @Get('executive')
  async executive(@Auth() auth: AuthCtx) {
    const orgId = auth.orgId;
    const year = new Date().getUTCFullYear();
    const [projects, risks, cases, capex] = await Promise.all([
      this.prisma.project.findMany({ where: { orgId }, select: { id: true, code: true, name: true, status: true, type: true, isDemo: true } }),
      this.prisma.risk.findMany({ where: { orgId, status: { in: ['ABERTO', 'MITIGANDO'] } } }),
      this.prisma.businessCase.findMany({ where: { orgId }, include: { lines: true } }),
      this.prisma.financialEntry.groupBy({
        by: ['expenseType', 'status'],
        where: { orgId, nature: 'DESPESA', competenceDate: { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) } },
        _sum: { amount: true },
      }),
    ]);
    const byStatus: Record<string, number> = {};
    for (const p of projects) byStatus[p.status] = (byStatus[p.status] ?? 0) + 1;
    const pname = new Map(projects.map((p) => [p.id, `${p.code} — ${p.name}`]));
    const investments = { year, capexRealizado: 0, capexPrevisto: 0, opexRealizado: 0, opexPrevisto: 0, semClassificacao: 0 };
    for (const g of capex) {
      const v = centsToNumber(toCents(g._sum.amount ?? 0));
      if (!g.expenseType) investments.semClassificacao += v;
      else (investments as any)[`${g.expenseType.toLowerCase()}${g.status === 'REALIZADO' ? 'Realizado' : 'Previsto'}`] += v;
    }
    const roi = cases.map((c) => {
      const r = computeBusinessCase(c.lines.map((l) => ({ period: l.period, kind: l.kind, amountCents: toCents(l.amount) })));
      return { projectId: c.projectId, project: pname.get(c.projectId) ?? '—', status: c.status, roi: r.roi.value, roiReason: r.roi.reason, paybackMonths: r.payback.period, tco: centsToNumber(r.tcoCents) };
    });
    const riskMatrix = Array.from({ length: 5 }, (_, i) => Array.from({ length: 5 }, (_, j) => risks.filter((r) => r.probability === 5 - i && r.impact === j + 1).length));
    return {
      projects: { total: projects.length, byStatus, demo: projects.filter((p) => p.isDemo).length },
      investments,
      roi,
      risks: {
        active: risks.length,
        matrix: { rows: 'probabilidade 5→1', cols: 'impacto 1→5', cells: riskMatrix },
        top: risks
          .map((r) => ({ id: r.id, title: r.title, project: pname.get(r.projectId) ?? '—', exposure: riskExposure(r.probability, r.impact) }))
          .sort((a, b) => b.exposure - a.exposure)
          .slice(0, 8)
          .map((r) => ({ ...r, band: riskBand(r.exposure) })),
      },
    };
  }

  @Get('pmo')
  async pmo(@Auth() auth: AuthCtx) {
    const projects = await this.prisma.project.findMany({
      where: { orgId: auth.orgId, status: { in: ['PLANEJAMENTO', 'EM_ANDAMENTO', 'PAUSADO'] } },
      orderBy: { code: 'asc' },
    });
    const rows = [];
    for (const p of projects) {
      const e = await this.evm.evm(auth.orgId, p.id);
      rows.push({
        project: { id: p.id, code: p.code, name: p.name, status: p.status, isDemo: p.isDemo },
        bac: e.bac,
        pv: e.pv,
        ev: e.ev,
        ac: e.ac,
        cpi: e.cpi,
        spi: e.spi,
        hasBaseline: e.hasBaseline,
      });
    }
    return { cutDate: isoDate(new Date()), rows };
  }

  @Get('productivity')
  async productivity(@Auth() auth: AuthCtx) {
    const since = addDays(weekStart(new Date()), -7 * 11);
    const done = await this.prisma.task.findMany({
      where: { orgId: auth.orgId, completedAt: { gte: since } },
      select: { createdAt: true, completedAt: true, assigneeId: true },
    });
    const weeks = Array.from({ length: 12 }, (_, i) => addDays(since, i * 7));
    const throughput = weeks.map((w) => ({
      week: isoDate(w),
      done: done.filter((t) => t.completedAt! >= w && t.completedAt! < addDays(w, 7)).length,
    }));
    const lead = done.map((t) => (t.completedAt!.getTime() - t.createdAt.getTime()) / 86_400_000);
    return {
      throughput,
      leadTimeDays: lead.length ? Math.round((lead.reduce((s, v) => s + v, 0) / lead.length) * 10) / 10 : null,
      leadTimeReason: lead.length ? undefined : 'Sem tarefas concluídas nas últimas 12 semanas.',
      cycleTime: { value: null, reason: 'Pendente: requer histórico estruturado de status (etapa 2).' },
    };
  }

  @Get('governance')
  async governance(@Auth() auth: AuthCtx) {
    const orgId = auth.orgId;
    const soon = addDays(toDateOnly(new Date()), 180);
    const since = addDays(new Date(), -30);
    const [controls, ncOpen, ncOverdue, systemsAlert, changesPending, audit30, assessments90] = await Promise.all([
      this.prisma.control.groupBy({ by: ['lastResult'], where: { orgId }, _count: true }),
      this.prisma.nonConformity.count({ where: { orgId, status: { not: 'ENCERRADA' } } }),
      this.prisma.nonConformity.count({ where: { orgId, status: { not: 'ENCERRADA' }, dueDate: { lt: toDateOnly(new Date()) } } }),
      this.prisma.itSystem.findMany({ where: { orgId, endOfSupport: { lte: soon }, lifecycle: { not: 'DESCONTINUADO' } }, orderBy: { endOfSupport: 'asc' } }),
      this.prisma.changeRequest.count({ where: { orgId, status: 'EM_APROVACAO' } }),
      this.prisma.auditLog.count({ where: { orgId, createdAt: { gte: since } } }),
      this.prisma.assessment.count({ where: { orgId, assessedAt: { gte: addDays(new Date(), -90) } } }),
    ]);
    const counts = Object.fromEntries(controls.map((c) => [c.lastResult, c._count]));
    const assessed = (counts.CONFORME ?? 0) + (counts.PARCIAL ?? 0) + (counts.NAO_CONFORME ?? 0);
    return {
      controls: counts,
      conformity: assessed ? Math.round(((counts.CONFORME ?? 0) / assessed) * 1000) / 1000 : null,
      nonConformities: { open: ncOpen, overdue: ncOverdue },
      assessmentsLast90Days: assessments90,
      systemsEndOfSupport: systemsAlert.map((s) => ({ id: s.id, name: s.name, endOfSupport: s.endOfSupport ? isoDate(s.endOfSupport) : null, criticality: s.criticality })),
      changesPendingApproval: changesPending,
      auditEventsLast30Days: audit30,
    };
  }
}
