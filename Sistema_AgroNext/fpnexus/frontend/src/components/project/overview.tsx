'use client';

import * as React from 'react';
import { patch, post } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { fmtDate, fmtDateTime, fmtMoney, fmtNumber, todayIso } from '@/lib/format';
import { L, label } from '@/lib/labels';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Label } from '@/components/ui/input';
import { ErrorBox, IndicatorValue, Loading, Notice, Stat } from '@/components/common';
import { GroupedBarChart, SERIES, TimeLineChart } from '@/components/charts';
import { ROLES, useSession } from '@/components/session';

export function ProjectOverview({ project, onChanged }: { project: any; onChanged: () => void }) {
  const { can, me, memberName } = useSession();
  const currency = me?.organization.currency ?? 'BRL';
  const [cut, setCut] = React.useState(todayIso());
  const evm = useApi<any>(`/projects/${project.id}/evm?date=${cut}`);
  const curve = useApi<any>(`/projects/${project.id}/s-curve`);
  const burn = useApi<any>(`/projects/${project.id}/burn`);
  const baselines = useApi<any[]>(`/projects/${project.id}/baselines`);
  const [msg, setMsg] = React.useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const money = (v: number) => fmtMoney(v, currency);

  async function createBaseline() {
    if (!window.confirm('Registrar nova linha de base com as datas e orçamentos atuais de todas as tarefas?')) return;
    try {
      const b = await post(`/projects/${project.id}/baselines`);
      setMsg({ kind: 'success', text: `Linha de base nº ${b.number} registrada.` });
      evm.reload();
      curve.reload();
      baselines.reload();
    } catch (e) {
      setMsg({ kind: 'error', text: (e as Error).message });
    }
  }

  const e = evm.data;
  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs text-muted">Gerente</p>
            <p className="font-medium">{memberName(project.managerId)}</p>
          </div>
          <div>
            <p className="text-xs text-muted">Período</p>
            <p className="font-medium">
              {fmtDate(project.startDate)} a {fmtDate(project.endDate)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted">Portfólio › Programa</p>
            <p className="font-medium">{[project.portfolio?.name, project.program?.name].filter(Boolean).join(' › ') || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-muted">Tipo</p>
            <p className="font-medium">{label('projectType', project.type)}</p>
          </div>
          {project.description ? <p className="text-muted sm:col-span-2 lg:col-span-4">{project.description}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Valor agregado (EVM)</CardTitle>
            <CardDescription>
              Linha de base {e?.baselineNumber ? `nº ${e.baselineNumber}` : 'não registrada'} · regra de avanço: % físico da tarefa
            </CardDescription>
          </div>
          <div className="flex items-end gap-2">
            <div>
              <Label htmlFor="cut" className="text-xs">
                Data de corte
              </Label>
              <Input id="cut" type="date" value={cut} onChange={(ev) => setCut(ev.target.value)} className="w-40" />
            </div>
            {can(ROLES.MANAGE) ? (
              <Button variant="outline" onClick={createBaseline}>
                Registrar linha de base
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {msg ? msg.kind === 'error' ? <ErrorBox message={msg.text} /> : <Notice kind="success">{msg.text}</Notice> : null}
          {evm.loading && !e ? <Loading /> : null}
          {evm.error ? <ErrorBox message={evm.error} /> : null}
          {e ? (
            <>
              <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
                <Stat label="BAC" value={money(e.bac)} hint="Orçamento na linha de base" />
                <Stat label="PV" value={e.pv === null ? 'indisponível' : money(e.pv)} />
                <Stat label="EV" value={e.ev === null ? 'indisponível' : money(e.ev)} />
                <Stat label="AC" value={money(e.ac)} hint="Despesas realizadas" />
                <Stat label="CPI" value={<IndicatorValue ind={e.cpi} />} tone={e.cpi.value === null ? 'neutral' : e.cpi.value < 0.9 ? 'danger' : e.cpi.value < 1 ? 'warning' : 'success'} hint={e.cpi.reason ?? 'EV / AC'} />
                <Stat label="SPI" value={<IndicatorValue ind={e.spi} />} tone={e.spi.value === null ? 'neutral' : e.spi.value < 0.9 ? 'danger' : e.spi.value < 1 ? 'warning' : 'success'} hint={e.spi.reason ?? 'EV / PV'} />
              </div>
              {e.eac !== null ? <p className="text-sm text-muted">EAC (BAC / CPI): {money(e.eac)}</p> : null}
              {e.notes?.map((n: string) => (
                <Notice key={n} kind="warning">
                  {n}
                </Notice>
              ))}
            </>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Curva S</CardTitle>
          </CardHeader>
          <CardContent>
            {curve.data && !curve.data.available ? <Notice>{curve.data.reason}</Notice> : null}
            {curve.data?.available ? (
              <TimeLineChart
                data={curve.data.points}
                x="week"
                format={(v) => fmtNumber(v / 1000, 1) + ' mil'}
                series={[
                  { key: 'pv', name: 'PV (planejado)', color: SERIES[0], dashed: true },
                  { key: 'ev', name: 'EV (agregado)', color: SERIES[1] },
                  { key: 'ac', name: 'AC (custo real)', color: SERIES[2], dots: true },
                ]}
              />
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Burnup de tarefas</CardTitle>
          </CardHeader>
          <CardContent>
            {burn.data && !burn.data.available ? <Notice>{burn.data.reason}</Notice> : null}
            {burn.data?.available ? (
              <GroupedBarChart
                data={burn.data.points}
                x="week"
                xFormat={(v) => fmtDate(v).slice(0, 5)}
                format={(v) => fmtNumber(v, 0)}
                series={[
                  { key: 'done', name: 'Concluídas (acumulado)', color: SERIES[0] },
                  { key: 'remaining', name: 'Restantes (burndown)', color: SERIES[1] },
                ]}
              />
            ) : null}
          </CardContent>
        </Card>
      </div>

      <ProjectSettings project={project} onChanged={onChanged} />

      <Card>
        <CardHeader>
          <CardTitle>Linhas de base</CardTitle>
        </CardHeader>
        <CardContent>
          {baselines.data?.length ? (
            <ul className="space-y-1 text-sm">
              {baselines.data.map((b) => (
                <li key={b.id}>
                  Nº {b.number} — {fmtDateTime(b.createdAt)} — {b._count.items} tarefa(s)
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Nenhuma linha de base registrada. Sem ela, PV, EV, CPI e SPI ficam indisponíveis.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ProjectSettings({ project, onChanged }: { project: any; onChanged: () => void }) {
  const { can } = useSession();
  const [wip, setWip] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(Object.keys(L.taskStatus).map((k) => [k, project.wipLimits?.[k] ? String(project.wipLimits[k]) : ''])),
  );
  const [auto, setAuto] = React.useState<boolean>(project.autoCreateTasksFromActions);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  if (!can(ROLES.MANAGE)) return null;

  async function save() {
    setErr(null);
    setMsg(null);
    try {
      const wipLimits = Object.fromEntries(Object.entries(wip).filter(([, v]) => v !== '').map(([k, v]) => [k, Number(v)]));
      const body: Record<string, unknown> = { wipLimits };
      if (can(ROLES.PMO)) body.autoCreateTasksFromActions = auto;
      await patch(`/projects/${project.id}`, body);
      setMsg('Configurações salvas.');
      onChanged();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Configurações do projeto</CardTitle>
          <CardDescription>Limites WIP do Kanban e política de automação de tarefas a partir de atas.</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-4">
          {Object.entries(L.taskStatus).map(([k, text]) => (
            <div key={k}>
              <Label htmlFor={`wip-${k}`}>WIP — {text}</Label>
              <Input id={`wip-${k}`} type="number" min={0} placeholder="sem limite" value={wip[k]} onChange={(e) => setWip((s) => ({ ...s, [k]: e.target.value }))} />
            </div>
          ))}
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1 size-4" checked={auto} disabled={!can(ROLES.PMO)} onChange={(e) => setAuto(e.target.checked)} />
          <span>
            Autorizar a criação de tarefas a partir de ações <strong>validadas</strong> mesmo antes da aprovação da ata.
            <span className="block text-xs text-subtle">Somente Administrador ou PMO altera esta política. Sem ela, é preciso aprovar a ata primeiro.</span>
          </span>
        </label>
        {err ? <ErrorBox message={err} /> : null}
        {msg ? <Notice kind="success">{msg}</Notice> : null}
        <Button onClick={save}>Salvar configurações</Button>
      </CardContent>
    </Card>
  );
}
