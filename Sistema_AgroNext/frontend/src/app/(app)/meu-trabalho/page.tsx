'use client';

import Link from 'next/link';
import { patch } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { fmtDate } from '@/lib/format';
import { options } from '@/lib/labels';
import { Card, CardContent } from '@/components/ui/card';
import { Select } from '@/components/ui/input';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { Empty, ErrorBox, Loading, PageHeader, StatusBadge } from '@/components/common';
import * as React from 'react';

export default function MyWorkPage() {
  const { data, error, loading, reload } = useApi<any[]>('/my-work');
  const [err, setErr] = React.useState<string | null>(null);

  async function change(t: any, body: Record<string, unknown>) {
    setErr(null);
    try {
      await patch(`/tasks/${t.id}`, { ...body, version: t.version });
      await reload();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <>
      <PageHeader title="Meu Trabalho" description="Tarefas não concluídas atribuídas a você, por prioridade e prazo. É a mesma tarefa exibida no Kanban e no Gantt do projeto." />
      {err ? <ErrorBox message={err} /> : null}
      <Card>
        <CardContent className="p-0">
          {loading && !data ? <Loading /> : null}
          {error ? <ErrorBox message={error} onRetry={reload} /> : null}
          {data && data.length === 0 ? (
            <div className="p-4">
              <Empty text="Você não tem tarefas pendentes." />
            </div>
          ) : null}
          {data && data.length > 0 ? (
            <Table>
              <THead>
                <tr>
                  <TH>Tarefa</TH>
                  <TH>Projeto</TH>
                  <TH>Prioridade</TH>
                  <TH>Prazo</TH>
                  <TH>Status</TH>
                  <TH>Avanço</TH>
                </tr>
              </THead>
              <TBody>
                {data.map((t) => (
                  <TR key={t.id}>
                    <TD>
                      <Link className="font-medium hover:text-tech" href={`/projetos/${t.projectId}?tarefa=${t.id}`}>
                        {t.title}
                      </Link>
                      {t.sourceActionId ? <p className="text-xs text-subtle">Originada de ata de reunião</p> : null}
                    </TD>
                    <TD className="text-muted">{t.project.code}</TD>
                    <TD>
                      <StatusBadge group="priority" value={t.priority} />
                    </TD>
                    <TD className={t.overdue ? 'font-semibold text-danger' : ''}>
                      {t.endDate ? fmtDate(t.endDate) : 'Não agendada'}
                      {t.overdue ? ' (atrasada)' : ''}
                    </TD>
                    <TD>
                      <Select aria-label={`Status de ${t.title}`} value={t.status} onChange={(e) => change(t, { status: e.target.value })} className="w-40">
                        {options('taskStatus').map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </Select>
                    </TD>
                    <TD>
                      <Select aria-label={`Avanço de ${t.title}`} value={t.progress} onChange={(e) => change(t, { progress: Number(e.target.value) })} className="w-24">
                        {Array.from(new Set([...Array.from({ length: 11 }, (_, i) => i * 10), t.progress]))
                          .sort((a, b) => a - b)
                          .map((p) => (
                            <option key={p} value={p}>
                              {p}%
                            </option>
                          ))}
                      </Select>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          ) : null}
        </CardContent>
      </Card>
      <p className="mt-3 text-xs text-subtle">
        <StatusBadge group="taskStatus" value="CONCLUIDA" /> Ao concluir uma tarefa originada de ata, a ação correspondente é marcada como concluída na Sala de Reuniões.
      </p>
    </>
  );
}
