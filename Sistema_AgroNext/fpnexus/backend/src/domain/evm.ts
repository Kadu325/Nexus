import { toDateOnly, workdaysBetween, addDays, isoDate, weekStart } from './dates';

/**
 * Gerenciamento do Valor Agregado (sistema.md, Prioridade 4 e B15).
 * PV: orçamento da linha de base × fração dos dias úteis planejados decorridos até a data de corte.
 * EV: orçamento da linha de base × % físico concluído na data de corte.
 * AC: despesas realizadas do projeto com competência até a data de corte.
 * CPI = EV / AC; SPI = EV / PV. Denominador zero ou dado ausente => indisponível com motivo.
 */
export interface BaselineItem {
  taskId: string;
  start: Date | null;
  end: Date | null;
  budgetCents: number;
}

export interface Indicator {
  value: number | null;
  reason?: string;
}

export interface EvmResult {
  cutDate: string;
  hasBaseline: boolean;
  bacCents: number;
  pvCents: number | null;
  evCents: number | null;
  acCents: number;
  cpi: Indicator;
  spi: Indicator;
  cv: number | null;
  sv: number | null;
  eacCents: number | null;
  notes: string[];
}

export function plannedFraction(item: BaselineItem, cut: Date): number | null {
  if (!item.start || !item.end) return null;
  const s = toDateOnly(item.start);
  const e = toDateOnly(item.end);
  const c = toDateOnly(cut);
  if (c < s) return 0;
  if (c >= e) return 1;
  const total = workdaysBetween(s, e);
  if (total === 0) return c >= s ? 1 : 0;
  return workdaysBetween(s, c) / total;
}

export function computeEvm(params: {
  cutDate: Date;
  baseline: BaselineItem[] | null;
  progressAt: (taskId: string) => number; // 0..100 na data de corte
  acEntries: { date: Date; amountCents: number }[];
}): EvmResult {
  const cut = toDateOnly(params.cutDate);
  const notes: string[] = [];
  const acCents = params.acEntries
    .filter((e) => toDateOnly(e.date) <= cut)
    .reduce((s, e) => s + e.amountCents, 0);

  if (!params.baseline || params.baseline.length === 0) {
    return {
      cutDate: isoDate(cut),
      hasBaseline: false,
      bacCents: 0,
      pvCents: null,
      evCents: null,
      acCents,
      cpi: { value: null, reason: 'Sem linha de base: EV indisponível.' },
      spi: { value: null, reason: 'Sem linha de base: PV e EV indisponíveis.' },
      cv: null,
      sv: null,
      eacCents: null,
      notes: ['Registre uma linha de base do projeto para calcular PV, EV, CPI e SPI.'],
    };
  }

  let bac = 0;
  let pv = 0;
  let ev = 0;
  let unscheduled = 0;
  for (const item of params.baseline) {
    bac += item.budgetCents;
    const f = plannedFraction(item, cut);
    if (f === null) unscheduled++;
    else pv += Math.round(item.budgetCents * f);
    const p = Math.min(100, Math.max(0, params.progressAt(item.taskId)));
    ev += Math.round((item.budgetCents * p) / 100);
  }
  if (unscheduled > 0) {
    notes.push(`${unscheduled} tarefa(s) da linha de base sem datas: fora do PV.`);
  }
  if (bac === 0) notes.push('Orçamento da linha de base igual a zero.');

  const cpi: Indicator =
    acCents === 0 ? { value: null, reason: 'AC igual a zero: CPI indisponível.' } : { value: round(ev / acCents, 3) };
  const spi: Indicator =
    pv === 0 ? { value: null, reason: 'PV igual a zero na data de corte: SPI indisponível.' } : { value: round(ev / pv, 3) };
  const eacCents = cpi.value && cpi.value > 0 ? Math.round(bac / cpi.value) : null;

  return {
    cutDate: isoDate(cut),
    hasBaseline: true,
    bacCents: bac,
    pvCents: pv,
    evCents: ev,
    acCents,
    cpi,
    spi,
    cv: ev - acCents,
    sv: ev - pv,
    eacCents,
    notes,
  };
}

/** Série semanal para a Curva S. EV histórico usa o registro de avanço (ProgressLog). */
export function sCurve(params: {
  baseline: BaselineItem[];
  progressLogs: { taskId: string; progress: number; at: Date }[];
  acEntries: { date: Date; amountCents: number }[];
  until: Date;
}): { week: string; pv: number; ev: number | null; ac: number | null }[] {
  const dated = params.baseline.filter((b) => b.start && b.end);
  if (dated.length === 0) return [];
  const start = weekStart(new Date(Math.min(...dated.map((b) => b.start!.getTime()))));
  const endPlan = new Date(Math.max(...dated.map((b) => b.end!.getTime())));
  const until = toDateOnly(params.until);
  const last = endPlan > until ? endPlan : until;
  const logsByTask = new Map<string, { progress: number; at: Date }[]>();
  for (const l of [...params.progressLogs].sort((a, b) => a.at.getTime() - b.at.getTime())) {
    if (!logsByTask.has(l.taskId)) logsByTask.set(l.taskId, []);
    logsByTask.get(l.taskId)!.push(l);
  }
  const progressOn = (taskId: string, d: Date) => {
    const logs = logsByTask.get(taskId);
    if (!logs) return 0;
    let p = 0;
    for (const l of logs) if (toDateOnly(l.at) <= d) p = l.progress;
    return p;
  };
  const points: { week: string; pv: number; ev: number | null; ac: number | null }[] = [];
  for (let w = start; w <= addDays(last, 6); w = addDays(w, 7)) {
    const cut = addDays(w, 6); // fim da semana
    let pv = 0;
    let ev = 0;
    for (const b of params.baseline) {
      const f = plannedFraction(b, cut);
      if (f !== null) pv += b.budgetCents * f;
      ev += (b.budgetCents * progressOn(b.taskId, cut)) / 100;
    }
    const future = w > until;
    const ac = params.acEntries.filter((e) => toDateOnly(e.date) <= cut).reduce((s, e) => s + e.amountCents, 0);
    points.push({
      week: isoDate(w),
      pv: Math.round(pv),
      ev: future ? null : Math.round(ev),
      ac: future ? null : ac,
    });
  }
  return points;
}

function round(v: number, digits: number) {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
}
