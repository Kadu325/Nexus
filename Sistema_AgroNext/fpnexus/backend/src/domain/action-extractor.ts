import { createHash } from 'node:crypto';

/**
 * Extrator determinístico de ações em anotações de reunião (sistema.md, Prioridade 5 e B19).
 * Nunca atribui responsável automaticamente: apenas sugere candidatos. Datas sem ano ficam pendentes.
 */
export interface Person {
  id: string;
  name: string;
}

export interface ExtractedAction {
  fingerprint: string;
  description: string;
  rawText: string;
  candidateIds: string[];
  dueDateRaw: string | null;
  suggestedDueDate: string | null; // AAAA-MM-DD, somente sugestão
  issues: string[];
}

export const ISSUE = {
  RESPONSAVEL_NAO_IDENTIFICADO: 'Responsável não identificado no texto.',
  RESPONSAVEL_SEM_CADASTRO: 'Nenhum usuário da organização corresponde ao nome citado.',
  RESPONSAVEL_AMBIGUO: 'Mais de um usuário corresponde ao nome citado.',
  RESPONSAVEL_SO_PRIMEIRO_NOME: 'Nome citado apenas pelo primeiro nome: confirme a pessoa.',
  PRAZO_AUSENTE: 'Prazo não informado.',
  PRAZO_SEM_ANO: 'Prazo sem ano: confirme o ano e o fuso da organização.',
  PRAZO_INVALIDO: 'Data de prazo inválida.',
} as const;

export function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function fingerprint(meetingId: string, text: string): string {
  return createHash('sha256').update(`${meetingId}|${normalize(text)}`).digest('hex').slice(0, 32);
}

const RE_DEVERA =
  /^(?:[-*•]\s*)?(?<name>[A-ZÀ-Ý][\p{L}'-]+(?:\s+(?:d[aeo]s?\s+)?[A-ZÀ-Ý][\p{L}'-]+)*)\s+dever[aá]\s+(?<what>.+?)(?:\s+at[eé]\s+(?:o\s+dia\s+)?(?<d>\d{1,2})\/(?<m>\d{1,2})(?:\/(?<y>\d{2,4}))?)?\s*[.;]?$/u;
const RE_ACAO = /^(?:[-*•]\s*)?a[çc][ãa]o\s*:\s*(?<body>.+)$/iu;
const RE_RESP = /respons[aá]vel\s*:\s*(?<name>[^;,.]+)/iu;
const RE_PRAZO = /prazo\s*:\s*(?<d>\d{1,2})\/(?<m>\d{1,2})(?:\/(?<y>\d{2,4}))?/iu;

export function matchPeople(nameText: string, people: Person[]): { ids: string[]; firstNameOnly: boolean } {
  const target = normalize(nameText);
  const full = people.filter((p) => normalize(p.name) === target);
  if (full.length > 0) return { ids: full.map((p) => p.id), firstNameOnly: false };
  const tokens = target.split(' ');
  const partial = people.filter((p) => {
    const pn = normalize(p.name).split(' ');
    return tokens.every((t) => pn.includes(t));
  });
  return { ids: partial.map((p) => p.id), firstNameOnly: tokens.length === 1 };
}

function buildDate(d: string, m: string, y: string | undefined, today: Date) {
  const day = Number(d);
  const month = Number(m);
  if (y) {
    const year = y.length === 2 ? 2000 + Number(y) : Number(y);
    const dt = new Date(Date.UTC(year, month - 1, day));
    if (dt.getUTCMonth() !== month - 1 || dt.getUTCDate() !== day) return { invalid: true as const };
    return { date: dt.toISOString().slice(0, 10), hasYear: true };
  }
  // sugestão: próxima ocorrência da data a partir de hoje — exige confirmação humana
  let year = today.getUTCFullYear();
  let dt = new Date(Date.UTC(year, month - 1, day));
  if (dt.getUTCMonth() !== month - 1 || dt.getUTCDate() !== day) return { invalid: true as const };
  const t0 = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  if (dt.getTime() < t0) {
    year += 1;
    dt = new Date(Date.UTC(year, month - 1, day));
  }
  return { date: dt.toISOString().slice(0, 10), hasYear: false };
}

export function extractActions(meetingId: string, notes: string, people: Person[], today = new Date()): ExtractedAction[] {
  const out: ExtractedAction[] = [];
  const seen = new Set<string>();
  for (const rawLine of notes.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    let nameText: string | null = null;
    let description: string | null = null;
    let d: string | undefined;
    let m: string | undefined;
    let y: string | undefined;

    const dev = RE_DEVERA.exec(line);
    const acao = RE_ACAO.exec(line);
    if (dev?.groups) {
      nameText = dev.groups.name;
      description = dev.groups.what.trim();
      ({ d, m, y } = dev.groups);
    } else if (acao?.groups) {
      const body = acao.groups.body;
      const inner = RE_DEVERA.exec(body);
      if (inner?.groups) {
        nameText = inner.groups.name;
        description = inner.groups.what.trim();
        ({ d, m, y } = inner.groups);
      } else {
        description = body.split(/;|\s+-\s+/)[0].trim();
        const r = RE_RESP.exec(body);
        if (r?.groups) nameText = r.groups.name.trim();
        const p = RE_PRAZO.exec(body);
        if (p?.groups) ({ d, m, y } = p.groups);
      }
    } else {
      continue;
    }

    const fp = fingerprint(meetingId, line);
    if (seen.has(fp)) continue;
    seen.add(fp);

    const issues: string[] = [];
    let candidateIds: string[] = [];
    if (!nameText) issues.push(ISSUE.RESPONSAVEL_NAO_IDENTIFICADO);
    else {
      const match = matchPeople(nameText, people);
      candidateIds = match.ids;
      if (match.ids.length === 0) issues.push(ISSUE.RESPONSAVEL_SEM_CADASTRO);
      else if (match.ids.length > 1) issues.push(ISSUE.RESPONSAVEL_AMBIGUO);
      else if (match.firstNameOnly) issues.push(ISSUE.RESPONSAVEL_SO_PRIMEIRO_NOME);
    }

    let dueDateRaw: string | null = null;
    let suggestedDueDate: string | null = null;
    if (!d || !m) issues.push(ISSUE.PRAZO_AUSENTE);
    else {
      dueDateRaw = y ? `${d}/${m}/${y}` : `${d}/${m}`;
      const built = buildDate(d, m, y, today);
      if ('invalid' in built) issues.push(ISSUE.PRAZO_INVALIDO);
      else {
        suggestedDueDate = built.date;
        if (!built.hasYear) issues.push(ISSUE.PRAZO_SEM_ANO);
      }
    }

    out.push({
      fingerprint: fp,
      description: capitalize(description ?? line),
      rawText: line,
      candidateIds,
      dueDateRaw,
      suggestedDueDate,
      issues,
    });
  }
  return out;
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
