import { test } from 'node:test';
import assert from 'node:assert/strict';
import { workdaysBetween, weekStart, isoDate } from '../../src/domain/dates';
import { computeCpm, wouldCreateCycle, CycleError } from '../../src/domain/cpm';
import { computeEvm, plannedFraction } from '../../src/domain/evm';
import { computeBusinessCase } from '../../src/domain/business-case';
import { riskExposure, riskBand, stakeholderQuadrant } from '../../src/domain/risk';
import { pert, monteCarlo } from '../../src/domain/estimation';
import { extractActions, ISSUE } from '../../src/domain/action-extractor';
import { toCents, fromCents } from '../../src/domain/money';

const D = (s: string) => new Date(`${s}T00:00:00Z`);

test('dias úteis: segunda a sexta, inclusive', () => {
  assert.equal(workdaysBetween(D('2026-09-21'), D('2026-09-25')), 5); // seg–sex
  assert.equal(workdaysBetween(D('2026-09-21'), D('2026-09-27')), 5); // inclui fim de semana
  assert.equal(workdaysBetween(D('2026-09-26'), D('2026-09-27')), 0);
  assert.equal(workdaysBetween(D('2026-09-25'), D('2026-09-21')), 0);
  assert.equal(isoDate(weekStart(D('2026-09-24'))), '2026-09-21');
});

test('dinheiro em centavos, sem ponto flutuante', () => {
  assert.equal(toCents('0.10') + toCents('0.20'), 30);
  assert.equal(toCents('1234.565'), 123457);
  assert.equal(toCents('-5.5'), -550);
  assert.equal(fromCents(123457), '1234.57');
  assert.throws(() => toCents('abc'));
});

test('CPM: caminho crítico e folga', () => {
  const r = computeCpm(
    [
      { id: 'A', duration: 3 },
      { id: 'B', duration: 2 },
      { id: 'C', duration: 4 },
      { id: 'D', duration: 1 },
    ],
    [
      { from: 'A', to: 'B' },
      { from: 'A', to: 'C' },
      { from: 'B', to: 'D' },
      { from: 'C', to: 'D' },
    ],
  );
  assert.equal(r.projectDuration, 8);
  assert.deepEqual(r.criticalPath, ['A', 'C', 'D']);
  assert.equal(r.nodes.B.float, 2);
});

test('CPM: ciclo é rejeitado', () => {
  assert.throws(() => computeCpm([{ id: 'A', duration: 1 }, { id: 'B', duration: 1 }], [
    { from: 'A', to: 'B' },
    { from: 'B', to: 'A' },
  ]), CycleError);
  assert.equal(wouldCreateCycle(['A', 'B'], [{ from: 'A', to: 'B' }], { from: 'B', to: 'A' }), true);
  assert.equal(wouldCreateCycle(['A', 'B'], [], { from: 'A', to: 'A' }), true);
  assert.equal(wouldCreateCycle(['A', 'B'], [], { from: 'A', to: 'B' }), false);
});

test('EVM: PV, EV, AC, CPI, SPI', () => {
  // Tarefa 1: 21–25/09 (5 dias úteis), R$ 1.000,00; Tarefa 2: 28/09–02/10, R$ 2.000,00
  const baseline = [
    { taskId: 't1', start: D('2026-09-21'), end: D('2026-09-25'), budgetCents: 100000 },
    { taskId: 't2', start: D('2026-09-28'), end: D('2026-10-02'), budgetCents: 200000 },
  ];
  assert.equal(plannedFraction(baseline[0], D('2026-09-23')), 3 / 5);
  const progress: Record<string, number> = { t1: 100, t2: 20 };
  const r = computeEvm({
    cutDate: D('2026-09-29'), // t1 completo, t2 2/5
    baseline,
    progressAt: (id) => progress[id],
    acEntries: [
      { date: D('2026-09-22'), amountCents: 90000 },
      { date: D('2026-09-29'), amountCents: 60000 },
      { date: D('2026-10-10'), amountCents: 99999 }, // após o corte: ignorado
    ],
  });
  assert.equal(r.bacCents, 300000);
  assert.equal(r.pvCents, 100000 + 80000);
  assert.equal(r.evCents, 100000 + 40000);
  assert.equal(r.acCents, 150000);
  assert.equal(r.cpi.value, 0.933);
  assert.equal(r.spi.value, 0.778);
});

test('EVM: denominador zero e ausência de linha de base viram indisponível', () => {
  const r = computeEvm({ cutDate: D('2026-09-01'), baseline: null, progressAt: () => 0, acEntries: [] });
  assert.equal(r.cpi.value, null);
  assert.ok(r.cpi.reason);
  const r2 = computeEvm({
    cutDate: D('2026-09-01'),
    baseline: [{ taskId: 'x', start: D('2026-10-01'), end: D('2026-10-05'), budgetCents: 1000 }],
    progressAt: () => 0,
    acEntries: [],
  });
  assert.equal(r2.pvCents, 0);
  assert.equal(r2.spi.value, null);
  assert.equal(r2.cpi.value, null);
});

