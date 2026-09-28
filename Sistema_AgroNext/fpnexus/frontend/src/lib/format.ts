/** Formatação pt-BR. Datas "somente dia" chegam como ISO e são exibidas sem conversão de fuso. */
export function fmtDate(value?: string | null): string {
  if (!value) return '—';
  const [y, m, d] = value.slice(0, 10).split('-');
  return d && m && y ? `${d}/${m}/${y}` : '—';
}

export function fmtDateTime(value?: string | null, timeZone = 'America/Sao_Paulo'): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone }).format(new Date(value));
}

export function fmtMoney(value: number | string | null | undefined, currency = 'BRL'): string {
  if (value === null || value === undefined || value === '') return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(Number(value));
}

export function fmtNumber(value: number | string | null | undefined, digits = 2): string {
  if (value === null || value === undefined || value === '') return '—';
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: digits }).format(Number(value));
}

export function fmtPct(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: digits }).format(value);
}

export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Ordenação natural de códigos de EAP (1.2 < 1.10). */
export function wbsCompare(a?: string | null, b?: string | null): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? -1;
    const y = pb[i] ?? -1;
    if (x !== y) return x - y;
  }
  return 0;
}
