/**
 * Método do Caminho Crítico (CPM) com dependências Término-Início sem defasagem.
 * Durações em dias úteis. Tarefa crítica = folga total igual a zero.
 */
export interface CpmNode {
  id: string;
  duration: number;
}
export interface CpmEdge {
  from: string; // predecessora
  to: string; // sucessora
}
export interface CpmResult {
  projectDuration: number;
  nodes: Record<string, { es: number; ef: number; ls: number; lf: number; float: number; critical: boolean }>;
  criticalPath: string[];
}

export class CycleError extends Error {
  constructor(public readonly involved: string[]) {
    super('As dependências formam um ciclo.');
  }
}

export function topologicalOrder(ids: string[], edges: CpmEdge[]): string[] {
  const indeg = new Map<string, number>(ids.map((id) => [id, 0]));
  const succ = new Map<string, string[]>(ids.map((id) => [id, []]));
  for (const e of edges) {
    if (!indeg.has(e.from) || !indeg.has(e.to)) continue;
    succ.get(e.from)!.push(e.to);
    indeg.set(e.to, indeg.get(e.to)! + 1);
  }
  const queue = ids.filter((id) => indeg.get(id) === 0);
  const order: string[] = [];
  while (queue.length) {
    const n = queue.shift()!;
    order.push(n);
    for (const s of succ.get(n)!) {
      indeg.set(s, indeg.get(s)! - 1);
      if (indeg.get(s) === 0) queue.push(s);
    }
  }
  if (order.length !== ids.length) {
    throw new CycleError(ids.filter((id) => !order.includes(id)));
  }
  return order;
}

/** Verifica se adicionar a aresta cria ciclo. */
export function wouldCreateCycle(ids: string[], edges: CpmEdge[], candidate: CpmEdge): boolean {
  if (candidate.from === candidate.to) return true;
  try {
    topologicalOrder(ids, [...edges, candidate]);
    return false;
  } catch (e) {
    if (e instanceof CycleError) return true;
    throw e;
  }
}

export function computeCpm(nodes: CpmNode[], edges: CpmEdge[]): CpmResult {
  const ids = nodes.map((n) => n.id);
  const dur = new Map(nodes.map((n) => [n.id, Math.max(0, n.duration)]));
  const valid = edges.filter((e) => dur.has(e.from) && dur.has(e.to));
  const order = topologicalOrder(ids, valid);
  const preds = new Map<string, string[]>(ids.map((id) => [id, []]));
  const succs = new Map<string, string[]>(ids.map((id) => [id, []]));
  for (const e of valid) {
    preds.get(e.to)!.push(e.from);
    succs.get(e.from)!.push(e.to);
  }
  const es = new Map<string, number>();
  const ef = new Map<string, number>();
  for (const id of order) {
    const start = Math.max(0, ...preds.get(id)!.map((p) => ef.get(p)!));
    es.set(id, start);
    ef.set(id, start + dur.get(id)!);
  }
  const projectDuration = Math.max(0, ...ids.map((id) => ef.get(id)!));
  const ls = new Map<string, number>();
  const lf = new Map<string, number>();
  for (const id of [...order].reverse()) {
    const s = succs.get(id)!;
    const finish = s.length ? Math.min(...s.map((x) => ls.get(x)!)) : projectDuration;
    lf.set(id, finish);
    ls.set(id, finish - dur.get(id)!);
  }
  const result: CpmResult['nodes'] = {};
  for (const id of ids) {
    const float = Math.round((ls.get(id)! - es.get(id)!) * 1000) / 1000;
    result[id] = { es: es.get(id)!, ef: ef.get(id)!, ls: ls.get(id)!, lf: lf.get(id)!, float, critical: float === 0 };
  }
  const criticalPath = order.filter((id) => result[id].critical);
  return { projectDuration, nodes: result, criticalPath };
}
