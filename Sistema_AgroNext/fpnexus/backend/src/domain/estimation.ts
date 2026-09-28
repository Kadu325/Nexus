import { computeCpm, CpmEdge, topologicalOrder } from './cpm';

/**
 * Estimativas e simulações (sistema.md, Prioridade 8 e B20).
 * Não são modelos preditivos: dependem apenas das estimativas informadas pelos usuários.
 */
export function pert(o: number, m: number, p: number) {
  if (!(o >= 0 && o <= m && m <= p)) throw new Error('É preciso O ≤ M ≤ P, com valores não negativos.');
  return { expected: (o + 4 * m + p) / 6, sd: (p - o) / 6 };
}

/** Gerador pseudoaleatório reproduzível (mulberry32). */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function triangular(o: number, m: number, p: number, u: number): number {
  if (p === o) return o;
  const c = (m - o) / (p - o);
  return u < c ? o + Math.sqrt(u * (p - o) * (m - o)) : p - Math.sqrt((1 - u) * (p - o) * (p - m));
}

export interface SimNode {
  id: string;
  fixed?: number; // duração determinística (dias úteis)
  o?: number;
  m?: number;
  p?: number;
}

export interface MonteCarloResult {
  iterations: number;
  seed: number;
  mean: number;
  min: number;
  max: number;
  p50: number;
  p80: number;
  p95: number;
  histogram: { from: number; to: number; count: number }[];
  stochasticTasks: number;
  fixedTasks: number;
}

export function percentile(sorted: number[], q: number): number {
  if (sorted.length === 0) return NaN;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1));
  return sorted[idx];
}

/** Monte Carlo sobre a rede de dependências: a cada iteração sorteia durações e calcula a duração do projeto por CPM. */
export function monteCarlo(nodes: SimNode[], edges: CpmEdge[], iterations: number, seed: number): MonteCarloResult {
  if (iterations < 100 || iterations > 50000) throw new Error('Iterações devem estar entre 100 e 50.000.');
  const ids = nodes.map((n) => n.id);
  topologicalOrder(ids, edges); // valida ciclos antes de simular
  const rand = mulberry32(seed);
  const results: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const sampled = nodes.map((n) => ({
      id: n.id,
      duration:
        n.o !== undefined && n.m !== undefined && n.p !== undefined ? triangular(n.o, n.m, n.p, rand()) : n.fixed ?? 0,
    }));
    results.push(computeCpm(sampled, edges).projectDuration);
  }
  results.sort((a, b) => a - b);
  const min = results[0];
  const max = results[results.length - 1];
  const bins = 12;
  const width = (max - min) / bins || 1;
  const histogram = Array.from({ length: bins }, (_, b) => ({
    from: round1(min + b * width),
    to: round1(min + (b + 1) * width),
    count: 0,
  }));
  for (const r of results) histogram[Math.min(bins - 1, Math.floor((r - min) / width))].count++;
  return {
    iterations,
    seed,
    mean: round1(results.reduce((s, r) => s + r, 0) / results.length),
    min: round1(min),
    max: round1(max),
    p50: round1(percentile(results, 0.5)),
    p80: round1(percentile(results, 0.8)),
    p95: round1(percentile(results, 0.95)),
    histogram,
    stochasticTasks: nodes.filter((n) => n.o !== undefined).length,
    fixedTasks: nodes.filter((n) => n.o === undefined).length,
  };
}

const round1 = (v: number) => Math.round(v * 10) / 10;
