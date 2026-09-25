'use client';

import * as React from 'react';
import { del, post } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { fmtDate, fmtNumber, todayIso } from '@/lib/format';
import { REF } from '@/lib/fields';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { Empty, ErrorBox, Loading, Notice, PageHeader, StatusBadge } from '@/components/common';
import { EntityForm } from '@/components/entity-form';
import { ROLES, useSession } from '@/components/session';

function shift(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function TimesheetPage() {
  const { can, me } = useSession();
  const [from, setFrom] = React.useState(shift(todayIso(), -13));
  const [to, setTo] = React.useState(todayIso());
  const mine = useApi<any>(me ? `/timesheet?userId=${me.user.id}&from=${from}&to=${to}` : null);
  const pending = useApi<any>(can(ROLES.MANAGE) ? '/timesheet?status=SUBMETIDO' : null);
  const [creating, setCreating] = React.useState(false);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [reasons, setReasons] = React.useState<Record<string, string>>({});
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setMsg(null);
    try {
      await fn();
      setMsg({ ok: true, text: ok });
      setSelected(new Set());
      mine.reload();
      pending.reload();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  };

  const rows: any[] = mine.data?.rows ?? [];
  const total = rows.reduce((s, r) => s + Number(r.hours), 0);

  return (
    <>
      <PageHeader
        title="Timesheet"
        description="Apontamento de horas por projeto e tarefa: rascunho → submetido → aprovado ou rejeitado. Quem aponta não aprova o próprio apontamento."
        actions={can(ROLES.WORKERS) ? <Button onClick={() => setCreating(true)}>Apontar horas</Button> : null}
      />
      {mine.data?.lockedUntil ? <Notice kind="warning" className="mb-4">Apontamentos bloqueados até {fmtDate(mine.data.lockedUntil)}.</Notice> : null}
      {mine.data ? <Notice className="mb-4">{mine.data.overtimePolicy}</Notice> : null}
      {msg ? msg.ok ? <Notice kind="success" className="mb-4">{msg.text}</Notice> : <div className="mb-4"><ErrorBox message={msg.text} /></div> : null}

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Minhas horas</CardTitle>
            <CardDescription>Total no período: {fmtNumber(total)} h</CardDescription>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs text-muted">
              De
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
            </label>
            <label className="text-xs text-muted">
              Até
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
            </label>
            <Button variant="outline" disabled={selected.size === 0} onClick={() => run(() => post('/timesheet/submit', { ids: [...selected] }), 'Apontamentos submetidos para aprovação.')}>
              Submeter selecionados ({selected.size})
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {mine.loading && !mine.data ? <Loading /> : null}
          {mine.error ? <ErrorBox message={mine.error} /> : null}
          {mine.data && rows.length === 0 ? (
            <div className="p-4">
              <Empty text="Nenhum apontamento no período." />
            </div>
          ) : null}
          {rows.length ? (
            <Table>
              <THead>
                <tr>
                  <TH className="w-8">
                    <span className="sr-only">Selecionar</span>
                  </TH>
                  <TH>Data</TH>
                  <TH>Projeto</TH>
                  <TH>Descrição</TH>
                  <TH className="text-right">Horas</TH>
                  <TH>Situação</TH>
                  <TH />
                </tr>
              </THead>
              <TBody>
                {rows.map((r) => {
                  const editable = r.status === 'RASCUNHO' || r.status === 'REJEITADO';
                  return (
                    <TR key={r.id}>
                      <TD>
                        {editable ? (
                          <input
                            type="checkbox"
                            aria-label={`Selecionar apontamento de ${fmtDate(r.date)}`}
                            checked={selected.has(r.id)}
                            onChange={(e) =>
                              setSelected((s) => {
                                const n = new Set(s);
                                if (e.target.checked) n.add(r.id);
                                else n.delete(r.id);
                                return n;
                              })
                            }
                          />
                        ) : null}
                      </TD>
                      <TD>{fmtDate(r.date)}</TD>
                      <TD>{r.projectName}</TD>
                      <TD>
                        {r.description ?? '—'}
                        {r.rejectReason ? <p className="text-xs text-danger">Rejeitado: {r.rejectReason}</p> : null}
                      </TD>
                      <TD className="text-right tabular-nums">{fmtNumber(r.hours)}</TD>
                      <TD>
                        <StatusBadge group="timeStatus" value={r.status} />
                      </TD>
                      <TD className="text-right">
                        {editable ? (
                          <Button size="sm" variant="ghost" onClick={() => run(() => del(`/timesheet/${r.id}`), 'Apontamento excluído.')}>
                            Excluir
                          </Button>
                        ) : null}
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          ) : null}
        </CardContent>
      </Card>

      {can(ROLES.MANAGE) ? (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Aguardando aprovação</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {pending.data?.rows.length === 0 ? (
              <div className="p-4">
                <Empty text="Nada aguardando aprovação." />
              </div>
            ) : null}
            {pending.data?.rows.length ? (
              <Table>
                <THead>
                  <tr>
                    <TH>Pessoa</TH>
                    <TH>Data</TH>
                    <TH>Projeto</TH>
                    <TH className="text-right">Horas</TH>
                    <TH>Decisão</TH>
                  </tr>
                </THead>
                <TBody>
                  {pending.data.rows.map((r: any) => (
                    <TR key={r.id}>
                      <TD>{r.userName}</TD>
                      <TD>{fmtDate(r.date)}</TD>
                      <TD>
                        {r.projectName}
                        {r.description ? <p className="text-xs text-muted">{r.description}</p> : null}
                      </TD>
                      <TD className="text-right tabular-nums">{fmtNumber(r.hours)}</TD>
                      <TD>
                        {r.canDecide ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <Button size="sm" onClick={() => run(() => post(`/timesheet/${r.id}/decide`, { decision: 'APROVADO' }), 'Horas aprovadas.')}>
                              Aprovar
                            </Button>
                            <Input
                              aria-label="Motivo da rejeição"
                              placeholder="Motivo"
                              className="h-8 w-40"
                              value={reasons[r.id] ?? ''}
                              onChange={(e) => setReasons((s) => ({ ...s, [r.id]: e.target.value }))}
                            />
                            <Button size="sm" variant="destructive" onClick={() => run(() => post(`/timesheet/${r.id}/decide`, { decision: 'REJEITADO', reason: reasons[r.id] || undefined }), 'Horas rejeitadas.')}>
                              Rejeitar
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-subtle">Seu próprio apontamento</span>
                        )}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Dialog open={creating} onOpenChange={setCreating}>
        {creating ? (
          <DialogContent title="Apontar horas">
            <EntityForm
              path="/timesheet"
              fields={[
                { name: 'projectId', label: 'Projeto', type: 'ref', ref: REF.project, required: true },
                { name: 'date', label: 'Data', type: 'date', required: true, defaultValue: todayIso() },
                { name: 'hours', label: 'Horas', type: 'decimal', required: true, placeholder: '8' },
                { name: 'description', label: 'Descrição', type: 'textarea' },
              ]}
              onCancel={() => setCreating(false)}
              onSaved={() => {
                setCreating(false);
                mine.reload();
              }}
            />
          </DialogContent>
        ) : null}
      </Dialog>
    </>
  );
}
