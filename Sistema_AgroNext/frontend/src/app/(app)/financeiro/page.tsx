'use client';

import * as React from 'react';
import { useApi } from '@/lib/hooks';
import { fmtDate, fmtMoney, fmtNumber } from '@/lib/format';
import { label, options } from '@/lib/labels';
import { REF } from '@/lib/fields';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select } from '@/components/ui/input';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { CrudSection } from '@/components/crud-section';
import { ErrorBox, Loading, PageHeader, Stat, StatusBadge } from '@/components/common';
import { GroupedBarChart, SERIES } from '@/components/charts';
import { ROLES, useSession } from '@/components/session';

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export default function FinancePage() {
  const { me } = useSession();
  const currency = me?.organization.currency ?? 'BRL';
  const thisYear = new Date().getFullYear();
  const [year, setYear] = React.useState(thisYear);
  const summary = useApi<any>(`/finance/summary?year=${year}`);
  const [showTable, setShowTable] = React.useState(false);
  const money = (v: number) => fmtMoney(v, currency);
  const s = summary.data;

  return (
    <>
      <PageHeader
        title="Gestão Financeira"
        description="CAPEX, OPEX, receitas e despesas por competência, com orçado (previsto) × realizado. Lançamentos importados de ERP ficam somente leitura; o sistema mestre de cada informação ainda precisa ser definido."
        actions={
          <Select aria-label="Ano" value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-28">
            {[thisYear - 2, thisYear - 1, thisYear, thisYear + 1].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
        }
      />
      {summary.error ? <ErrorBox message={summary.error} onRetry={summary.reload} /> : null}
      {summary.loading && !s ? <Loading /> : null}
      {s ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Despesa prevista" value={money(s.totals.despesaPrevista)} />
            <Stat label="Despesa realizada" value={money(s.totals.despesaRealizada)} hint={`CAPEX ${money(s.totals.capex)} · OPEX ${money(s.totals.opex)}`} />
            <Stat label="Receita prevista" value={money(s.totals.receitaPrevista)} />
            <Stat label="Receita realizada" value={money(s.totals.receitaRealizada)} />
          </div>
          <Card className="mt-6">
            <CardHeader>
              <div>
                <CardTitle>Despesas — orçado × realizado por mês</CardTitle>
                <CardDescription>{s.basis}</CardDescription>
              </div>
              <button className="text-sm text-tech hover:underline" onClick={() => setShowTable((v) => !v)}>
                {showTable ? 'Ver gráfico' : 'Ver tabela'}
              </button>
            </CardHeader>
            <CardContent>
              {showTable ? (
                <Table>
                  <THead>
                    <tr>
                      <TH>Mês</TH>
                      <TH className="text-right">Despesa prevista</TH>
                      <TH className="text-right">Despesa realizada</TH>
                      <TH className="text-right">Receita prevista</TH>
                      <TH className="text-right">Receita realizada</TH>
                    </tr>
                  </THead>
                  <TBody>
                    {s.months.map((m: any, i: number) => (
                      <TR key={m.month}>
                        <TD>{MONTHS[i]}</TD>
                        <TD className="text-right tabular-nums">{money(m.despesaPrevista)}</TD>
                        <TD className="text-right tabular-nums">{money(m.despesaRealizada)}</TD>
                        <TD className="text-right tabular-nums">{money(m.receitaPrevista)}</TD>
                        <TD className="text-right tabular-nums">{money(m.receitaRealizada)}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              ) : (
                <GroupedBarChart
                  data={s.months.map((m: any, i: number) => ({ ...m, label: MONTHS[i] }))}
                  x="label"
                  format={(v) => `${fmtNumber(v / 1000, 1)} mil`}
                  series={[
                    { key: 'despesaPrevista', name: 'Orçado (previsto)', color: SERIES[1] },
                    { key: 'despesaRealizada', name: 'Realizado', color: SERIES[0] },
                  ]}
                />
              )}
            </CardContent>
          </Card>
          {s.byCategory.length ? (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Custos por categoria</CardTitle>
              </CardHeader>
              <CardContent>
                <GroupedBarChart
                  data={s.byCategory.map((c: any) => ({ ...c, label: label('category', c.category) }))}
                  x="label"
                  format={(v) => `${fmtNumber(v / 1000, 1)} mil`}
                  height={240}
                  series={[
                    { key: 'previsto', name: 'Orçado (previsto)', color: SERIES[1] },
                    { key: 'realizado', name: 'Realizado', color: SERIES[0] },
                  ]}
                />
              </CardContent>
            </Card>
          ) : null}
        </>
      ) : null}

      <div className="mt-6 space-y-6">
        <CrudSection
          title="Lançamentos"
          entityName="lançamento"
          path="/financial-entries"
          writeRoles={ROLES.MANAGE}
          deleteRoles={ROLES.MANAGE}
          onChange={summary.reload}
          fields={[
            { name: 'description', label: 'Descrição', required: true, full: true },
            { name: 'nature', label: 'Natureza', type: 'select', options: options('nature'), required: true },
            { name: 'expenseType', label: 'CAPEX / OPEX (despesas)', type: 'select', options: [{ value: 'CAPEX', label: 'CAPEX' }, { value: 'OPEX', label: 'OPEX' }] },
            { name: 'category', label: 'Categoria', type: 'select', options: options('category') },
            { name: 'status', label: 'Situação', type: 'select', options: options('entryStatus'), help: 'Gerente de Projeto registra apenas previstos.' },
            { name: 'amount', label: 'Valor', type: 'money', required: true },
            { name: 'competenceDate', label: 'Competência', type: 'date', required: true },
            { name: 'cashDate', label: 'Data de caixa', type: 'date' },
            { name: 'projectId', label: 'Projeto', type: 'ref', ref: REF.project },
            { name: 'costCenterId', label: 'Centro de custo', type: 'ref', ref: REF.costCenter },
            { name: 'contractId', label: 'Contrato', type: 'ref', ref: REF.contract },
          ]}
          columns={[
            {
              key: 'description',
              label: 'Lançamento',
              render: (e: any) => (
                <div>
                  <p className="font-medium">{e.description}</p>
                  <p className="text-xs text-muted">
                    {label('category', e.category)}
                    {e.expenseType ? ` · ${e.expenseType}` : ''} {e.source !== 'MANUAL' ? <Badge>{label('source', e.source)}</Badge> : null}
                  </p>
                </div>
              ),
            },
            { key: 'nature', label: 'Natureza', render: (e: any) => label('nature', e.nature) },
            { key: 'status', label: 'Situação', render: (e: any) => <StatusBadge group="entryStatus" value={e.status} /> },
            { key: 'comp', label: 'Competência', render: (e: any) => fmtDate(e.competenceDate) },
            { key: 'amount', label: 'Valor', render: (e: any) => fmtMoney(e.amount, currency), className: 'text-right tabular-nums' },
          ]}
        />
        <CrudSection
          title="Centros de custo"
          entityName="centro de custo"
          path="/cost-centers"
          writeRoles={ROLES.PMO}
          deleteRoles={ROLES.PMO}
          fields={[
            { name: 'code', label: 'Código', required: true },
            { name: 'name', label: 'Nome', required: true },
          ]}
          columns={[
            { key: 'code', label: 'Código', render: (c: any) => <span className="font-mono">{c.code}</span> },
            { key: 'name', label: 'Nome' },
          ]}
        />
      </div>
    </>
  );
}
