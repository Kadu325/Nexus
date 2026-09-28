'use client';

import * as React from 'react';
import { Trash2 } from 'lucide-react';
import { del, post, put } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { fmtMoney, fmtPct } from '@/lib/format';
import { label, options } from '@/lib/labels';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Label, Select, Textarea } from '@/components/ui/input';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { ErrorBox, Loading, Notice, Stat, StatusBadge } from '@/components/common';
import { GroupedBarChart, SERIES } from '@/components/charts';
import { ROLES, useSession } from '@/components/session';

const CHARTER_FIELDS: [string, string, boolean][] = [
  ['objectives', 'Objetivos', true],
  ['scope', 'Escopo', true],
  ['assumptions', 'Premissas', true],
  ['constraints', 'Restrições', true],
  ['sponsor', 'Patrocinador', false],
  ['stakeholdersText', 'Stakeholders', true],
  ['budget', 'Orçamento', false],
  ['macroSchedule', 'Cronograma Macro', true],
];

export function CharterTab({ projectId }: { projectId: string }) {
  const { can } = useSession();
  const { data, error, loading, reload } = useApi<any>(`/projects/${projectId}/charter`);
  const [values, setValues] = React.useState<Record<string, string>>({});
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null);

  React.useEffect(() => {
    if (data) setValues(Object.fromEntries(CHARTER_FIELDS.map(([k]) => [k, data.charter?.[k] == null ? '' : String(data.charter[k])])));
  }, [data]);

  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  const status = data.charter?.status ?? 'RASCUNHO';
  const editable = can(ROLES.MANAGE) && (status === 'RASCUNHO' || status === 'REJEITADO');

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setMsg(null);
    try {
      await fn();
      setMsg({ ok: true, text: ok });
      reload();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  };

  const save = () =>
    run(
      () =>
        put(
          `/projects/${projectId}/charter`,
          Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v.trim() === '' ? null : k === 'budget' ? v.replace(',', '.') : v])),
        ),
      'TAP salvo como rascunho.',
    );

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Termo de Abertura do Projeto (TAP)</CardTitle>
          <CardDescription>
            Nome: {data.project.code} — {data.project.name} · versão {data.charter?.version ?? 1}
          </CardDescription>
        </div>
        <StatusBadge group="approval" value={status} />
      </CardHeader>
      <CardContent className="space-y-4">
        {data.missing.length ? <Notice kind="warning">Campos obrigatórios pendentes para submissão: {data.missing.join(', ')}.</Notice> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          {CHARTER_FIELDS.map(([k, text, long]) => (
            <div key={k} className={long ? 'space-y-1.5 sm:col-span-2' : 'space-y-1.5'}>
              <Label htmlFor={`tap-${k}`}>
                {text} <span className="text-danger">*</span>
              </Label>
              {long ? (
                <Textarea id={`tap-${k}`} rows={3} value={values[k] ?? ''} disabled={!editable} onChange={(e) => setValues((s) => ({ ...s, [k]: e.target.value }))} />
              ) : (
                <Input
                  id={`tap-${k}`}
                  value={values[k] ?? ''}
                  inputMode={k === 'budget' ? 'decimal' : undefined}
                  placeholder={k === 'budget' ? '0,00' : undefined}
                  disabled={!editable}
                  onChange={(e) => setValues((s) => ({ ...s, [k]: e.target.value }))}
                />
              )}
            </div>
          ))}
        </div>
        {msg ? msg.ok ? <Notice kind="success">{msg.text}</Notice> : <ErrorBox message={msg.text} /> : null}
        {can(ROLES.MANAGE) ? (
          <div className="flex flex-wrap gap-2">
            {editable ? <Button onClick={save}>Salvar rascunho</Button> : null}
            {editable && data.charter ? (
              <Button variant="outline" onClick={() => run(() => post('/approvals', { entityType: 'TAP', entityId: data.charter.id }), 'TAP enviado para aprovação.')}>
                Submeter para aprovação
              </Button>
            ) : null}
            {status === 'APROVADO' ? (
              <Button variant="outline" onClick={() => run(() => post(`/projects/${projectId}/charter/new-version`), 'Nova versão aberta; a aprovada ficou preservada na auditoria.')}>
                Abrir nova versão
              </Button>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function BusinessCaseTab({ projectId }: { projectId: string }) {
  const { can, me } = useSession();
  const currency = me?.organization.currency ?? 'BRL';
  const { data, error, loading, reload } = useApi<any>(`/projects/${projectId}/business-case`);
  const [text, setText] = React.useState({ justification: '', feasibility: '', benefitsText: '' });
  const [line, setLine] = React.useState({ period: '1', kind: 'CUSTO', description: '', amount: '', category: '' });
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null);

  React.useEffect(() => {
    if (data) {
      const b = data.businessCase;
      setText({ justification: b?.justification ?? '', feasibility: b?.feasibility ?? '', benefitsText: b?.benefitsText ?? '' });
    }
  }, [data]);

  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  const b = data.businessCase;
  const status = b?.status ?? 'RASCUNHO';
  const editable = can(ROLES.MANAGE) && (status === 'RASCUNHO' || status === 'REJEITADO');
  const r = data.result;
  const money = (c: number) => fmtMoney(c / 100, currency);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setMsg(null);
    try {
      await fn();
      setMsg({ ok: true, text: ok });
      reload();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="ROI" value={r.roi.value === null ? 'indisponível' : fmtPct(r.roi.value)} hint={r.roi.reason ?? data.formulas.roi} />
        <Stat label="TCO" value={money(r.tcoCents)} hint={data.formulas.tco} />
        <Stat label="Payback" value={r.payback.period ? `${r.payback.period} meses` : '—'} hint={r.payback.reason ?? data.formulas.payback} />
        <Stat label="Resultado líquido" value={money(r.netCents)} hint={data.formulas.observacao} />
      </div>
      {r.cashflow.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Fluxo por mês</CardTitle>
          </CardHeader>
          <CardContent>
            <GroupedBarChart
              data={r.cashflow.map((c: any) => ({ period: `M${c.period}`, beneficios: c.benefitsCents / 100, custos: c.costsCents / 100 }))}
              x="period"
              format={(v) => fmtMoney(v, currency)}
              series={[
                { key: 'beneficios', name: 'Benefícios', color: SERIES[0] },
                { key: 'custos', name: 'Custos', color: SERIES[1] },
              ]}
            />
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Business Case</CardTitle>
          <StatusBadge group="approval" value={status} />
        </CardHeader>
        <CardContent className="space-y-4">
          {(['justification', 'feasibility', 'benefitsText'] as const).map((k) => (
            <div key={k} className="space-y-1.5">
              <Label htmlFor={`bc-${k}`}>{{ justification: 'Justificativa', feasibility: 'Viabilidade', benefitsText: 'Benefícios (qualitativos)' }[k]}</Label>
              <Textarea id={`bc-${k}`} rows={3} disabled={!editable} value={text[k]} onChange={(e) => setText((s) => ({ ...s, [k]: e.target.value }))} />
            </div>
          ))}
          {msg ? msg.ok ? <Notice kind="success">{msg.text}</Notice> : <ErrorBox message={msg.text} /> : null}
          {can(ROLES.MANAGE) ? (
            <div className="flex flex-wrap gap-2">
              {editable ? <Button onClick={() => run(() => put(`/projects/${projectId}/business-case`, text), 'Business Case salvo.')}>Salvar</Button> : null}
              {editable && b ? (
                <Button variant="outline" onClick={() => run(() => post('/approvals', { entityType: 'BUSINESS_CASE', entityId: b.id }), 'Business Case enviado para aprovação.')}>
                  Submeter para aprovação
                </Button>
              ) : null}
              {status === 'APROVADO' ? (
                <Button variant="outline" onClick={() => run(() => post(`/projects/${projectId}/business-case/new-version`), 'Business Case reaberto.')}>
                  Reabrir para revisão
                </Button>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Benefícios e custos por mês</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-0">
          {editable ? (
            <form
              className="grid gap-2 p-4 sm:grid-cols-6"
              onSubmit={(e) => {
                e.preventDefault();
                run(async () => {
                  await post(`/projects/${projectId}/business-case/lines`, { ...line, period: Number(line.period), amount: line.amount.replace(',', '.'), category: line.category || null });
                  setLine((s) => ({ ...s, description: '', amount: '' }));
                }, 'Lançamento incluído.');
              }}
            >
              <div>
                <Label htmlFor="bl-p">Mês</Label>
                <Input id="bl-p" type="number" min={1} required value={line.period} onChange={(e) => setLine((s) => ({ ...s, period: e.target.value }))} />
              </div>
              <div>
                <Label htmlFor="bl-k">Tipo</Label>
                <Select id="bl-k" value={line.kind} onChange={(e) => setLine((s) => ({ ...s, kind: e.target.value }))}>
                  {options('caseKind').map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="bl-d">Descrição</Label>
                <Input id="bl-d" required value={line.description} onChange={(e) => setLine((s) => ({ ...s, description: e.target.value }))} />
              </div>
              <div>
                <Label htmlFor="bl-a">Valor</Label>
                <Input id="bl-a" required inputMode="decimal" placeholder="0,00" value={line.amount} onChange={(e) => setLine((s) => ({ ...s, amount: e.target.value }))} />
              </div>
              <div className="flex items-end">
                <Button type="submit" className="w-full">
                  Incluir
                </Button>
              </div>
            </form>
          ) : null}
          <Table>
            <THead>
              <tr>
                <TH>Mês</TH>
                <TH>Tipo</TH>
                <TH>Descrição</TH>
                <TH className="text-right">Valor</TH>
                {editable ? <TH /> : null}
              </tr>
            </THead>
            <TBody>
              {(b?.lines ?? []).map((l: any) => (
                <TR key={l.id}>
                  <TD>{l.period}</TD>
                  <TD>{label('caseKind', l.kind)}</TD>
                  <TD>{l.description}</TD>
                  <TD className="text-right tabular-nums">{fmtMoney(l.amount, currency)}</TD>
                  {editable ? (
                    <TD className="text-right">
                      <Button size="icon" variant="ghost" aria-label="Excluir lançamento" onClick={() => run(() => del(`/projects/${projectId}/business-case/lines/${l.id}`), 'Lançamento excluído.')}>
                        <Trash2 className="text-danger" aria-hidden />
                      </Button>
                    </TD>
                  ) : null}
                </TR>
              ))}
            </TBody>
          </Table>
          {!b?.lines?.length ? <p className="p-4 text-sm text-muted">Nenhum lançamento.</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
