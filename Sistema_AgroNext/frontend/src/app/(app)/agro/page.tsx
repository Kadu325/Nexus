'use client';

import * as React from 'react';
import { useApi } from '@/lib/hooks';
import { fmtDate, fmtNumber } from '@/lib/format';
import { label, options } from '@/lib/labels';
import { REF } from '@/lib/fields';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label, Select } from '@/components/ui/input';
import { Table, TBody, TD, TR } from '@/components/ui/table';
import { CrudSection } from '@/components/crud-section';
import { DemoBadge, Empty, ErrorBox, Loading, Notice, PageHeader } from '@/components/common';
import { BrazilMap } from '@/components/brazil-map';
import { SERIES, TimeLineChart } from '@/components/charts';
import { ROLES } from '@/components/session';

const UF = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];

function IndicatorSeries() {
  const indicators = useApi<any[]>('/agro-indicators');
  const [indicatorId, setIndicator] = React.useState('');
  const current = indicatorId || indicators.data?.[0]?.id || '';
  const series = useApi<any>(current ? `/agro/series?indicatorId=${current}` : null);
  const data = React.useMemo(() => {
    if (!series.data) return [];
    const byDate = new Map<string, any>();
    for (const r of series.data.rows) {
      const row = byDate.get(r.date) ?? { date: r.date };
      row[r.unitId] = r.value;
      byDate.set(r.date, row);
    }
    return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, [series.data]);
  const units = (series.data?.units ?? []).slice(0, 4);

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Série do indicador por unidade</CardTitle>
          <CardDescription>Leituras ausentes aparecem como lacunas: não há interpolação.</CardDescription>
        </div>
        <div className="w-72">
          <Label htmlFor="ind" className="sr-only">
            Indicador
          </Label>
          <Select id="ind" value={current} onChange={(e) => setIndicator(e.target.value)}>
            {indicators.data?.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name} ({i.unit})
              </option>
            ))}
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {!indicators.data?.length ? <Empty text="Cadastre um indicador para ver a série." /> : null}
        {series.data ? (
          <>
            <p className="mb-2 text-xs text-muted">
              Fórmula: {series.data.indicator.formula} · Fonte: {series.data.indicator.source} · Frequência: {series.data.indicator.frequency}
            </p>
            {data.length ? (
              <TimeLineChart
                data={data}
                x="date"
                format={(v) => `${fmtNumber(v, 1)} ${series.data.indicator.unit}`}
                series={units.map((u: any, i: number) => ({ key: u.id, name: u.name, color: SERIES[i], dots: true, dashed: i === 2 }))}
              />
            ) : (
              <Empty text="Sem medições para este indicador." />
            )}
            {(series.data.units ?? []).length > 4 ? <p className="text-xs text-subtle">Exibindo as 4 primeiras unidades; filtre por safra ou unidade para comparar outras.</p> : null}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default function AgroPage() {
  const map = useApi<any>('/agro/map');
  const units = useApi<any[]>('/units');
  const indicators = useApi<any[]>('/agro-indicators');
  const uName = new Map((units.data ?? []).map((u) => [u.id, u.name]));
  const iName = new Map((indicators.data ?? []).map((i) => [i.id, `${i.name} (${i.unit})`]));

  return (
    <>
      <PageHeader
        title="Agronegócio"
        description="Fazendas, filiais e safras; indicadores agrícolas com fórmula, unidade, fonte e frequência definidas; medições identificadas pela origem. Sensores, drones, GIS e telemetria entram como integrações a configurar."
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Mapa das unidades</CardTitle>
              <CardDescription>{map.data?.provider}</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {map.error ? <ErrorBox message={map.error} /> : null}
            {map.data ? <BrazilMap points={map.data.points} /> : <Loading />}
            {map.data?.withoutLocation.length ? (
              <Notice kind="warning" className="mt-3">
                Sem localização: {map.data.withoutLocation.map((u: any) => u.name).join(', ')}.
              </Notice>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Projetos por UF</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {map.data && Object.keys(map.data.projectsByState).length === 0 ? <p className="p-4 text-sm text-muted">Nenhum projeto vinculado a unidades.</p> : null}
            <Table>
              <TBody>
                {Object.entries(map.data?.projectsByState ?? {})
                  .sort((a: any, b: any) => b[1] - a[1])
                  .map(([uf, n]) => (
                    <TR key={uf}>
                      <TD className="font-medium">{uf}</TD>
                      <TD className="text-right tabular-nums">{String(n)} projeto(s)</TD>
                    </TR>
                  ))}
              </TBody>
            </Table>
            <div className="border-t border-line p-4">
              <p className="mb-2 text-sm font-semibold">Unidades</p>
              <ul className="space-y-1 text-sm">
                {map.data?.points.map((p: any) => (
                  <li key={p.id}>
                    {p.name} — {label('unitType', p.type)}, {p.city}/{p.state} · {p.projects} projeto(s) <DemoBadge show={p.isDemo} />
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <IndicatorSeries />
      </div>

      <div className="mt-6 space-y-6">
        <CrudSection
          title="Unidades"
          entityName="unidade"
          path="/units"
          writeRoles={ROLES.PMO}
          deleteRoles={ROLES.PMO}
          onChange={() => {
            map.reload();
            units.reload();
          }}
          fields={[
            { name: 'name', label: 'Nome', required: true },
            { name: 'type', label: 'Tipo', type: 'select', options: options('unitType') },
            { name: 'city', label: 'Município' },
            { name: 'state', label: 'UF', type: 'select', options: UF.map((u) => ({ value: u, label: u })) },
            { name: 'latitude', label: 'Latitude (graus decimais)', type: 'decimal', placeholder: '-12.5425' },
            { name: 'longitude', label: 'Longitude (graus decimais)', type: 'decimal', placeholder: '-55.7211' },
            { name: 'areaHa', label: 'Área (ha)', type: 'decimal' },
            { name: 'costCenterId', label: 'Centro de custo', type: 'ref', ref: REF.costCenter },
          ]}
          columns={[
            { key: 'name', label: 'Unidade', render: (u: any) => <span className="font-medium">{u.name} <DemoBadge show={u.isDemo} /></span> },
            { key: 'type', label: 'Tipo', render: (u: any) => label('unitType', u.type) },
            { key: 'loc', label: 'Local', render: (u: any) => `${u.city ?? '—'}/${u.state ?? '—'}` },
            { key: 'coords', label: 'Coordenadas', render: (u: any) => (u.latitude ? `${Number(u.latitude).toFixed(4)}, ${Number(u.longitude).toFixed(4)}` : 'sem localização') },
            { key: 'area', label: 'Área (ha)', render: (u: any) => (u.areaHa ? fmtNumber(u.areaHa) : '—'), className: 'text-right' },
          ]}
        />
        <div className="grid gap-6 xl:grid-cols-2">
          <CrudSection
            title="Safras"
            entityName="safra"
            path="/seasons"
            writeRoles={ROLES.PMO}
            deleteRoles={ROLES.PMO}
            fields={[
              { name: 'name', label: 'Safra', required: true, placeholder: '2025/26' },
              { name: 'crop', label: 'Cultura' },
              { name: 'startDate', label: 'Início', type: 'date', required: true },
              { name: 'endDate', label: 'Fim', type: 'date', required: true },
            ]}
            columns={[
              { key: 'name', label: 'Safra', render: (s: any) => <span className="font-medium">{s.name}</span> },
              { key: 'crop', label: 'Cultura', render: (s: any) => s.crop ?? '—' },
              { key: 'p', label: 'Período', render: (s: any) => `${fmtDate(s.startDate)} a ${fmtDate(s.endDate)}` },
            ]}
          />
          <CrudSection
            title="Indicadores agrícolas"
            entityName="indicador"
            path="/agro-indicators"
            writeRoles={ROLES.PMO}
            deleteRoles={ROLES.PMO}
            onChange={indicators.reload}
            fields={[
              { name: 'name', label: 'Nome', required: true },
              { name: 'unit', label: 'Unidade de medida', required: true, placeholder: 'mm, sc/ha, kWh' },
              { name: 'formula', label: 'Fórmula', required: true, full: true },
              { name: 'source', label: 'Fonte', required: true },
              { name: 'frequency', label: 'Frequência', required: true, placeholder: 'Semanal' },
              { name: 'responsible', label: 'Responsável' },
            ]}
            columns={[
              { key: 'name', label: 'Indicador', render: (i: any) => <span className="font-medium">{i.name}</span> },
              { key: 'unit', label: 'Unidade' },
              { key: 'frequency', label: 'Frequência' },
            ]}
          />
        </div>
        <CrudSection
          title="Medições"
          entityName="medição"
          path="/agro-measurements"
          writeRoles={ROLES.WORKERS}
          deleteRoles={ROLES.PMO}
          fields={[
            { name: 'indicatorId', label: 'Indicador', type: 'ref', ref: REF.indicator, required: true },
            { name: 'unitId', label: 'Unidade', type: 'ref', ref: { path: '/units', labelOf: (u: any) => u.name }, required: true },
            { name: 'seasonId', label: 'Safra', type: 'ref', ref: REF.season },
            { name: 'projectId', label: 'Projeto', type: 'ref', ref: REF.project },
            { name: 'refDate', label: 'Data de referência', type: 'date', required: true },
            { name: 'value', label: 'Valor', type: 'decimal', required: true },
            { name: 'origin', label: 'Origem', type: 'select', options: options('origin') },
          ]}
          columns={[
            { key: 'ind', label: 'Indicador', render: (m: any) => iName.get(m.indicatorId) ?? '…' },
            { key: 'unit', label: 'Unidade', render: (m: any) => uName.get(m.unitId) ?? '…' },
            { key: 'date', label: 'Referência', render: (m: any) => fmtDate(m.refDate) },
            { key: 'value', label: 'Valor', render: (m: any) => fmtNumber(m.value, 4), className: 'text-right tabular-nums' },
            { key: 'origin', label: 'Origem', render: (m: any) => label('origin', m.origin) },
          ]}
        />
      </div>
    </>
  );
}
