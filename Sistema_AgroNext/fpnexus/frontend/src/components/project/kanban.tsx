'use client';

import * as React from 'react';
import { ApiError, patch } from '@/lib/api';
import { fmtDate } from '@/lib/format';
import { L } from '@/lib/labels';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ErrorBox, StatusBadge } from '@/components/common';
import { ROLES, useSession } from '@/components/session';

const COLUMNS = ['A_FAZER', 'EM_ANDAMENTO', 'EM_REVISAO', 'CONCLUIDA'] as const;

/**
 * Kanban com arrastar e soltar (HTML5) e alternativa por teclado (seletor de coluna em cada cartão).
 * O limite WIP é validado pela API; exceder exige confirmação explícita e fica auditado.
 */
export function Kanban({ tasks, wipLimits, onChanged, onOpen }: { tasks: any[]; wipLimits: Record<string, number>; onChanged: () => void; onOpen: (id: string) => void }) {
  const { can, me, memberName } = useSession();
  const [error, setError] = React.useState<string | null>(null);
  const [over, setOver] = React.useState<string | null>(null);
  const canMove = (t: any) => can(ROLES.MANAGE) || (me?.role === 'MEMBRO' && t.assigneeId === me.user.id);

  async function move(task: any, status: string, overrideWip = false) {
    if (task.status === status) return;
    setError(null);
    try {
      await patch(`/tasks/${task.id}`, { status, version: task.version, ...(overrideWip ? { overrideWip: true } : {}) });
      onChanged();
    } catch (e) {
      if (e instanceof ApiError && e.body?.code === 'WIP_LIMIT') {
        if (window.confirm(`${e.message} Deseja exceder o limite? A exceção ficará registrada na auditoria.`)) return move(task, status, true);
        return;
      }
      setError((e as Error).message);
      onChanged();
    }
  }

  return (
    <div>
      {error ? <ErrorBox message={error} /> : null}
      <div className="mt-2 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((col) => {
          const items = tasks.filter((t) => t.status === col);
          const limit = wipLimits?.[col];
          const exceeded = limit ? items.length > limit : false;
          return (
            <section
              key={col}
              aria-label={`Coluna ${L.taskStatus[col]}`}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(col);
              }}
              onDragLeave={() => setOver(null)}
              onDrop={(e) => {
                e.preventDefault();
                setOver(null);
                const id = e.dataTransfer.getData('text/plain');
                const t = tasks.find((x) => x.id === id);
                if (t) move(t, col);
              }}
              className={cn('flex min-h-64 flex-col rounded-lg border border-line bg-surface p-2', over === col && 'border-agro ring-2 ring-agro/40')}
            >
              <header className="mb-2 flex items-center justify-between px-1">
                <h3 className="text-sm font-semibold text-ink">{L.taskStatus[col]}</h3>
                <Badge tone={exceeded ? 'danger' : 'neutral'}>
                  {items.length}
                  {limit ? ` / WIP ${limit}` : ''}
                </Badge>
              </header>
              <ul className="flex flex-1 flex-col gap-2">
                {items.map((t) => (
                  <li
                    key={t.id}
                    draggable={canMove(t)}
                    onDragStart={(e) => e.dataTransfer.setData('text/plain', t.id)}
                    className={cn('rounded-md border border-line bg-white p-3 shadow-sm', canMove(t) && 'cursor-grab active:cursor-grabbing')}
                  >
                    <button className="w-full text-left text-sm font-medium text-ink hover:text-tech" onClick={() => onOpen(t.id)}>
                      {t.wbsCode ? <span className="text-subtle">{t.wbsCode} </span> : null}
                      {t.title}
                    </button>
                    <div className="mt-2 flex flex-wrap items-center gap-1 text-xs text-muted">
                      <StatusBadge group="priority" value={t.priority} />
                      <span>{memberName(t.assigneeId)}</span>
                      <span>· {t.endDate ? fmtDate(t.endDate) : 'não agendada'}</span>
                      {t.sourceActionId ? <Badge tone="info">ata</Badge> : null}
                    </div>
                    {t.progress > 0 && t.status !== 'CONCLUIDA' ? (
                      <div className="mt-2 h-1.5 rounded-full bg-surface" aria-label={`Avanço ${t.progress}%`}>
                        <div className="h-1.5 rounded-full bg-agro" style={{ width: `${t.progress}%` }} />
                      </div>
                    ) : null}
                    {canMove(t) ? (
                      <label className="mt-2 block text-xs text-subtle">
                        <span className="sr-only">Mover para</span>
                        <select
                          className="mt-1 w-full rounded border border-line bg-white px-1 py-0.5 text-xs"
                          value={t.status}
                          onChange={(e) => move(t, e.target.value)}
                          aria-label={`Mover ${t.title} para outra coluna`}
                        >
                          {COLUMNS.map((c) => (
                            <option key={c} value={c}>
                              {L.taskStatus[c]}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
