/**
 * Datas "somente dia" são tratadas como meia-noite UTC para evitar deslocamentos de fuso.
 * Calendário padrão da etapa 1: segunda a sexta-feira; feriados ainda não cadastrados (sistema.md, B13).
 */
const DAY = 86_400_000;

export function toDateOnly(value: Date | string): Date {
  const d = typeof value === 'string' ? new Date(value) : value;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function isoDate(d: Date): string {
  return toDateOnly(d).toISOString().slice(0, 10);
}

export function addDays(d: Date, n: number): Date {
  return new Date(toDateOnly(d).getTime() + n * DAY);
}

export function isWorkday(d: Date, holidays: Set<string> = new Set()): boolean {
  const wd = toDateOnly(d).getUTCDay();
  return wd !== 0 && wd !== 6 && !holidays.has(isoDate(d));
}

/** Dias úteis entre start e end, inclusive. Retorna 0 se end < start. */
export function workdaysBetween(start: Date, end: Date, holidays?: Set<string>): number {
  const s = toDateOnly(start);
  const e = toDateOnly(end);
  if (e < s) return 0;
  let count = 0;
  for (let t = s.getTime(); t <= e.getTime(); t += DAY) {
    if (isWorkday(new Date(t), holidays)) count++;
  }
  return count;
}

/** Semana ISO iniciada na segunda-feira que contém a data. */
export function weekStart(d: Date): Date {
  const x = toDateOnly(d);
  const wd = (x.getUTCDay() + 6) % 7; // 0 = segunda
  return addDays(x, -wd);
}
