'use client';

import Link from 'next/link';
import { useApi } from '@/lib/hooks';
import { fmtDate, fmtMoney, fmtNumber, fmtPct } from '@/lib/format';
import { label } from '@/lib/labels';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { DemoBadge, ErrorBox, IndicatorValue, Loading, PageHeader, Stat, StatusBadge } from '@/components/common';
import { GroupedBarChart, RiskMatrix, SERIES } from '@/components/charts';
import { useSession } from '@/components/session';

function Executive() {
  const { me } = useSession();
  const { data, error } = useApi<any>('/analytics/executive');
  const currency = me?.organization.currency ?? 'BRL';
  if (error) return <ErrorBox message={error} />;
  if (!data) return <Loading />;
  const inv = data.investments;
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Projetos" value={data.projects.total} hint={data.projects.demo ? `${data.projects.demo} demonstrativo(s)` : undefined} />
        <Stat label={`Investimento realizado ${inv.year}`} value={fmtMoney(inv.capexRealizado + inv.opexRealizado, currency)} hint={`CAPEX ${fmtMoney(inv.capexRealizado, currency)} · OPEX ${fmtMoney(inv.opexRealizado, currency)}`} />
        <Stat label={`Investimento previsto ${inv.year}`} value={fmtMoney(inv.capexPrevisto + inv.opexPrevisto, currency)} hint={inv.semClassificacao ? `${fmtMoney(inv.semClassificacao, currency)} sem classificação CAPEX/OPEX` : undefined} />
        <Stat label="Riscos ativos" value={data.risks.active} />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Projetos por status</CardTitle>
          </CardHeader>
          <CardContent>
            <GroupedBarChart
              data={Object.entries(data.projects.byStatus).map(([k, v]) => ({ status: label('projectStatus', k), projetos: v }))}
              x="status"
              height={240}
              format={(v) => fmtNumber(v, 0)}
              series={[{ key: 'projetos', name: 'Projetos', color: SERIES[0] }]}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Matriz de riscos</CardTitle>
          </CardHeader>
          <CardContent>
            <RiskMatrix cells={data.risks.matrix.cells} />
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <div>
            <CardTitle>ROI por Business Case</CardTitle>
            <CardDescription>(Benefícios − Custos) / Custos, sem desconto. Business Cases em rascunho são estimativas não aprovadas.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <tr>
                <TH>Projeto</TH>
                <TH>Situação</TH>
                <TH className="text-right">ROI</TH>
                <TH className="text-right">Payback</TH>
                <TH className="text-right">TCO</TH>
              </tr>
            </THead>
            <TBody>
              {data.roi.map((r: any) => (
                <TR key={r.projectId}>
                  <TD>
                    <Link href={`/projetos/${r.projectId}?aba=bc`} className="hover:text-tech">
                      {r.project}
                    </Link>
                  </TD>
                  <TD>
                    <StatusBadge group="approval" value={r.status} />
                  </TD>
                  <TD className="text-right tabular-nums" title={r.roiReason}>
                    {r.roi === null ? 'indisponível' : fmtPct(r.roi)}
                  </TD>
                  <TD className="text-right tabular-nums">{r.paybackMonths ? `${r.paybackMonths} meses` : '—'}</TD>
                  <TD className="text-right tabular-nums">{fmtMoney(r.tco, currency)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
          {data.roi.length === 0 ? <p className="p-4 text-sm text-muted">Nenhum Business Case registrado.</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}

function Pmo() {
  const { me } = useSession();
  const { data, error } = useApi<any>('/analytics/pmo');
  const currency = me?.organization.currency ?? 'BRL';
  if (error) return <ErrorBox message={error} />;
  if (!data) return <Loading />;
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Desempenho dos projetos ativos (EVM)</CardTitle>
          <CardDescription>Data de corte {fmtDate(data.cutDate)}. CPI = EV / AC · SPI = EV / PV. Sem linha de base, os índices ficam indisponíveis.</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <THead>
            <tr>
              <TH>Projeto</TH>
              <TH className="text-right">BAC</TH>
              <TH className="text-right">PV</TH>
              <TH className="text-right">EV</TH>
              <TH className="text-right">AC</TH>
              <TH className="text-right">CPI</TH>
              <TH className="text-right">SPI</TH>
            </tr>
          </THead>
          <TBody>
            {data.rows.map((r: any) => (
              <TR key={r.project.id}>
                <TD>
                  <Link href={`/projetos/${r.project.id}`} className="font-medium hover:text-tech">
                    {r.project.code} — {r.project.name}
                  </Link>{' '}
                  <DemoBadge show={r.project.isDemo} />
                </TD>
                <TD className="text-right tabular-nums">{fmtMoney(r.bac, currency)}</TD>
                <TD className="text-right tabular-nums">{r.pv === null ? '—' : fmtMoney(r.pv, currency)}</TD>
                <TD className="text-right tabular-nums">{r.ev === null ? '—' : fmtMoney(r.ev, currency)}</TD>
                <TD className="text-right tabular-nums">{fmtMoney(r.ac, currency)}</TD>
                <TD className="text-right tabular-nums" title={r.cpi.reason}>
                  <IndicatorValue ind={r.cpi} />
                </TD>
                <TD className="text-right tabular-nums" title={r.spi.reason}>
                  <IndicatorValue ind={r.spi} />
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function Productivity() {
  const { data, error } = useApi<any>('/analytics/productivity');
  if (error) return <ErrorBox message={error} />;
  if (!data) return <Loading />;
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Lead time médio" value={data.leadTimeDays === null ? 'indisponível' : `${fmtNumber(data.leadTimeDays, 1)} dias`} hint={data.leadTimeReason ?? 'Criação → conclusão, últimas 12 semanas'} />
        <Stat label="Throughput (12 semanas)" value={data.throughput.reduce((s: number, w: any) => s + w.done, 0)} hint="Tarefas concluídas" />
        <Stat label="Cycle time" value="indisponível" hint={data.cycleTime.reason} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Tarefas concluídas por semana</CardTitle>
        </CardHeader>
        <CardContent>
          <GroupedBarChart
            data={data.throughput}
            x="week"
            xFormat={(v) => fmtDate(v).slice(0, 5)}
            height={240}
            format={(v) => fmtNumber(v, 0)}
            series={[{ key: 'done', name: 'Concluídas', color: SERIES[0] }]}
          />
        </CardContent>
      </Card>
      <p className="text-sm text-muted">
        Ocupação e capacidade por recurso: <Link href="/recursos" className="text-tech underline">Gestão de Recursos</Link>. Orçado × realizado: <Link href="/financeiro" className="text-tech underline">Gestão Financeira</Link>.
      </p>
    </div>
  );
}

function Governance() {
  const { data, error } = useApi<any>('/analytics/governance');
  if (error) return <ErrorBox message={error} />;
  if (!data) return <Loading />;
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Conformidade dos controles" value={data.conformity === null ? 'indisponível' : fmtPct(data.conformity)} hint="Conformes / avaliados" />
        <Stat label="Não conformidades abertas" value={data.nonConformities.open} tone={data.nonConformities.overdue ? 'danger' : 'neutral'} hint={`${data.nonConformities.overdue} com prazo vencido`} />
        <Stat label="Avaliações (90 dias)" value={data.assessmentsLast90Days} />
        <Stat label="Mudanças aguardando aprovação" value={data.changesPendingApproval} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Sistemas com fim de suporte em até 180 dias</CardTitle>
        </CardHeader>
        <CardContent>
          {data.systemsEndOfSupport.length === 0 ? (
            <p className="text-sm text-muted">Nenhum.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {data.systemsEndOfSupport.map((s: any) => (
                <li key={s.id}>
                  <span className="font-medium">{s.name}</span> — {fmtDate(s.endOfSupport)} <StatusBadge group="criticality" value={s.criticality} />
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-subtle">Eventos na trilha de auditoria nos últimos 30 dias: {data.auditEventsLast30Days}.</p>
        </CardContent>
      </Card>
    </div>
  );
}

function Catalog() {
  const { data } = useApi<any[]>('/analytics/metrics');
  if (!data) return <Loading />;
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Catálogo de indicadores</CardTitle>
          <CardDescription>Todo número exibido tem fórmula, unidade, fonte e tratamento de dados ausentes definidos.</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <THead>
            <tr>
              <TH>Indicador</TH>
              <TH>Fórmula</TH>
              <TH>Unidade</TH>
              <TH>Fonte</TH>
              <TH>Periodicidade</TH>
              <TH>Dado ausente</TH>
            </tr>
          </THead>
          <TBody>
            {data.map((m) => (
              <TR key={m.key}>
                <TD>
                  <span className="font-medium">{m.name}</span>
                  <p className="text-xs text-muted">{m.purpose}</p>
                </TD>
                <TD className="font-mono text-xs">{m.formula}</TD>
                <TD>{m.unit}</TD>
                <TD>{m.source}</TD>
                <TD>{m.periodicity}</TD>
                <TD className="text-xs">{m.missing}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export default function AnalyticsPage() {
  return (
    <>
      <PageHeader
        title="Analytics Avançado"
        description="Dashboards executivo, PMO, produtividade e governança calculados a partir dos registros, com as mesmas permissões dos dados de origem. Power BI e Microsoft Fabric continuam como integrações a contratar."
      />
      <Tabs defaultValue="exec">
        <TabsList>
          <TabsTrigger value="exec">Executivo</TabsTrigger>
          <TabsTrigger value="pmo">PMO</TabsTrigger>
          <TabsTrigger value="prod">Produtividade</TabsTrigger>
          <TabsTrigger value="gov">Governança</TabsTrigger>
          <TabsTrigger value="cat">Catálogo de indicadores</TabsTrigger>
        </TabsList>
        <TabsContent value="exec">
          <Executive />
        </TabsContent>
        <TabsContent value="pmo">
          <Pmo />
        </TabsContent>
        <TabsContent value="prod">
          <Productivity />
        </TabsContent>
        <TabsContent value="gov">
          <Governance />
        </TabsContent>
        <TabsContent value="cat">
          <Catalog />
        </TabsContent>
      </Tabs>
    </>
  );
}
