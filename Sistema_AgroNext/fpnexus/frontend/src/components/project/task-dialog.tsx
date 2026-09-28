'use client';

import * as React from 'react';
import Link from 'next/link';
import { Trash2 } from 'lucide-react';
import { api, del, patch, post } from '@/lib/api';
import { fmtDateTime } from '@/lib/format';
import { options } from '@/lib/labels';
import { taskFields } from '@/lib/fields';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label, Select, Textarea } from '@/components/ui/input';
import { EntityForm, Field } from '@/components/entity-form';
import { ErrorBox, Loading } from '@/components/common';
import { ROLES, useSession } from '@/components/session';

export function TaskDialog({
  open,
  onClose,
  projectId,
  taskId,
  tasks,
  onSaved,
  defaults,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  taskId: string | null;
  tasks: any[];
  onSaved: () => void;
  defaults?: Record<string, unknown>;
}) {
  const { can, memberName, me } = useSession();
  const [task, setTask] = React.useState<any | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [pred, setPred] = React.useState('');
  const [comment, setComment] = React.useState('');
  const manage = can(ROLES.MANAGE);

  const load = React.useCallback(async () => {
    if (!taskId) return setTask(null);
    try {
      setTask(await api(`/tasks/${taskId}`));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [taskId]);

  React.useEffect(() => {
    setError(null);
    load();
  }, [load, open]);

  const fields: Field[] = [
    ...taskFields.slice(0, 2),
    {
      name: 'parentId',
      label: 'Tarefa-mãe (pacote de trabalho)',
      type: 'select',
      options: tasks.filter((t) => t.id !== taskId).map((t) => ({ value: t.id, label: `${t.wbsCode ? `${t.wbsCode} ` : ''}${t.title}` })),
    },
    ...taskFields.slice(2),
  ];

  const byId = new Map(tasks.map((t) => [t.id, t]));
  const act = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
      await load();
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const isAssignee = task?.assigneeId === me?.user.id;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      {open ? (
        <DialogContent title={taskId ? 'Tarefa' : 'Nova tarefa'} description={task?.project ? `${task.project.code} — ${task.project.name}` : undefined} className="max-w-3xl">
          {taskId && !task && !error ? <Loading /> : null}
          {error ? <ErrorBox message={error} /> : null}
          {(!taskId || task) && manage ? (
            <EntityForm
              key={task?.version ?? 'new'}
              fields={fields}
              row={task ?? (defaults ? { ...defaults } : null)}
              path="/tasks"
              fixed={{ projectId }}
              onCancel={onClose}
              onSaved={() => {
                onSaved();
                if (!taskId) onClose();
                else load();
              }}
            />
          ) : null}
          {task && !manage ? (
            <div className="space-y-3 text-sm">
              <p className="text-base font-semibold">{task.title}</p>
              <p className="text-muted">{task.description ?? 'Sem descrição.'}</p>
              <p>Responsável: {memberName(task.assigneeId)}</p>
              {isAssignee && can(ROLES.WORKERS) ? (
                <div className="flex flex-wrap gap-3">
                  <div>
                    <Label htmlFor="st">Status</Label>
                    <Select id="st" value={task.status} onChange={(e) => act(() => patch(`/tasks/${task.id}`, { status: e.target.value, version: task.version }))}>
                      {options('taskStatus').map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="pg">% concluído</Label>
                    <Select id="pg" value={task.progress} onChange={(e) => act(() => patch(`/tasks/${task.id}`, { progress: Number(e.target.value), version: task.version }))}>
                      {Array.from(new Set([...Array.from({ length: 11 }, (_, i) => i * 10), task.progress]))
                        .sort((a, b) => a - b)
                        .map((p) => (
                          <option key={p} value={p}>
                            {p}%
                          </option>
                        ))}
                    </Select>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-subtle">Somente leitura para o seu papel.</p>
              )}
            </div>
          ) : null}

          {task ? (
            <div className="mt-6 space-y-6 border-t border-line pt-4">
              {task.sourceAction ? (
                <p className="text-sm">
                  Origem:{' '}
                  <Link className="text-tech underline" href={`/pmo/reunioes/${task.sourceAction.meeting.id}`}>
                    ação da reunião “{task.sourceAction.meeting.title}”
                  </Link>
                </p>
              ) : null}
              <section>
                <h3 className="mb-2 text-sm font-semibold">Predecessoras (Término-Início)</h3>
                <ul className="mb-2 space-y-1 text-sm">
                  {task.predecessors.length === 0 ? <li className="text-muted">Nenhuma.</li> : null}
                  {task.predecessors.map((d: any) => (
                    <li key={d.id} className="flex items-center justify-between gap-2">
                      <span>{byId.get(d.predecessorId)?.title ?? d.predecessorId}</span>
                      {manage ? (
                        <Button size="icon" variant="ghost" aria-label="Remover dependência" onClick={() => act(() => del(`/dependencies/${d.id}`))}>
                          <Trash2 className="text-danger" aria-hidden />
                        </Button>
                      ) : null}
                    </li>
                  ))}
                </ul>
                {manage ? (
                  <div className="flex gap-2">
                    <Select aria-label="Nova predecessora" value={pred} onChange={(e) => setPred(e.target.value)}>
                      <option value="">— adicionar predecessora —</option>
                      {tasks
                        .filter((t) => t.id !== task.id && !task.predecessors.some((d: any) => d.predecessorId === t.id))
                        .map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.wbsCode ? `${t.wbsCode} ` : ''}
                            {t.title}
                          </option>
                        ))}
                    </Select>
                    <Button
                      variant="secondary"
                      disabled={!pred}
                      onClick={() =>
                        act(async () => {
                          await post(`/tasks/${task.id}/dependencies`, { predecessorId: pred });
                          setPred('');
                        })
                      }
                    >
                      Adicionar
                    </Button>
                  </div>
                ) : null}
              </section>
              <section>
                <h3 className="mb-2 text-sm font-semibold">Comentários</h3>
                <ul className="mb-2 space-y-2 text-sm">
                  {task.comments.length === 0 ? <li className="text-muted">Sem comentários.</li> : null}
                  {task.comments.map((c: any) => (
                    <li key={c.id} className="rounded-md bg-surface p-2">
                      <p className="text-xs text-subtle">
                        {memberName(c.userId)} · {fmtDateTime(c.createdAt)}
                      </p>
                      <p className="whitespace-pre-wrap">{c.body}</p>
                    </li>
                  ))}
                </ul>
                {can(ROLES.WORKERS) ? (
                  <div className="space-y-2">
                    <Textarea aria-label="Novo comentário" value={comment} onChange={(e) => setComment(e.target.value)} rows={2} placeholder="Escreva um comentário" />
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={!comment.trim()}
                      onClick={() =>
                        act(async () => {
                          await post(`/tasks/${task.id}/comments`, { body: comment });
                          setComment('');
                        })
                      }
                    >
                      Comentar
                    </Button>
                  </div>
                ) : null}
              </section>
              {manage ? (
                <div className="flex justify-end">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      if (window.confirm('Excluir esta tarefa? A exclusão fica registrada na auditoria.')) {
                        del(`/tasks/${task.id}`)
                          .then(() => {
                            onSaved();
                            onClose();
                          })
                          .catch((e) => setError((e as Error).message));
                      }
                    }}
                  >
                    <Trash2 aria-hidden /> Excluir tarefa
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
