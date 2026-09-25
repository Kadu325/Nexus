import { BadRequestException, ConflictException, Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../common/prisma.service';
import { Auth, AuthCtx, R } from '../common/auth-context';
import { crudController, z } from '../common/crud.factory';
import { findInOrg } from '../common/org-scope';
import { zDate, zOptDate, zOptId, zPosMoney, zText } from '../common/validation';
import { sCurve } from '../domain/evm';
import { EvmService } from './evm.service';
import { addDays, isoDate, weekStart } from '../domain/dates';
import { centsToNumber, toCents } from '../domain/money';

export const CostCenterController = crudController({
  path: 'cost-centers',
  model: 'costCenter',
  entity: 'CentroDeCusto',
  tag: 'Gestão Financeira',
  create: z.object({ code: zText(30), name: zText(150) }),
  writeRoles: R.PMO,
  orderBy: { code: 'asc' },
});

export const FinancialEntryController = crudController({
  path: 'financial-entries',
  model: 'financialEntry',
  entity: 'LancamentoFinanceiro',
  tag: 'Gestão Financeira',
  create: z.object({
    projectId: zOptId,
    costCenterId: zOptId,
    contractId: zOptId,
    nature: z.enum(['RECEITA', 'DESPESA']),
    expenseType: z.enum(['CAPEX', 'OPEX']).nullable().optional(),
    category: z.enum(['RECURSOS', 'EQUIPAMENTOS', 'FORNECEDORES', 'SERVICOS', 'MATERIAIS', 'OUTROS']).optional(),
    description: zText(300),
    amount: zPosMoney,
    competenceDate: zDate,
    cashDate: zOptDate,
    status: z.enum(['PREVISTO', 'REALIZADO']).optional(),
  }),
  refs: { projectId: 'project', costCenterId: 'costCenter', contractId: 'contract' },
  filters: ['projectId', 'costCenterId', 'contractId', 'nature', 'status', 'expenseType'],
  orderBy: [{ competenceDate: 'desc' }, { createdAt: 'desc' }],
  async beforeWrite(data, { auth, existing }) {
    if (existing && existing.source !== 'MANUAL') {
      throw new ConflictException('Lançamentos importados de ERP são somente leitura na plataforma.');
    }
    // Gerente de Projeto lança apenas previstos (sistema.md, matriz de permissões)
    const status = data.status ?? existing?.status ?? 'PREVISTO';
    if (auth.role === 'GERENTE' && status === 'REALIZADO') {
      throw new ConflictException('Gerente de Projeto registra apenas lançamentos previstos; realizados cabem ao PMO ou à administração.');
    }
    const nature = data.nature ?? existing?.nature;
    if (nature === 'RECEITA' && data.expenseType) throw new BadRequestException('CAPEX/OPEX aplica-se apenas a despesas.');
    if (!existing) data.createdById = auth.userId;
    return data;
  },
  async beforeDelete(existing, { auth }) {
    if (existing.source !== 'MANUAL') throw new ConflictException('Lançamentos importados de ERP não podem ser excluídos aqui.');
    if (auth.role === 'GERENTE' && existing.status === 'REALIZADO') throw new ConflictException('Sem permissão para excluir realizado.');
  },
});

@ApiTags('Gestão Financeira')
@Controller()
export class FinanceController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly evmService: EvmService,
  ) {}

  @Get('projects/:id/evm')
  async evm(@Auth() auth: AuthCtx, @Param('id', ParseUUIDPipe) projectId: string, @Query('date') date?: string) {
    await findInOrg(this.prisma, 'project', projectId, auth.orgId);
    const r = await this.evmService.evm(auth.orgId, projectId, date ? zDate.parse(date) : undefined);
    return {
      ...r,
      definitions: {
        PV: 'Orçamento da linha de base × fração dos dias úteis planejados decorridos até a data de corte.',
        EV: 'Orçamento da linha de base × % físico concluído registrado até a data de corte.',
        AC: 'Despesas realizadas do projeto com data de competência até a data de corte.',
        CPI: 'EV / AC',
        SPI: 'EV / PV',
        EAC: 'BAC / CPI',
      },
    };
  }

  @Get('projects/:id/s-curve')
  async sCurve(@Auth() auth: AuthCtx, @Param('id', ParseUUIDPipe) projectId: string) {
    await findInOrg(this.prisma, 'project', projectId, auth.orgId);
    const baseline = await this.evmService.baselineItems(auth.orgId, projectId);
    if (!baseline) return { available: false, reason: 'Sem linha de base registrada.', points: [] };
    const logs = await this.prisma.progressLog.findMany({ where: { orgId: auth.orgId, taskId: { in: baseline.items.map((i) => i.taskId) } } });
    const points = sCurve({
      baseline: baseline.items,
      progressLogs: logs.map((l) => ({ taskId: l.taskId, progress: l.progress, at: l.recordedAt })),
      acEntries: await this.evmService.acEntries(auth.orgId, projectId),
      until: new Date(),
    }).map((p) => ({
      week: p.week,
      pv: centsToNumber(p.pv),
      ev: p.ev === null ? null : centsToNumber(p.ev),
      ac: p.ac === null ? null : centsToNumber(p.ac),
    }));
    if (points.length === 0) return { available: false, reason: 'Linha de base sem tarefas com datas.', points };
    return { available: true, baselineNumber: baseline.number, points };
  }

  /** Burnup/Burndown por quantidade de tarefas (escopo atual × concluídas por semana). */
  @Get('projects/:id/burn')
  async burn(@Auth() auth: AuthCtx, @Param('id', ParseUUIDPipe) projectId: string) {
    await findInOrg(this.prisma, 'project', projectId, auth.orgId);
    const tasks = await this.prisma.task.findMany({ where: { orgId: auth.orgId, projectId }, select: { createdAt: true, completedAt: true } });
    if (tasks.length === 0) return { available: false, reason: 'Projeto sem tarefas.', points: [] };
    const start = weekStart(new Date(Math.min(...tasks.map((t) => t.createdAt.getTime()))));
    const end = weekStart(new Date());
    const points = [];
    for (let w = start; w <= end; w = addDays(w, 7)) {
      const cut = addDays(w, 7);
      const scope = tasks.filter((t) => t.createdAt < cut).length;
      const done = tasks.filter((t) => t.completedAt && t.completedAt < cut).length;
      points.push({ week: isoDate(w), scope, done, remaining: scope - done });
    }
    return { available: true, unit: 'tarefas', points: points.slice(-52) };
  }

  @Get('finance/summary')
  async summary(@Auth() auth: AuthCtx, @Query('year') yearQ?: string, @Query('projectId') projectId?: string) {
    const year = Number(yearQ) || new Date().getUTCFullYear();
    if (projectId) await findInOrg(this.prisma, 'project', projectId, auth.orgId);
    const rows = await this.prisma.financialEntry.findMany({
      where: {
        orgId: auth.orgId,
        ...(projectId ? { projectId } : {}),
        competenceDate: { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) },
      },
    });
    const months = Array.from({ length: 12 }, (_, m) => ({
      month: `${year}-${String(m + 1).padStart(2, '0')}`,
      despesaPrevista: 0,
      despesaRealizada: 0,
      receitaPrevista: 0,
      receitaRealizada: 0,
    }));
    const byCategory: Record<string, { previsto: number; realizado: number }> = {};
    const totals = { capex: 0, opex: 0, despesaPrevista: 0, despesaRealizada: 0, receitaPrevista: 0, receitaRealizada: 0 };
    for (const r of rows) {
      const c = toCents(r.amount);
      const m = months[r.competenceDate.getUTCMonth()];
      const key = `${r.nature === 'DESPESA' ? 'despesa' : 'receita'}${r.status === 'PREVISTO' ? 'Prevista' : 'Realizada'}` as keyof typeof totals;
      (m as any)[key] += c;
      totals[key] += c;
      if (r.nature === 'DESPESA') {
        byCategory[r.category] ??= { previsto: 0, realizado: 0 };
        byCategory[r.category][r.status === 'PREVISTO' ? 'previsto' : 'realizado'] += c;
        if (r.status === 'REALIZADO' && r.expenseType === 'CAPEX') totals.capex += c;
        if (r.status === 'REALIZADO' && r.expenseType === 'OPEX') totals.opex += c;
      }
    }
    const conv = (o: Record<string, number>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'number' ? centsToNumber(v) : v]));
    return {
      year,
      currency: (await this.prisma.organization.findUnique({ where: { id: auth.orgId } }))?.currency ?? 'BRL',
      months: months.map((m) => ({ ...conv(m as any), month: m.month })),
      byCategory: Object.entries(byCategory).map(([category, v]) => ({ category, previsto: centsToNumber(v.previsto), realizado: centsToNumber(v.realizado) })),
      totals: conv(totals),
      basis: 'Competência. Orçado = lançamentos previstos; Realizado = lançamentos realizados.',
    };
  }

  @Get('contracts-balance')
  async contractBalances(@Auth() auth: AuthCtx) {
    const [contracts, spent] = await Promise.all([
      this.prisma.contract.findMany({ where: { orgId: auth.orgId }, select: { id: true, totalValue: true } }),
      this.prisma.financialEntry.groupBy({
        by: ['contractId'],
        where: { orgId: auth.orgId, contractId: { not: null }, nature: 'DESPESA', status: 'REALIZADO' },
        _sum: { amount: true },
      }),
    ]);
    const map = new Map(spent.map((s) => [s.contractId, toCents(s._sum.amount ?? 0)]));
    return contracts.map((c) => {
      const used = map.get(c.id) ?? 0;
      return { contractId: c.id, realizado: centsToNumber(used), saldo: centsToNumber(toCents(c.totalValue) - used) };
    });
  }
}

