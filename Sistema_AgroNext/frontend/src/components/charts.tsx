'use client';

import * as React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { fmtDate } from '@/lib/format';

/**
 * Paleta categórica validada (validate_palette.js, modo claro): ordem fixa, nunca reciclada.
 * Verde e laranja não passam no teste de daltonismo quando se cruzam; por isso séries de linha
 * com essas cores usam também traço/marcador distintos (codificação secundária).
 */
export const SERIES = ['#2E7D32', '#1565C0', '#D9652B', '#6B4FB8'];
const GRID = '#E4E7EC';
const AXIS = '#667085';

export interface SeriesDef {
  key: string;
  name: string;
  color: string;
  dashed?: boolean;
  dots?: boolean;
}

const axisProps = { stroke: AXIS, fontSize: 12, tickLine: false, axisLine: { stroke: GRID } } as const;

export function TimeLineChart({
  data,
  x,
  series,
  format,
  height = 280,
  xFormat = fmtDate,
}: {
  data: any[];
  x: string;
  series: SeriesDef[];
  format: (v: number) => string;
  height?: number;
  xFormat?: (v: string) => string;
}) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey={x} tickFormatter={xFormat} {...axisProps} minTickGap={24} />
          <YAxis tickFormatter={(v) => format(Number(v))} {...axisProps} width={90} />
          <Tooltip
            formatter={(v: any, n: any) => [v === null || v === undefined ? '—' : format(Number(v)), n]}
            labelFormatter={(l: any) => xFormat(String(l))}
            contentStyle={{ borderRadius: 8, borderColor: GRID, fontSize: 12 }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {series.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.name}
              stroke={s.color}
              strokeWidth={2}
              strokeDasharray={s.dashed ? '6 4' : undefined}
              dot={s.dots ? { r: 4, strokeWidth: 2, stroke: '#fff', fill: s.color } : false}
              activeDot={{ r: 5 }}
              connectNulls={false}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function GroupedBarChart({
  data,
  x,
  series,
  format,
  height = 280,
  xFormat,
  stacked,
}: {
  data: any[];
  x: string;
  series: SeriesDef[];
  format: (v: number) => string;
  height?: number;
  xFormat?: (v: string) => string;
  stacked?: boolean;
}) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 8 }} barGap={2}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey={x} tickFormatter={xFormat} {...axisProps} />
          <YAxis tickFormatter={(v) => format(Number(v))} {...axisProps} width={90} />
          <Tooltip
            formatter={(v: any, n: any) => [format(Number(v)), n]}
            labelFormatter={(l: any) => (xFormat ? xFormat(String(l)) : String(l))}
            contentStyle={{ borderRadius: 8, borderColor: GRID, fontSize: 12 }}
            cursor={{ fill: '#F5F7FA' }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {series.map((s) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.name}
              fill={s.color}
              radius={stacked ? 0 : [4, 4, 0, 0]}
              stackId={stacked ? 'a' : undefined}
              stroke={stacked ? '#fff' : undefined}
              strokeWidth={stacked ? 2 : 0}
              maxBarSize={36}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Matriz probabilidade × impacto (5×5) com contagem por célula; cor sequencial pela faixa de exposição. */
export function RiskMatrix({ cells }: { cells: number[][] }) {
  const band = (p: number, i: number) => {
    const e = p * i;
    return e >= 15 ? 'bg-danger-50 border-danger/40' : e >= 10 ? 'bg-[#fde7d6] border-[#D9652B]/40' : e >= 5 ? 'bg-warning-50 border-warning-icon/30' : 'bg-success-50 border-success/30';
  };
  return (
    <figure>
      <div className="grid grid-cols-[auto_repeat(5,minmax(0,1fr))] gap-1 text-center text-xs" role="table" aria-label="Matriz probabilidade por impacto">
        <div />
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="py-1 font-medium text-muted" role="columnheader">
            I{i}
          </div>
        ))}
        {cells.map((row, r) => {
          const p = 5 - r;
          return (
            <React.Fragment key={p}>
              <div className="flex items-center pr-2 font-medium text-muted" role="rowheader">
                P{p}
              </div>
              {row.map((count, c) => (
                <div
                  key={c}
                  role="cell"
                  title={`Probabilidade ${p} × Impacto ${c + 1} = exposição ${p * (c + 1)}: ${count} risco(s)`}
                  className={`flex h-10 items-center justify-center rounded border font-semibold tabular-nums text-ink ${band(p, c + 1)}`}
                >
                  {count || ''}
                </div>
              ))}
            </React.Fragment>
          );
        })}
      </div>
      <figcaption className="mt-2 text-xs text-subtle">Faixas: baixa 1–4 · moderada 5–9 · alta 10–14 · crítica 15–25.</figcaption>
    </figure>
  );
}
