'use client';

import * as React from 'react';
import { api, post } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { fmtDate, fmtDateTime, fmtPct, todayIso } from '@/lib/format';
import { label, options } from '@/lib/labels';
import { REF } from '@/lib/fields';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input, Label, Select, Textarea } from '@/components/ui/input';
import { CrudSection } from '@/components/crud-section';
import { ErrorBox, Loading, Notice, PageHeader, Stat, StatusBadge } from '@/components/common';
import { ROLES, useSession } from '@/components/session';

function ControlDialog({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const { can, memberName } = useSession();
  const [data, setData] = React.useState<any | null>(null);
  const [ev, setEv] = React.useState({ description: '', reference: '', collectedAt: todayIso(), supersedesId: '' });
  const [as, setAs] = React.useState({ result: 'CONFORME', notes: '' });
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null);
  const load = React.useCallback(() => api(`/controls/${id}/detail`).then(setData), [id]);
  React.useEffect(() => {
    load().catch((e) => setMsg({ ok: false, text: e.message }));
  }, [load]);
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setMsg(null);
    try {
      await fn();
      setMsg({ ok: true, text: ok });
      await load();
      onChanged();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={data ? `${data.control.code} — ${data.control.title}` : 'Controle'} description={data ? `${data.control.framework.name} · ${label('frequency', data.control.frequency)}` : undefined} className="max-w-3xl">
        {!data ? <Loading /> : null}
        {msg ? msg.ok ? <Notice kind="success">{msg.text}</Notice> : <ErrorBox message={msg.text} /> : null}
        {data ? (
          <div className="space-y-6">
            <p className="text-sm">
              Situação atual: <StatusBadge group="result" value={data.control.lastResult} /> {data.control.lastAssessedAt ? `· avaliado em ${fmtDateTime(data.control.lastAssessedAt)}` : ''}
            </p>
            {can(ROLES.PMO) ? (
              <form
                className="grid gap-2 rounded-lg border border-line p-3 sm:grid-cols-[200px_1fr_auto]"
                onSubmit={(e) => {
                  e.preventDefault();
                  run(async () => {
                    const r = await post(`/controls/${id}/assessments`, { result: as.result, notes: as.notes || null });
                    if (r.nonConformity) setMsg({ ok: true, text: 'Avaliação registrada; não conformidade aberta automaticamente.' });
                  }, 'Avaliação registrada.');
                }}
              >
                <div>
                  <Label htmlFor="res">Resultado</Label>
                  <Select id="res" value={as.result} onChange={(e) => setAs((s) => ({ ...s, result: e.target.value }))}>
                    {options('result').map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="nt">Observações</Label>
                  <Input id="nt" value={as.notes} onChange={(e) => setAs((s) => ({ ...s, notes: e.target.value }))} />
                </div>
                <div className="flex items-end">
                  <Button type="submit">Registrar avaliação</Button>
                </div>
              </form>
            ) : null}
            <section>
              <h3 className="mb-2 text-sm font-semibold">Evidências</h3>
              <ul className="space-y-2 text-sm">
                {data.evidences.length === 0 ? <li className="text-muted">Nenhuma evidência.</li> : null}
                {data.evidences.map((e: any) => (
                  <li key={e.id} className={`rounded-md border border-line p-2 ${e.supersededById ? 'opacity-60' : ''}`}>
                    <p className="font-medium">
                      {e.description} {e.supersededById ? <span className="text-xs text-subtle">(substituída)</span> : null}
                    </p>
                    <p className="text-xs text-muted">
                      {e.reference ?? 'sem referência'} · coletada em {fmtDate(e.collectedAt)} · {memberName(e.createdById)}
                    </p>
                  </li>
                ))}
              </ul>
              {can(ROLES.MANAGE) ? (
                <form
                  className="mt-3 grid gap-2 sm:grid-cols-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    run(async () => {
                      await post(`/controls/${id}/evidences`, { ...ev, reference: ev.reference || null, supersedesId: ev.supersedesId || null });
                      setEv({ description: '', reference: '', collectedAt: todayIso(), supersedesId: '' });
                    }, 'Evidência registrada.');
                  }}
                >
                  <div className="sm:col-span-2">
                    <Label htmlFor="evd">Nova evidência</Label>
                    <Textarea id="evd" rows={2} required value={ev.description} onChange={(e) => setEv((s) => ({ ...s, description: e.target.value }))} />
                  </div>
                  <div>
                    <Label htmlFor="evr">Referência (documento ou link)</Label>
                    <Input id="evr" value={ev.reference} onChange={(e) => setEv((s) => ({ ...s, reference: e.target.value }))} />
                  </div>
                  <div>
                    <Label htmlFor="evc">Data de coleta</Label>
                    <Input id="evc" type="date" required value={ev.collectedAt} onChange={(e) => setEv((s) => ({ ...s, collectedAt: e.target.value }))} />
                  </div>
                  <div>
                    <Label htmlFor="evs">Substitui a evidência</Label>
                    <Select id="evs" value={ev.supersedesId} onChange={(e) => setEv((s) => ({ ...s, supersedesId: e.target.value }))}>
                      <option value="">— nenhuma —</option>
                      {data.evidences
                        .filter((x: any) => !x.supersededById)
                        .map((x: any) => (
                          <option key={x.id} value={x.id}>
                            {x.description.slice(0, 60)}
                          </option>
                        ))}
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button type="submit" variant="secondary">
                      Registrar evidência
                    </Button>
                  </div>
                </form>
              ) : null}
            </section>
            <section>
              <h3 className="mb-2 text-sm font-semibold">Histórico de avaliações</h3>
              <ul className="space-y-1 text-sm">
                {data.assessments.map((a: any) => (
                  <li key={a.id}>
                    {fmtDateTime(a.assessedAt)} — <StatusBadge group="result" value={a.result} /> {a.notes ? `— ${a.notes}` : ''}
                  </li>
                ))}
              </ul>
            </section>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export default function CompliancePage() {
  const { can, memberName } = useSession();
  const summary = useApi<any>('/compliance/summary');
  const [control, setControl] = React.useState<string | null>(null);
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null);

  return (
    <>
      <PageHeader
        title="Compliance Tecnológico"
        description="Frameworks, controles internos, evidências, avaliações e não conformidades. Os indicadores mostram a situação dos controles cadastrados e não constituem certificação."
      />
      {summary.data ? (
        <Card className="mb-6">
          <CardHeader>
            <div>
              <CardTitle>Conformidade por framework</CardTitle>
              <CardDescription>{summary.data.rule}</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {summary.data.perFramework.map((f: any) => (
              <Stat
                key={f.framework.id}
                label={`${f.framework.name}${f.framework.version ? ` · ${f.framework.version}` : ''}`}
                value={f.conformity === null ? 'indisponível' : fmtPct(f.conformity)}
                tone={f.conformity === null ? 'neutral' : f.conformity >= 0.8 ? 'success' : f.conformity >= 0.5 ? 'warning' : 'danger'}
                hint={`${f.conform} conformes · ${f.partial} parciais · ${f.nonConform} não conformes · ${f.notAssessed} não avaliados`}
              />
            ))}
            <Stat label="Não conformidades abertas" value={(summary.data.nonConformities.ABERTA ?? 0) + (summary.data.nonConformities.EM_TRATAMENTO ?? 0)} hint={`${summary.data.nonConformities.ENCERRADA ?? 0} encerradas`} />
          </CardContent>
        </Card>
      ) : summary.loading ? (
        <Loading />
      ) : null}
      {msg ? msg.ok ? <Notice kind="success" className="mb-4">{msg.text}</Notice> : <div className="mb-4"><ErrorBox message={msg.text} /></div> : null}
      <div className="space-y-6">
        <div className="grid gap-6 xl:grid-cols-3">
          <div className="xl:col-span-1">
            <CrudSection
              title="Frameworks"
              entityName="framework"
              path="/frameworks"
              writeRoles={ROLES.PMO}
              deleteRoles={ROLES.PMO}
              onChange={summary.reload}
              fields={[
                { name: 'name', label: 'Nome', required: true, placeholder: 'ISO/IEC 27001' },
                { name: 'version', label: 'Versão de referência', placeholder: '2022' },
              ]}
              columns={[
                { key: 'name', label: 'Framework', render: (f: any) => <span className="font-medium">{f.name}</span> },
                { key: 'version', label: 'Versão', render: (f: any) => f.version ?? '—' },
                { key: 'c', label: 'Controles', render: (f: any) => f._count?.controls ?? 0, className: 'text-right' },
              ]}
            />
          </div>
          <div className="xl:col-span-2">
            <CrudSection
              title="Controles"
              entityName="controle"
              path="/controls"
              writeRoles={ROLES.PMO}
              onChange={summary.reload}
              fields={[
                { name: 'frameworkId', label: 'Framework', type: 'ref', ref: REF.framework, required: true, createOnly: true },
                { name: 'code', label: 'Código', required: true },
                { name: 'title', label: 'Título', required: true },
                { name: 'requirementRef', label: 'Requisito de origem' },
                { name: 'frequency', label: 'Periodicidade', type: 'select', options: options('frequency') },
                { name: 'ownerId', label: 'Responsável', type: 'member' },
                { name: 'description', label: 'Descrição', type: 'textarea' },
              ]}
              columns={[
                {
                  key: 'code',
                  label: 'Controle',
                  render: (c: any) => (
                    <button className="text-left hover:text-tech" onClick={() => setControl(c.id)}>
                      <span className="font-medium">{c.code}</span> — {c.title}
                      <p className="text-xs text-muted">{c.framework?.name}</p>
                    </button>
                  ),
                },
                { key: 'freq', label: 'Periodicidade', render: (c: any) => label('frequency', c.frequency) },
                { key: 'res', label: 'Situação', render: (c: any) => <StatusBadge group="result" value={c.lastResult} /> },
                { key: 'owner', label: 'Responsável', render: (c: any) => memberName(c.ownerId) },
              ]}
              rowActions={(c: any) => (
                <Button size="sm" variant="outline" onClick={() => setControl(c.id)}>
                  Evidências e avaliação
                </Button>
              )}
            />
          </div>
        </div>
        <CrudSection
          title="Não conformidades"
          entityName="não conformidade"
          path="/non-conformities"
          writeRoles={ROLES.MANAGE}
          onChange={summary.reload}
          fields={[
            { name: 'title', label: 'Título', required: true, full: true },
            { name: 'source', label: 'Origem', type: 'select', options: options('ncSource') },
            { name: 'status', label: 'Situação', type: 'select', options: options('ncStatus').filter((o) => o.value !== 'ENCERRADA') },
            { name: 'controlId', label: 'Controle', type: 'ref', ref: REF.control },
            { name: 'projectId', label: 'Projeto', type: 'ref', ref: REF.project },
            { name: 'ownerId', label: 'Responsável', type: 'member' },
            { name: 'dueDate', label: 'Prazo', type: 'date' },
            { name: 'description', label: 'Descrição', type: 'textarea' },
            { name: 'actionPlan', label: 'Plano de ação', type: 'textarea' },
          ]}
          columns={[
            { key: 'title', label: 'Não conformidade', render: (n: any) => <span className="font-medium">{n.title}</span> },
            { key: 'src', label: 'Origem', render: (n: any) => label('ncSource', n.source) },
            { key: 'owner', label: 'Responsável', render: (n: any) => memberName(n.ownerId) },
            { key: 'due', label: 'Prazo', render: (n: any) => fmtDate(n.dueDate) },
            { key: 'st', label: 'Situação', render: (n: any) => <StatusBadge group="ncStatus" value={n.status} /> },
          ]}
          rowActions={(n: any, reload) =>
            can(ROLES.PMO) && n.status !== 'ENCERRADA' ? (
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  setMsg(null);
                  try {
                    await post(`/non-conformities/${n.id}/close`);
                    setMsg({ ok: true, text: 'Não conformidade encerrada.' });
                    reload();
                    summary.reload();
                  } catch (e) {
                    setMsg({ ok: false, text: (e as Error).message });
                  }
                }}
              >
                Encerrar
              </Button>
            ) : null
          }
        />
      </div>
      {control ? <ControlDialog id={control} onClose={() => setControl(null)} onChanged={summary.reload} /> : null}
    </>
  );
}
