'use client';

import * as React from 'react';
import Link from 'next/link';
import { Plus, Sparkles, Trash2 } from 'lucide-react';
import { post } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { fmtNumber } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Label, Select, Textarea } from '@/components/ui/input';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { ErrorBox, Loading, Notice, PageHeader, Stat } from '@/components/common';
import { GroupedBarChart, SERIES } from '@/components/charts';
import { ROLES, useSession } from '@/components/session';

const QUESTIONS = [
  ['PENDENTES', 'Quais atividades estão pendentes?'],
  ['DECISOES', 'Quais decisões foram tomadas?'],
  ['ATRASOS', 'Quem possui mais atrasos?'],
  ['RISCOS', 'Quais riscos estão mais críticos?'],
] as const;

function sourceLink(s: any) {
  if (s.type === 'Tarefa') return null;
  if (s.type === 'Reunião') return `/pmo/reunioes/${s.id}`;
  return null;
}

export default function AiPage() {
  const { can } = useSession();
  const status = useApi<any>('/ai/status');
  const projects = useApi<any[]>('/projects');
  const [projectId, setProjectId] = React.useState('');
  const [answer, setAnswer] = React.useState<any | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [question, setQuestion] = React.useState('');
  const [gen, setGen] = React.useState<any | null>(null);
  const [pertRows, setPertRows] = React.useState([{ name: 'Atividade 1', o: '2', m: '4', p: '8' }]);
  const [pert, setPert] = React.useState<any | null>(null);
  const [mc, setMc] = React.useState<any | null>(null);
  const [mcParams, setMcParams] = React.useState({ iterations: '5000', seed: '' });

  const guard = async (fn: () => Promise<void>) => {
    setErr(null);
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Inteligência Artificial"
        description="Copilotos com fontes identificadas, estimativas e simulações. Fatos vêm dos registros; estimativas dependem das premissas informadas; textos gerados são rascunhos para revisão."
      />
      {status.data ? (
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <Stat
            label="IA generativa"
            value={status.data.generative.available ? 'Disponível' : 'Indisponível'}
            tone={status.data.generative.available ? 'success' : 'warning'}
            hint={status.data.generative.available ? `${status.data.generative.model} · ${status.data.generative.provider}` : status.data.generative.reason}
          />
          <Stat label="Uso hoje" value={`${status.data.usedToday} / ${status.data.dailyLimit}`} hint="Limite diário da organização" />
          <Stat label="IA preditiva" value="Indisponível" hint={status.data.predictive.reason} />
        </div>
      ) : (
        <Loading />
      )}
      {err ? <div className="mb-4"><ErrorBox message={err} /></div> : null}

      <div className="mb-4 max-w-md">
        <Label htmlFor="proj">Escopo</Label>
        <Select id="proj" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          <option value="">Toda a organização</option>
          {projects.data?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.code} — {p.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Meeting Copilot</CardTitle>
              <CardDescription>Respostas por consulta estruturada aos registros, com as fontes listadas. Não usa modelo de linguagem.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {QUESTIONS.map(([k, q]) => (
                <Button key={k} variant="secondary" size="sm" disabled={busy || !can(ROLES.WORKERS)} onClick={() => guard(async () => setAnswer(await post('/ai/copilot', { question: k, projectId: projectId || null })))}>
                  {q}
                </Button>
              ))}
            </div>
            {answer ? (
              <div className="space-y-2 rounded-lg bg-surface p-3 text-sm">
                <p className="font-semibold">{answer.question}</p>
                <p>{answer.answer}</p>
                {answer.rule ? <p className="text-xs text-subtle">Regra: {answer.rule}</p> : null}
                <ul className="list-disc space-y-1 pl-5">
                  {answer.items.map((i: any, idx: number) => (
                    <li key={idx}>
                      {i.text}{' '}
                      <Badge tone="neutral" className="ml-1">
                        fonte: {sourceLink(i.source) ? <Link href={sourceLink(i.source)!} className="underline">{i.source.type}</Link> : i.source.type}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>PMO Copilot (IA generativa)</CardTitle>
              <CardDescription>Pergunta livre ou rascunho de TAP sobre um projeto. Usa apenas dados do projeto permitidos a você.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {!status.data?.generative.available ? <Notice kind="warning">{status.data?.generative.reason ?? 'Indisponível.'}</Notice> : null}
            <Textarea aria-label="Pergunta" rows={3} placeholder="Ex.: Quais entregas dependem da aquisição dos sensores?" value={question} onChange={(e) => setQuestion(e.target.value)} />
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={busy || !projectId || !question.trim() || !status.data?.generative.available}
                onClick={() => guard(async () => setGen(await post('/ai/generate', { feature: 'PERGUNTA', projectId, question })))}
              >
                <Sparkles aria-hidden /> Perguntar
              </Button>
              <Button
                variant="outline"
                disabled={busy || !projectId || !status.data?.generative.available}
                onClick={() => guard(async () => setGen(await post('/ai/generate', { feature: 'TAP_RASCUNHO', projectId })))}
              >
                Rascunho de TAP
              </Button>
            </div>
            {!projectId ? <p className="text-xs text-subtle">Selecione um projeto no escopo acima.</p> : null}
            {gen ? (
              <div className="space-y-2 rounded-lg border border-petrol/40 p-3 text-sm">
                <Badge tone="demo">Rascunho gerado por IA — revisar antes de usar</Badge>
                <pre className="whitespace-pre-wrap font-sans">{gen.draft}</pre>
                <p className="text-xs text-subtle">Fontes: {gen.sources.map((s: any) => `${s.type}: ${s.label}`).join(' · ')}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Estimativa PERT</CardTitle>
              <CardDescription>E = (O + 4M + P) / 6 · σ = (P − O) / 6. O total assume atividades em sequência e independentes.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Table>
              <THead>
                <tr>
                  <TH>Atividade</TH>
                  <TH>O</TH>
                  <TH>M</TH>
                  <TH>P</TH>
                  <TH />
                </tr>
              </THead>
              <TBody>
                {pertRows.map((r, i) => (
                  <TR key={i}>
                    {(['name', 'o', 'm', 'p'] as const).map((k) => (
                      <TD key={k}>
                        <Input
                          aria-label={`${k === 'name' ? 'Atividade' : k.toUpperCase()} da linha ${i + 1}`}
                          value={r[k]}
                          type={k === 'name' ? 'text' : 'number'}
                          min={0}
                          className={k === 'name' ? '' : 'w-20'}
                          onChange={(e) => setPertRows((rows) => rows.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)))}
                        />
                      </TD>
                    ))}
                    <TD>
                      <Button size="icon" variant="ghost" aria-label="Remover linha" onClick={() => setPertRows((rows) => rows.filter((_, j) => j !== i))}>
                        <Trash2 className="text-danger" aria-hidden />
                      </Button>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => setPertRows((r) => [...r, { name: `Atividade ${r.length + 1}`, o: '', m: '', p: '' }])}>
                <Plus aria-hidden /> Linha
              </Button>
              <Button size="sm" disabled={busy || pertRows.length === 0} onClick={() => guard(async () => setPert(await post('/ai/pert', { items: pertRows })))}>
                Calcular
              </Button>
            </div>
            {pert ? (
              <div className="rounded-lg bg-surface p-3 text-sm">
                <ul>
                  {pert.rows.map((r: any) => (
                    <li key={r.name}>
                      {r.name}: E = {fmtNumber(r.expected)} · σ = {fmtNumber(r.sd)}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 font-semibold">
                  Total: {fmtNumber(pert.total.expected)} ± {fmtNumber(pert.total.sd)} (σ)
                </p>
                <p className="text-xs text-subtle">{pert.assumption}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Simulação de Monte Carlo do prazo</CardTitle>
              <CardDescription>Sorteio triangular (O, M, P) das tarefas do projeto e duração pela rede de dependências (CPM) a cada iteração. Semente registrada para reprodução.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <Label htmlFor="it">Iterações</Label>
                <Input id="it" type="number" min={100} max={50000} className="w-28" value={mcParams.iterations} onChange={(e) => setMcParams((s) => ({ ...s, iterations: e.target.value }))} />
              </div>
              <div>
                <Label htmlFor="sd">Semente (opcional)</Label>
                <Input id="sd" type="number" min={0} className="w-32" value={mcParams.seed} onChange={(e) => setMcParams((s) => ({ ...s, seed: e.target.value }))} />
              </div>
              <Button
                disabled={busy || !projectId || !can(ROLES.MANAGE)}
                onClick={() =>
                  guard(async () =>
                    setMc(await post(`/projects/${projectId}/monte-carlo`, { iterations: Number(mcParams.iterations), ...(mcParams.seed ? { seed: Number(mcParams.seed) } : {}) })),
                  )
                }
              >
                Simular
              </Button>
            </div>
            {!projectId ? <p className="text-xs text-subtle">Selecione um projeto no escopo acima.</p> : null}
            {mc ? (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <Stat label="P50" value={`${fmtNumber(mc.p50, 1)} d`} />
                  <Stat label="P80" value={`${fmtNumber(mc.p80, 1)} d`} />
                  <Stat label="P95" value={`${fmtNumber(mc.p95, 1)} d`} />
                </div>
                <GroupedBarChart
                  data={mc.histogram.map((h: any) => ({ faixa: `${fmtNumber(h.from, 1)}–${fmtNumber(h.to, 1)}`, iteracoes: h.count }))}
                  x="faixa"
                  height={200}
                  format={(v) => fmtNumber(v, 0)}
                  series={[{ key: 'iteracoes', name: 'Iterações', color: SERIES[1] }]}
                />
                <p className="text-xs text-subtle">
                  {mc.iterations} iterações · semente {mc.seed} · {mc.stochasticTasks} tarefa(s) com estimativas, {mc.fixedTasks} com duração fixa
                  {mc.excludedTasks.length ? ` · excluídas (sem estimativa nem datas): ${mc.excludedTasks.join(', ')}` : ''}. {mc.assumptions}
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
