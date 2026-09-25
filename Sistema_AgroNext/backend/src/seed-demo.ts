/**
 * Dados DEMONSTRATIVOS opcionais para avaliar a interface (sistema.md: diferenciar dados demonstrativos).
 * - Grava somente na organização inicial (ORG_INITIAL_SLUG).
 * - Projetos e unidades ficam marcados com isDemo = true; demais nomes levam o sufixo "(demo)".
 * - Pessoas de demonstração NÃO têm senha: não conseguem entrar no sistema.
 * - Idempotente: se o projeto DEMO-01 já existir, nada é feito.
 *
 * Uso: npm run seed:demo   (recomendado apenas em desenvolvimento ou homologação)
 */
import { PrismaClient } from '@prisma/client';
import { addDays, toDateOnly, weekStart } from './domain/dates';

const prisma = new PrismaClient();

async function main() {
  const slug = process.env.ORG_INITIAL_SLUG || 'organizacao-inicial';
  const org = await prisma.organization.findUnique({ where: { slug } });
  if (!org) throw new Error(`Organização "${slug}" não encontrada. Execute o provisionamento antes.`);
  const orgId = org.id;
  if (await prisma.project.findFirst({ where: { orgId, code: 'DEMO-01' } })) {
    console.log('[demo] Dados demonstrativos já existem. Nada a fazer.');
    return;
  }
  const admin = await prisma.membership.findFirst({ where: { orgId, role: 'ADMIN' } });
  const monday = weekStart(new Date());
  const d = (days: number) => addDays(monday, days);

  // Pessoas sem acesso (passwordHash nulo)
  const people: Record<string, string> = {};
  for (const [username, name, role] of [
    ['demo.marcos.almeida', 'Marcos Almeida', 'GERENTE'],
    ['demo.marcos.ribeiro', 'Marcos Ribeiro', 'MEMBRO'],
    ['demo.ana.souza', 'Ana Paula Souza', 'PMO'],
    ['demo.carlos.pereira', 'Carlos Pereira', 'MEMBRO'],
  ] as const) {
    const u =
      (await prisma.user.findUnique({ where: { username } })) ??
      (await prisma.user.create({ data: { username, name, passwordHash: null } }));
    await prisma.membership.upsert({
      where: { userId_orgId: { userId: u.id, orgId } },
      update: {},
      create: { userId: u.id, orgId, role },
    });
    people[name] = u.id;
  }

  const cc = await prisma.costCenter.create({ data: { orgId, code: 'DEMO-CC-100', name: 'Operações Agrícolas (demo)' } });
  const ccTi = await prisma.costCenter.create({ data: { orgId, code: 'DEMO-CC-200', name: 'Tecnologia (demo)' } });

  const units = await Promise.all(
    [
      ['Fazenda Santa Helena', 'FAZENDA', 'Sorriso', 'MT', -12.5425, -55.7211, 4200],
      ['Fazenda Boa Esperança', 'FAZENDA', 'Rio Verde', 'GO', -17.7923, -50.9192, 2800],
      ['Fazenda Três Rios', 'FAZENDA', 'Luís Eduardo Magalhães', 'BA', -12.0964, -45.7866, 3500],
      ['Filial Cascavel', 'FILIAL', 'Cascavel', 'PR', -24.9555, -53.4552, null],
      ['Armazém Rondonópolis', 'ARMAZEM', 'Rondonópolis', 'MT', null, null, null],
    ].map(([name, type, city, state, lat, lng, area]) =>
      prisma.unit.create({
        data: {
          orgId,
          name: name as string,
          type: type as any,
          city: city as string,
          state: state as string,
          latitude: lat as number | null,
          longitude: lng as number | null,
          areaHa: area as number | null,
          costCenterId: cc.id,
          isDemo: true,
        },
      }),
    ),
  );

  const portfolio = await prisma.portfolio.create({ data: { orgId, name: 'Transformação Digital no Campo (demo)', description: 'Portfólio demonstrativo.' } });
  const program = await prisma.program.create({ data: { orgId, portfolioId: portfolio.id, name: 'Agricultura de Precisão (demo)' } });

  const p1 = await prisma.project.create({
    data: {
      orgId,
      code: 'DEMO-01',
      name: 'Irrigação inteligente — Fazenda Santa Helena',
      description: 'Projeto demonstrativo: sensores de solo e automação de pivôs.',
      type: 'ESTRATEGICO',
      status: 'EM_ANDAMENTO',
      portfolioId: portfolio.id,
      programId: program.id,
      managerId: people['Marcos Almeida'],
      costCenterId: cc.id,
      unitId: units[0].id,
      startDate: d(-21),
      endDate: d(45),
      priorityScore: 5,
      wipLimits: { EM_ANDAMENTO: 3 },
      isDemo: true,
    },
  });
  const p2 = await prisma.project.create({
    data: {
      orgId,
      code: 'DEMO-02',
      name: 'Migração do Project Online',
      description: 'Projeto demonstrativo de governança de TI: exportação de dados antes do fim do serviço.',
      type: 'OPERACIONAL',
      status: 'PLANEJAMENTO',
      portfolioId: portfolio.id,
      managerId: people['Ana Paula Souza'],
      costCenterId: ccTi.id,
      unitId: units[3].id,
      startDate: d(0),
      endDate: d(30),
      isDemo: true,
    },
  });

  // Tarefas com EAP, datas, orçamento e estimativas
  const T = async (data: any) => prisma.task.create({ data: { orgId, projectId: p1.id, createdById: admin?.userId, ...data } });
  const t1 = await T({ wbsCode: '1', title: 'Levantamento de campo', startDate: d(-21), endDate: d(-15), budget: '12000.00', progress: 100, status: 'CONCLUIDA', completedAt: d(-15), assigneeId: people['Carlos Pereira'], estOptimistic: 4, estLikely: 5, estPessimistic: 8 });
  const t2 = await T({ wbsCode: '2', title: 'Projeto executivo de irrigação', startDate: d(-14), endDate: d(-3), budget: '25000.00', progress: 80, status: 'EM_REVISAO', assigneeId: people['Marcos Almeida'], estOptimistic: 7, estLikely: 8, estPessimistic: 12 });
  const t3 = await T({ wbsCode: '3', title: 'Aquisição de sensores de solo', startDate: d(-2), endDate: d(9), budget: '60000.00', progress: 20, status: 'EM_ANDAMENTO', assigneeId: people['Marcos Ribeiro'], priority: 'ALTA', estOptimistic: 6, estLikely: 8, estPessimistic: 15 });
  const t4 = await T({ wbsCode: '4', title: 'Instalação e calibração', startDate: d(10), endDate: d(24), budget: '40000.00', assigneeId: people['Carlos Pereira'], estOptimistic: 8, estLikely: 11, estPessimistic: 18 });
  const t5 = await T({ wbsCode: '5', title: 'Integração com telemetria', startDate: d(10), endDate: d(19), budget: '18000.00', assigneeId: people['Marcos Ribeiro'], estOptimistic: 5, estLikely: 7, estPessimistic: 10 });
  const t6 = await T({ wbsCode: '6', title: 'Operação assistida e encerramento', startDate: d(25), endDate: d(38), budget: '15000.00', estOptimistic: 8, estLikely: 10, estPessimistic: 14 });
  const t7 = await T({ wbsCode: '6.1', parentId: t6.id, title: 'Marco: aceite da operação', startDate: d(38), endDate: d(38), isMilestone: true, budget: '0.00' });
  await T({ wbsCode: '7', title: 'Treinamento dos operadores (a agendar)', budget: '5000.00' });
  for (const [a, b] of [[t1, t2], [t2, t3], [t3, t4], [t3, t5], [t4, t6], [t5, t6], [t6, t7]]) {
    await prisma.taskDependency.create({ data: { orgId, predecessorId: a.id, successorId: b.id } });
  }
  // Linha de base registrada 3 semanas atrás e histórico de avanço
  const tasks = await prisma.task.findMany({ where: { projectId: p1.id } });
  await prisma.baseline.create({
    data: {
      orgId,
      projectId: p1.id,
      number: 1,
      createdById: admin?.userId,
      createdAt: d(-22),
      items: { create: tasks.map((t) => ({ taskId: t.id, startDate: t.startDate, endDate: t.endDate, budget: t.budget })) },
    },
  });
  for (const [task, p, day] of [[t1, 50, -18], [t1, 100, -15], [t2, 30, -10], [t2, 60, -6], [t2, 80, -3], [t3, 20, -1]] as const) {
    await prisma.progressLog.create({ data: { orgId, taskId: task.id, progress: p, recordedAt: d(day) } });
  }

  const T2 = async (data: any) => prisma.task.create({ data: { orgId, projectId: p2.id, ...data } });
  await T2({ wbsCode: '1', title: 'Inventário de projetos no Project Online', startDate: d(0), endDate: d(2), priority: 'CRITICA', assigneeId: people['Ana Paula Souza'], budget: '3000.00' });
  await T2({ wbsCode: '2', title: 'Exportação de dados e anexos', startDate: d(1), endDate: d(3), priority: 'CRITICA', budget: '4000.00' });
  await T2({ wbsCode: '3', title: 'Importação no FPNexus e conferência', budget: '6000.00' });

  // Riscos e stakeholders
  for (const r of [
    { title: 'Atraso na entrega dos sensores', probability: 4, impact: 4, response: 'Fornecedor alternativo homologado', ownerId: people['Marcos Ribeiro'] },
    { title: 'Falta de conectividade no talhão norte', probability: 3, impact: 5, response: 'Avaliar enlace via rádio' },
    { title: 'Resistência dos operadores', probability: 2, impact: 3, response: 'Treinamento prático' },
  ]) {
    await prisma.risk.create({ data: { orgId, projectId: p1.id, ...r } });
  }
  await prisma.risk.create({ data: { orgId, projectId: p2.id, title: 'Perda de dados após o encerramento do serviço', probability: 4, impact: 5, response: 'Exportar antes de 30/09/2026' } });
  for (const s of [
    { name: 'Diretoria Agrícola (demo)', role: 'Patrocinador', power: 5, interest: 4 },
    { name: 'Equipe de operadores (demo)', role: 'Usuários', power: 2, interest: 5 },
    { name: 'Fornecedor de sensores (demo)', role: 'Fornecedor', power: 3, interest: 2 },
  ]) {
    await prisma.stakeholder.create({ data: { orgId, projectId: p1.id, ...s } });
  }

  // TAP, Business Case e contrato
  await prisma.charter.create({
    data: {
      orgId,
      projectId: p1.id,
      objectives: 'Reduzir consumo de água em irrigação com automação baseada em umidade do solo.',
      scope: 'Sensores, automação de 4 pivôs, integração com telemetria.',
      assumptions: 'Energia disponível nos pivôs.',
      constraints: 'Instalação fora da janela de plantio.',
      sponsor: 'Diretoria Agrícola (demo)',
      stakeholdersText: 'Diretoria, operadores, fornecedor de sensores.',
      budget: '175000.00',
      macroSchedule: 'Planejamento (3 semanas), aquisição (2), instalação (3), operação assistida (2).',
    },
  });
  const bc = await prisma.businessCase.create({
    data: { orgId, projectId: p1.id, justification: 'Custos de energia e água crescentes (valores demonstrativos).', feasibility: 'Tecnologia disponível no mercado.' },
  });
  const lines: [number, 'CUSTO' | 'BENEFICIO', string, string][] = [
    [1, 'CUSTO', 'Implantação', '175000.00'],
    ...Array.from({ length: 24 }, (_, i) => [i + 1, 'CUSTO', 'Manutenção e conectividade', '1500.00'] as [number, 'CUSTO', string, string]),
    ...Array.from({ length: 22 }, (_, i) => [i + 3, 'BENEFICIO', 'Economia de água e energia', '12000.00'] as [number, 'BENEFICIO', string, string]),
  ];
  await prisma.businessCaseLine.createMany({
    data: lines.map(([period, kind, description, amount]) => ({ orgId, businessCaseId: bc.id, period, kind, description, amount })),
  });
  const contract = await prisma.contract.create({
    data: { orgId, projectId: p1.id, costCenterId: cc.id, supplier: 'Sensores Campo Ltda. (demo)', object: 'Fornecimento de 40 sensores de umidade', totalValue: '60000.00', startDate: d(-10), endDate: d(20), status: 'VIGENTE', ownerId: people['Marcos Ribeiro'] },
  });

  // Lançamentos financeiros
  const entries = [
    [p1.id, 'DESPESA', 'OPEX', 'SERVICOS', 'Levantamento topográfico', '13500.00', -16, 'REALIZADO', null],
    [p1.id, 'DESPESA', 'OPEX', 'RECURSOS', 'Horas de engenharia', '21000.00', -4, 'REALIZADO', null],
    [p1.id, 'DESPESA', 'CAPEX', 'EQUIPAMENTOS', 'Sensores — 1ª parcela', '30000.00', -1, 'REALIZADO', contract.id],
    [p1.id, 'DESPESA', 'CAPEX', 'EQUIPAMENTOS', 'Sensores — 2ª parcela', '30000.00', 12, 'PREVISTO', contract.id],
    [p1.id, 'DESPESA', 'CAPEX', 'SERVICOS', 'Instalação', '40000.00', 20, 'PREVISTO', null],
    [p2.id, 'DESPESA', 'OPEX', 'SERVICOS', 'Consultoria de migração', '9000.00', 5, 'PREVISTO', null],
    [null, 'RECEITA', null, 'OUTROS', 'Venda de excedente de energia solar', '8000.00', -8, 'REALIZADO', null],
  ] as const;
  for (const [projectId, nature, expenseType, category, description, amount, day, status, contractId] of entries) {
    await prisma.financialEntry.create({
      data: { orgId, projectId, nature, expenseType, category, description, amount, competenceDate: d(day), status, contractId, costCenterId: cc.id, createdById: admin?.userId },
    });
  }

  // Reunião com anotações que incluem o exemplo do sistema.md
  const meeting = await prisma.meeting.create({
    data: {
      orgId,
      projectId: p1.id,
      title: 'Status semanal — irrigação (demo)',
      type: 'STATUS_REPORT',
      scheduledAt: d(-2),
      createdById: admin?.userId,
      notes: [
        'Participantes: Marcos Almeida, Marcos Ribeiro, Ana Paula Souza.',
        'Fornecedor confirmou entrega parcial dos sensores.',
        'Marcos deverá validar o contrato até 15/10.',
        'Ana Paula Souza deverá revisar o plano de comunicação até 10/10/2026.',
        'Ação: testar conectividade no talhão norte; responsável: Carlos Pereira; prazo: 08/10/2026',
      ].join('\n'),
    },
  });
  await prisma.meetingDecision.create({ data: { orgId, meetingId: meeting.id, description: 'Aprovar compra dos sensores em duas parcelas.' } });

  // Recursos e alocações
  const res = [];
  for (const [name, type, cap, user] of [
    ['Marcos Almeida', 'PESSOA', '40', people['Marcos Almeida']],
    ['Marcos Ribeiro', 'PESSOA', '40', people['Marcos Ribeiro']],
    ['Carlos Pereira', 'PESSOA', '44', people['Carlos Pereira']],
    ['Trator com GPS (demo)', 'MAQUINA', '50', null],
    ['Consultoria de telemetria (demo)', 'CONSULTOR', null, null],
  ] as const) {
    res.push(await prisma.resource.create({ data: { orgId, name, type, weeklyCapacityHours: cap, userId: user, skills: type === 'PESSOA' ? ['Irrigação'] : [] } }));
  }
  await prisma.allocation.createMany({
    data: [
      { orgId, resourceId: res[0].id, projectId: p1.id, startDate: d(-21), endDate: d(45), hoursPerWeek: '20' },
      { orgId, resourceId: res[1].id, projectId: p1.id, startDate: d(-7), endDate: d(24), hoursPerWeek: '32' },
      { orgId, resourceId: res[1].id, projectId: p2.id, startDate: d(0), endDate: d(14), hoursPerWeek: '16' },
      { orgId, resourceId: res[2].id, projectId: p1.id, startDate: d(10), endDate: d(24), hoursPerWeek: '40' },
      { orgId, resourceId: res[3].id, projectId: p1.id, startDate: d(10), endDate: d(24), hoursPerWeek: '30' },
    ],
  });

  // Governança de TI
  const po = await prisma.itSystem.create({ data: { orgId, name: 'Microsoft Project Online (demo)', vendor: 'Microsoft', criticality: 'ALTA', lifecycle: 'EM_DESCONTINUACAO', endOfSupport: new Date('2026-09-30T00:00:00Z'), notes: 'Encerramento anunciado pelo fornecedor.' } });
  await prisma.itSystem.create({ data: { orgId, name: 'ERP Sankhya (demo)', vendor: 'Sankhya', criticality: 'CRITICA', lifecycle: 'EM_PRODUCAO' } });
  await prisma.itSystem.create({ data: { orgId, name: 'Plataforma de telemetria (demo)', vendor: 'Fornecedor a definir', criticality: 'MEDIA', lifecycle: 'EM_AVALIACAO' } });
  await prisma.changeRequest.create({
    data: { orgId, systemId: po.id, projectId: p2.id, title: 'Desativar integrações com o Project Online (demo)', justification: 'Fim do serviço.', risk: 'ALTA', rollbackPlan: 'Reativar conectores a partir do backup exportado.', requestedById: admin?.userId },
  });

  // Compliance
  const lgpd = await prisma.framework.create({ data: { orgId, name: 'LGPD (demo)', version: 'Lei 13.709/2018' } });
  const iso = await prisma.framework.create({ data: { orgId, name: 'ISO/IEC 27001 (demo)', version: '2022' } });
  const c1 = await prisma.control.create({ data: { orgId, frameworkId: lgpd.id, code: 'LGPD-01', title: 'Registro das operações de tratamento', requirementRef: 'Art. 37', frequency: 'SEMESTRAL', lastResult: 'CONFORME', lastAssessedAt: d(-30) } });
  const c2 = await prisma.control.create({ data: { orgId, frameworkId: iso.id, code: 'A.5.15', title: 'Controle de acesso', frequency: 'TRIMESTRAL', lastResult: 'PARCIAL', lastAssessedAt: d(-20) } });
  const c3 = await prisma.control.create({ data: { orgId, frameworkId: iso.id, code: 'A.8.13', title: 'Backup das informações', frequency: 'TRIMESTRAL', lastResult: 'NAO_CONFORME', lastAssessedAt: d(-5) } });
  await prisma.control.create({ data: { orgId, frameworkId: iso.id, code: 'A.8.15', title: 'Registro de eventos (logging)', frequency: 'TRIMESTRAL' } });
  await prisma.assessment.createMany({
    data: [
      { orgId, controlId: c1.id, result: 'CONFORME', assessedAt: d(-30), assessedById: admin?.userId },
      { orgId, controlId: c2.id, result: 'PARCIAL', notes: 'Revisão de acessos trimestral atrasada.', assessedAt: d(-20), assessedById: admin?.userId },
      { orgId, controlId: c3.id, result: 'NAO_CONFORME', notes: 'Teste de restauração não evidenciado.', assessedAt: d(-5), assessedById: admin?.userId },
    ],
  });
  await prisma.evidence.create({ data: { orgId, controlId: c1.id, description: 'Inventário de dados pessoais (demo)', reference: 'Documento interno ROPA v3', collectedAt: d(-30) } });
  await prisma.nonConformity.create({ data: { orgId, controlId: c3.id, title: 'Controle A.8.13 não conforme', description: 'Teste de restauração não evidenciado.', actionPlan: 'Executar restauração trimestral e registrar evidência.', dueDate: d(14), ownerId: people['Ana Paula Souza'] } });

  // Agronegócio
  const season = await prisma.season.create({ data: { orgId, name: '2025/26 (demo)', crop: 'Soja', startDate: new Date('2025-09-15T00:00:00Z'), endDate: new Date('2026-08-31T00:00:00Z') } });
  const ind = await prisma.agroIndicator.create({
    data: { orgId, name: 'Lâmina de irrigação aplicada (demo)', formula: 'Volume aplicado (m³) / área irrigada (ha) / 10', unit: 'mm', source: 'Medição manual do operador', frequency: 'Semanal', responsible: 'Operação agrícola' },
  });
  const ind2 = await prisma.agroIndicator.create({
    data: { orgId, name: 'Produtividade de soja (demo)', formula: 'Produção colhida (sc 60 kg) / área colhida (ha)', unit: 'sc/ha', source: 'Romaneios de colheita', frequency: 'Por safra', responsible: 'Agronomia' },
  });
  for (let w = -8; w <= -1; w++) {
    for (const [u, base] of [[units[0], 28], [units[1], 24]] as const) {
      if (u === units[1] && w === -4) continue; // leitura ausente permanece ausente
      await prisma.agroMeasurement.create({
        data: { orgId, indicatorId: ind.id, unitId: u.id, seasonId: season.id, projectId: u === units[0] ? p1.id : null, refDate: d(w * 7), value: String(base + ((w * 7 + 13) % 5)), origin: 'MANUAL' },
      });
    }
  }
  for (const [u, v] of [[units[0], '64.5'], [units[1], '61.2'], [units[2], '58.9']] as const) {
    await prisma.agroMeasurement.create({ data: { orgId, indicatorId: ind2.id, unitId: u.id, seasonId: season.id, refDate: toDateOnly(new Date('2026-04-30T00:00:00Z')), value: v, origin: 'MANUAL' } });
  }

  await prisma.auditLog.create({ data: { orgId, action: 'CARGA_DEMO', entity: 'Organizacao', entityId: orgId, summary: { projetos: ['DEMO-01', 'DEMO-02'] } } });
  console.log('[demo] Dados demonstrativos criados na organização', org.name);
}

main()
  .catch((e) => {
    console.error('[demo] falhou:', (e as Error).message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