test('Business Case: ROI, TCO e payback', () => {
  const r = computeBusinessCase([
    { period: 1, kind: 'CUSTO', amountCents: 100000 },
    { period: 2, kind: 'BENEFICIO', amountCents: 40000 },
    { period: 3, kind: 'BENEFICIO', amountCents: 40000 },
    { period: 4, kind: 'BENEFICIO', amountCents: 40000 },
  ]);
  assert.equal(r.tcoCents, 100000);
  assert.equal(r.roi.value, 0.2);
  assert.equal(r.payback.period, 4);
  const semCusto = computeBusinessCase([{ period: 1, kind: 'BENEFICIO', amountCents: 10 }]);
  assert.equal(semCusto.roi.value, null);
});

test('Riscos e stakeholders', () => {
  assert.equal(riskExposure(3, 5), 15);
  assert.equal(riskBand(15), 'CRITICA');
  assert.equal(riskBand(9), 'MODERADA');
  assert.equal(riskBand(4), 'BAIXA');
  assert.throws(() => riskExposure(0, 3));
  assert.equal(stakeholderQuadrant(4, 4), 'Gerenciar de perto');
  assert.equal(stakeholderQuadrant(1, 4), 'Manter informado');
});

test('PERT e Monte Carlo reproduzível', () => {
  assert.deepEqual(pert(2, 4, 12), { expected: 5, sd: 10 / 6 });
  assert.throws(() => pert(5, 4, 6));
  const nodes = [
    { id: 'A', o: 2, m: 4, p: 8 },
    { id: 'B', o: 1, m: 2, p: 6 },
    { id: 'C', fixed: 3 },
  ];
  const edges = [{ from: 'A', to: 'B' }, { from: 'A', to: 'C' }];
  const r1 = monteCarlo(nodes, edges, 2000, 42);
  const r2 = monteCarlo(nodes, edges, 2000, 42);
  assert.deepEqual(r1, r2);
  assert.ok(r1.p50 <= r1.p80 && r1.p80 <= r1.p95);
  assert.ok(r1.min >= 3 && r1.max <= 14);
  assert.equal(r1.histogram.reduce((s, b) => s + b.count, 0), 2000);
});

test('Extrator de ações: exemplo do sistema.md exige revisão', () => {
  const people = [
    { id: 'u1', name: 'Marcos Almeida' },
    { id: 'u2', name: 'Marcos Ribeiro' },
    { id: 'u3', name: 'Ana Paula Souza' },
  ];
  const notes = [
    'Pauta: contratos',
    'Marcos deverá validar o contrato até 15/10.',
    'Ana Paula Souza deverá enviar o cronograma até 20/10/2026',
    'Ação: revisar orçamento; responsável: Joana; prazo: 31/02',
    'Marcos deverá validar o contrato até 15/10.',
  ].join('\n');
  const out = extractActions('m1', notes, people, D('2026-09-24'));
  assert.equal(out.length, 3, 'linha repetida não gera ação duplicada');
  const [a, b, c] = out;
  assert.deepEqual(a.candidateIds, ['u1', 'u2']);
  assert.ok(a.issues.includes(ISSUE.RESPONSAVEL_AMBIGUO));
  assert.ok(a.issues.includes(ISSUE.PRAZO_SEM_ANO));
  assert.equal(a.suggestedDueDate, '2026-10-15');
  assert.equal(a.description, 'Validar o contrato');
  assert.deepEqual(b.candidateIds, ['u3']);
  assert.deepEqual(b.issues, []);
  assert.equal(b.suggestedDueDate, '2026-10-20');
  assert.ok(c.issues.includes(ISSUE.RESPONSAVEL_SEM_CADASTRO));
  assert.ok(c.issues.includes(ISSUE.PRAZO_INVALIDO));
  // reprocessar gera as mesmas impressões digitais (deduplicação)
  const again = extractActions('m1', notes, people, D('2026-09-24'));
  assert.deepEqual(again.map((x) => x.fingerprint), out.map((x) => x.fingerprint));
  // nome único citado só pelo primeiro nome também exige confirmação
  const single = extractActions('m2', 'Joana deverá aprovar até 01/11', [{ id: 'j', name: 'Joana Lima' }], D('2026-09-24'));
  assert.ok(single[0].issues.includes(ISSUE.RESPONSAVEL_SO_PRIMEIRO_NOME));
});
