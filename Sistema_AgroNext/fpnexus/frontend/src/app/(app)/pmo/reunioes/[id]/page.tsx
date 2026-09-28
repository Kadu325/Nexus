'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { CheckCircle2, Sparkles, Trash2, Wand2 } from 'lucide-react';
import { ApiError, del, patch, post } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { fmtDate, fmtDateTime } from '@/lib/format';
import { label } from '@/lib/labels';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Label, Select, Textarea } from '@/components/ui/input';
import { Empty, ErrorBox, Loading, Notice, PageHeader, StatusBadge } from '@/components/common';
import { ROLES, useSession } from '@/components/session';

function ActionRow({ a, onDone, manage }: { a: any; onDone: (msg: string | null, err?: string) => void; manage: boolean }) {
  const { members } = useSession();
  const [assigneeId, setAssignee] = React.useState<string>(a.assigneeId ?? '');
  const [dueDate, setDue] = React.useState<string>(a.dueDate ? a.dueDate.slice(0, 10) : '');
  const editable = manage && (a.status === 'EM_REVISAO' || a.status === 'VALIDADA');
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      onDone(ok);
    } catch (e) {
      onDone(null, (e as Error).message);
    }
  };
  return (
    <li className="rounded-lg border border-line bg-white p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-ink">
            {a.status === 'CONCLUIDA' ? <CheckCircle2 className="mr-1 inline size-4 text-success" aria-hidden /> : null}
            {a.description}
          </p>
          {a.rawText ? <p className="text-xs text-subtle">Texto original: “{a.rawText}”</p> : null}
        </div>
        <StatusBadge group="action" value={a.status} />
      </div>
      {a.issues?.length && a.status === 'EM_REVISAO' ? (
        <ul className="mt-2 space-y-1 text-xs text-warning">
          {a.issues.map((i: string) => (
            <li key={i}>• {i}</li>
          ))}
        </ul>
      ) : null}
      {a.candidates?.length > 0 && a.status === 'EM_REVISAO' ? (
        <p className="mt-1 text-xs text-muted">Possíveis responsáveis: {a.candidates.map((c: any) => c.name).join(', ')}</p>
      ) : null}
      {a.dueDateRaw && a.status === 'EM_REVISAO' ? (
        <p className="text-xs text-muted">
          Prazo citado: {a.dueDateRaw}
          {a.suggestedDueDate ? ` (sugestão a confirmar: ${fmtDate(a.suggestedDueDate)})` : ''}
        </p>
      ) : null}
      {editable ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_180px_auto]">
          <div>
            <Label htmlFor={`as-${a.id}`} className="text-xs">
              Responsável (confirmar a pessoa)
            </Label>
            <Select id={`as-${a.id}`} value={assigneeId} onChange={(e) => setAssignee(e.target.value)}>
              <option value="">— selecione —</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                  {a.candidateIds?.includes(m.id) ? ' (citado)' : ''}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor={`dd-${a.id}`} className="text-xs">
              Prazo (dia, mês e ano)
            </Label>
            <Input id={`dd-${a.id}`} type="date" value={dueDate} onChange={(e) => setDue(e.target.value)} />
          </div>
          <div className="flex items-end gap-1">
            <Button size="sm" variant="secondary" onClick={() => run(() => patch(`/actions/${a.id}`, { assigneeId: assigneeId || null, dueDate: dueDate || null }), 'Ação atualizada.')}>
              Salvar
            </Button>
            {a.suggestedDueDate && !dueDate ? (
              <Button size="sm" variant="ghost" onClick={() => setDue(a.suggestedDueDate.slice(0, 10))}>
                Usar sugestão
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted">
          Responsável: {a.assigneeName ?? '—'} · Prazo: {a.dueDate ? fmtDate(a.dueDate) : '—'}
          {a.completedAt ? ` · Concluída em ${fmtDate(a.completedAt)} por ${a.completedByName ?? '—'}` : ''}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {manage && a.status === 'EM_REVISAO' ? (
          <Button size="sm" onClick={() => run(() => post(`/actions/${a.id}/validate`), 'Ação validada.')}>
            Validar
          </Button>
        ) : null}
        {manage && a.status === 'VALIDADA' ? (
          <Button size="sm" onClick={() => run(() => post(`/actions/${a.id}/convert`), 'Tarefa criada; ela aparece no Kanban, em Meu Trabalho e no Gantt quando agendada.')}>
            Criar tarefa
          </Button>
        ) : null}
        {manage && (a.status === 'EM_REVISAO' || a.status === 'VALIDADA') ? (
          <Button size="sm" variant="ghost" onClick={() => run(() => post(`/actions/${a.id}/discard`), 'Ação descartada.')}>
            Descartar
          </Button>
        ) : null}
        {a.taskId ? (
          <Link href={`/meu-trabalho`} className="text-sm text-tech underline">
            Tarefa vinculada
          </Link>
        ) : null}
      </div>
    </li>
  );
}

export default function WarRoomPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = useSession();
  const manage = can(ROLES.MANAGE);
  const room = useApi<any>(`/meetings/${id}/room`);
  const ai = useApi<any>('/ai/status');
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null);
  const [notes, setNotes] = React.useState<string | null>(null);
  const [decision, setDecision] = React.useState('');
  const [newAction, setNewAction] = React.useState('');
  const [ata, setAta] = React.useState<string | null>(null);
  const [ataAi, setAtaAi] = React.useState(false);
  const [aiBusy, setAiBusy] = React.useState(false);

  const done = (ok: string | null, err?: string) => {
    setMsg(ok ? { ok: true, text: ok } : { ok: false, text: err ?? 'Erro' });
    room.reload();
  };
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      done(ok);
    } catch (e) {
      done(null, (e as Error).message);
    }
  };

  if (room.error) return <ErrorBox message={room.error} onRetry={room.reload} />;
  if (!room.data) return <Loading />;
  const { meeting, project, decisions, actions, conversionPolicy } = room.data;
  const versions: any[] = room.data.ata?.versions ?? [];
  const draft = versions.find((v) => v.status === 'RASCUNHO' || v.status === 'REJEITADO');
  const pending = versions.find((v) => v.status === 'EM_APROVACAO');
  const ataText = ata ?? draft?.content ?? '';

  async function generate(feature: string) {
    setAiBusy(true);
    setMsg(null);
    try {
      const r = await post('/ai/generate', { feature, meetingId: id });
      if (feature === 'ATA') {
        setAta(r.draft);
        setAtaAi(true);
        setMsg({ ok: true, text: `Rascunho gerado por IA (${r.model}). Revise antes de salvar. Fonte: ${r.sources.map((s: any) => s.label).join(', ')}.` });
      } else {
        setAta((prev) => `${prev ?? draft?.content ?? ''}\n\n${r.draft}`.trim());
        setAtaAi(true);
        setMsg({ ok: true, text: 'Texto gerado por IA acrescentado ao rascunho da ata. Revise antes de salvar.' });
      }
    } catch (e) {
      setMsg({ ok: false, text: e instanceof ApiError ? e.message : 'Falha ao gerar.' });
    } finally {
      setAiBusy(false);
    }
  }

  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/pmo/reunioes" className="text-tech hover:underline">
          Sala de Reuniões
        </Link>{' '}
        ›{' '}
        <Link href={`/projetos/${project.id}`} className="text-tech hover:underline">
          {project.code}
        </Link>
      </p>
      <PageHeader title={meeting.title} description={`${label('meetingType', meeting.type)} · ${fmtDateTime(meeting.scheduledAt)}${meeting.location ? ` · ${meeting.location}` : ''}`} />
      {msg ? msg.ok ? <Notice kind="success" className="mb-4">{msg.text}</Notice> : <div className="mb-4"><ErrorBox message={msg.text} /></div> : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Anotações</CardTitle>
              <CardDescription>Base para extração de ações e para a ata.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea aria-label="Anotações da reunião" rows={10} disabled={!manage} value={notes ?? meeting.notes ?? ''} onChange={(e) => setNotes(e.target.value)} />
            {manage ? (
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" disabled={notes === null} onClick={() => run(async () => { await patch(`/meetings/${id}`, { notes }); setNotes(null); }, 'Anotações salvas.')}>
                  Salvar anotações
                </Button>
                <Button
                  variant="outline"
                  onClick={async () => {
                    try {
                      if (notes !== null) {
                        await patch(`/meetings/${id}`, { notes });
                        setNotes(null);
                      }
                      const r = await post(`/meetings/${id}/extract-actions`);
                      done(`${r.found} ação(ões) encontrada(s): ${r.created} nova(s), ${r.skippedAsDuplicate} já existia(m).`);
                    } catch (e) {
                      done(null, (e as Error).message);
                    }
                  }}
                >
                  <Wand2 aria-hidden /> Identificar ações
                </Button>
              </div>
            ) : null}
            <p className="text-xs text-subtle">A extração é determinística (sem IA): responsável e prazo sempre passam por revisão humana.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Decisões</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {decisions.length === 0 ? <p className="text-sm text-muted">Nenhuma decisão registrada.</p> : null}
            <ul className="space-y-2">
              {decisions.map((d: any) => (
                <li key={d.id} className="flex items-start justify-between gap-2 rounded-md bg-surface p-2 text-sm">
                  <span>{d.description}</span>
                  {manage ? (
                    <Button size="icon" variant="ghost" aria-label="Excluir decisão" onClick={() => run(() => del(`/decisions/${d.id}`), 'Decisão excluída.')}>
                      <Trash2 className="text-danger" aria-hidden />
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
            {manage ? (
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  run(async () => {
                    await post(`/meetings/${id}/decisions`, { description: decision });
                    setDecision('');
                  }, 'Decisão registrada.');
                }}
              >
                <Input aria-label="Nova decisão" value={decision} onChange={(e) => setDecision(e.target.value)} placeholder="Registrar decisão" required />
                <Button type="submit" variant="secondary">
                  Adicionar
                </Button>
              </form>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <div>
            <CardTitle>Ações</CardTitle>
            <CardDescription>{conversionPolicy.rule}</CardDescription>
          </div>
          <Badge tone={conversionPolicy.allowed ? 'success' : 'warning'}>
            {conversionPolicy.ataApproved ? 'Ata aprovada' : conversionPolicy.autoPolicy ? 'Automação autorizada no projeto' : 'Aguardando aprovação da ata'}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-3">
          {actions.length === 0 ? <Empty text="Nenhuma ação. Use “Identificar ações” ou adicione manualmente." /> : null}
          <ul className="space-y-3">
            {actions.map((a: any) => (
              <ActionRow key={`${a.id}-${a.status}-${a.assigneeId}-${a.dueDate}`} a={a} manage={manage} onDone={done} />
            ))}
          </ul>
          {manage ? (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                run(async () => {
                  await post(`/meetings/${id}/actions`, { description: newAction });
                  setNewAction('');
                }, 'Ação adicionada para revisão.');
              }}
            >
              <Input aria-label="Nova ação" value={newAction} onChange={(e) => setNewAction(e.target.value)} placeholder="Nova ação manual" required />
              <Button type="submit" variant="secondary">
                Adicionar ação
              </Button>
            </form>
          ) : null}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <div>
            <CardTitle>Ata</CardTitle>
            <CardDescription>Versões aprovadas são imutáveis. O status das ações acima é acompanhado separadamente do texto histórico da ata.</CardDescription>
          </div>
          {manage && ai.data ? (
            <div className="flex flex-wrap gap-2">
              {ai.data.generative.available ? (
                <>
                  <Button variant="outline" size="sm" disabled={aiBusy || !!pending} onClick={() => generate('ATA')}>
                    <Sparkles aria-hidden /> Gerar ata (IA)
                  </Button>
                  <Button variant="ghost" size="sm" disabled={aiBusy || !!pending} onClick={() => generate('RESUMO_EXECUTIVO')}>
                    Resumo executivo
                  </Button>
                  <Button variant="ghost" size="sm" disabled={aiBusy || !!pending} onClick={() => generate('RISCOS_REUNIAO')}>
                    Identificar riscos
                  </Button>
                </>
              ) : (
                <span className="text-xs text-subtle" title={ai.data.generative.reason}>
                  IA generativa indisponível
                </span>
              )}
            </div>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-4">
          {pending ? <Notice kind="warning">A versão {pending.version} está em aprovação. Aguarde a decisão para editar.</Notice> : null}
          {manage && !pending ? (
            <>
              <Textarea aria-label="Texto da ata" rows={12} value={ataText} onChange={(e) => setAta(e.target.value)} placeholder="Redija a ata ou gere um rascunho com IA." />
              {ataAi ? <p className="text-xs text-petrol-text">Contém texto gerado por IA — a versão será identificada como tal.</p> : null}
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={!ataText.trim()}
                  onClick={() =>
                    run(async () => {
                      await post(`/meetings/${id}/ata`, { content: ataText, aiGenerated: ataAi || !!draft?.aiGenerated });
                      setAta(null);
                      setAtaAi(false);
                    }, 'Rascunho da ata salvo.')
                  }
                >
                  Salvar rascunho
                </Button>
                {draft && ata === null ? (
                  <Button variant="outline" onClick={() => run(() => post('/approvals', { entityType: 'DOCUMENTO', entityId: draft.id }), 'Ata enviada para aprovação.')}>
                    Submeter versão {draft.version} para aprovação
                  </Button>
                ) : null}
              </div>
            </>
          ) : null}
          <div>
            <h3 className="mb-2 text-sm font-semibold">Histórico de versões</h3>
            {versions.length === 0 ? <p className="text-sm text-muted">Nenhuma versão.</p> : null}
            <ul className="space-y-3">
              {versions.map((v) => (
                <li key={v.id} className="rounded-lg border border-line p-3">
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
                    <strong>Versão {v.version}</strong>
                    <StatusBadge group="approval" value={v.status} />
                    {v.aiGenerated ? <Badge tone="demo">gerada com IA</Badge> : null}
                    <span className="text-xs text-subtle">
                      criada {fmtDateTime(v.createdAt)}
                      {v.approvedAt ? ` · aprovada por ${v.approvedByName} em ${fmtDateTime(v.approvedAt)}` : ''}
                    </span>
                  </div>
                  {v.status === 'APROVADO' || v.status === 'EM_APROVACAO' ? (
                    <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded bg-surface p-3 font-sans text-sm">{v.content}</pre>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
