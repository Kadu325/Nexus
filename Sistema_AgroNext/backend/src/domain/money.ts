/**
 * Valores monetários trafegam como string decimal (Prisma Decimal) e são somados em centavos inteiros,
 * nunca em ponto flutuante (sistema.md, B15).
 */
export function toCents(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;
  const s = typeof value === 'object' && value !== null && 'toString' in value ? String(value) : String(value);
  if (!/^-?\d+(\.\d+)?$/.test(s.trim())) throw new Error(`Valor monetário inválido: ${s}`);
  const neg = s.trim().startsWith('-');
  const [int, frac = ''] = s.trim().replace('-', '').split('.');
  // arredondamento meio-para-cima na terceira casa
  const f3 = (frac + '000').slice(0, 3);
  let cents = Number(int) * 100 + Number(f3.slice(0, 2));
  if (Number(f3[2]) >= 5) cents += 1;
  return neg ? -cents : cents;
}

export function fromCents(cents: number): string {
  const neg = cents < 0;
  const abs = Math.abs(Math.round(cents));
  const s = `${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
  return neg ? `-${s}` : s;
}

export function centsToNumber(cents: number): number {
  return Math.round(cents) / 100;
}
