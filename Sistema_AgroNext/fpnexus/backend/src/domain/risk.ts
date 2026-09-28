/** Escala padrão 1–5 e faixas de exposição (sistema.md, B16). */
export type RiskBand = 'BAIXA' | 'MODERADA' | 'ALTA' | 'CRITICA';

export function riskExposure(probability: number, impact: number): number {
  if (![probability, impact].every((v) => Number.isInteger(v) && v >= 1 && v <= 5)) {
    throw new Error('Probabilidade e impacto devem ser inteiros de 1 a 5.');
  }
  return probability * impact;
}

export function riskBand(exposure: number): RiskBand {
  if (exposure >= 15) return 'CRITICA';
  if (exposure >= 10) return 'ALTA';
  if (exposure >= 5) return 'MODERADA';
  return 'BAIXA';
}

export function stakeholderQuadrant(power: number, interest: number): string {
  if (power >= 3 && interest >= 3) return 'Gerenciar de perto';
  if (power >= 3) return 'Manter satisfeito';
  if (interest >= 3) return 'Manter informado';
  return 'Monitorar';
}
