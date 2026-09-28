/**
 * Business Case — fórmulas padrão parametrizáveis (sistema.md, B14). Valores sem desconto.
 * TCO = soma dos custos no horizonte.
 * ROI = (benefícios − custos) / custos. Custos = 0 => indisponível.
 * Payback = primeiro período com fluxo líquido acumulado >= 0.
 */
export interface CaseLine {
  period: number;
  kind: 'BENEFICIO' | 'CUSTO';
  amountCents: number;
}

export interface CaseResult {
  horizon: number;
  totalBenefitsCents: number;
  totalCostsCents: number;
  tcoCents: number;
  netCents: number;
  roi: { value: number | null; reason?: string };
  payback: { period: number | null; reason?: string };
  cashflow: { period: number; benefitsCents: number; costsCents: number; cumulativeCents: number }[];
}

export function computeBusinessCase(lines: CaseLine[]): CaseResult {
  const horizon = lines.reduce((m, l) => Math.max(m, l.period), 0);
  const cashflow: CaseResult['cashflow'] = [];
  let cumulative = 0;
  let payback: number | null = null;
  for (let p = 1; p <= horizon; p++) {
    const b = lines.filter((l) => l.period === p && l.kind === 'BENEFICIO').reduce((s, l) => s + l.amountCents, 0);
    const c = lines.filter((l) => l.period === p && l.kind === 'CUSTO').reduce((s, l) => s + l.amountCents, 0);
    cumulative += b - c;
    cashflow.push({ period: p, benefitsCents: b, costsCents: c, cumulativeCents: cumulative });
    if (payback === null && cumulative >= 0 && (b > 0 || c > 0)) payback = p;
  }
  const totalBenefitsCents = lines.filter((l) => l.kind === 'BENEFICIO').reduce((s, l) => s + l.amountCents, 0);
  const totalCostsCents = lines.filter((l) => l.kind === 'CUSTO').reduce((s, l) => s + l.amountCents, 0);
  const netCents = totalBenefitsCents - totalCostsCents;
  return {
    horizon,
    totalBenefitsCents,
    totalCostsCents,
    tcoCents: totalCostsCents,
    netCents,
    roi:
      totalCostsCents === 0
        ? { value: null, reason: 'Custos totais iguais a zero: ROI indisponível.' }
        : { value: Math.round((netCents / totalCostsCents) * 10000) / 10000 },
    payback:
      lines.length === 0
        ? { period: null, reason: 'Sem lançamentos no Business Case.' }
        : payback === null
          ? { period: null, reason: 'Não atingido no horizonte.' }
          : { period: payback },
    cashflow,
  };
}
