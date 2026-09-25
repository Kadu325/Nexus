'use client';

import * as React from 'react';
import { fmtDate, todayIso, wbsCompare } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Empty, Notice } from '@/components/common';

const DAY = 86_400_000;
const toTime = (iso: string) => Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);

/**
 * Gantt com barras pela data real das tarefas, sobreposição da linha de base mais recente,
 * destaque do caminho crítico (CPM calculado na API) e lista de tarefas não agendadas.
 */
export function Gantt({ schedule, onOpen }: { schedule: any; onOpen: (id: string) => void }) {
  const [pxPerDay, setPx] = React.useState(18);
  if (!schedule.range) {
    return (
      <Empty text="Nenhuma tarefa com início e término definidos.">
        {schedule.unscheduled.length ? <p>{schedule.unscheduled.length} tarefa(s) não agendada(s) abaixo.</p> : null}
      </Empty>
    );
  }
  const baseline = new Map<string, any>((schedule.baseline?.items ?? []).map((i: any) => [i.taskId, i]));
  const allTimes = [toTime(schedule.range.start), toTime(schedule.range.end)];
  for (const b of baseline.values()) if (b.startDate && b.endDate) allTimes.push(toTime(b.startDate), toTime(b.endDate));
  const start = Math.min(...allTimes) - 3 * DAY;
  const end = Math.max(...allTimes) + 4 * DAY;
  const days = Math.round((end - start) / DAY);
  const width = days * pxPerDay;
  const x = (t: number) => ((t - start) / DAY) * pxPerDay;
  const today = toTime(todayIso());
  const rows = [...schedule.scheduled].sort((a, b) => wbsCompare(a.wbsCode, b.wbsCode) || toTime(a.startDate) - toTime(b.startDate));
  const weeks: number[] = [];
  for (let t = start; t <= end; t += DAY) if (new Date(t).getUTCDay() === 1) weeks.push(t);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-6 rounded bg-tech" aria-hidden /> Tarefa
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-6 rounded bg-danger" aria-hidden /> Caminho crítico
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-1.5 w-6 rounded bg-subtle/60" aria-hidden /> Linha de base {schedule.baseline ? `nº ${schedule.baseline.number}` : '(não registrada)'}
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block size-3 rotate-45 bg-agro-dark" aria-hidden /> Marco
        </span>
        <span>{schedule.calendar}</span>
        <span className="ml-auto flex items-center gap-1">
          Zoom
          <button className="rounded border border-line px-2" onClick={() => setPx((p) => Math.max(6, p - 4))} aria-label="Diminuir zoom">
            −
          </button>
          <button className="rounded border border-line px-2" onClick={() => setPx((p) => Math.min(40, p + 4))} aria-label="Aumentar zoom">
            +
          </button>
        </span>
      </div>
      {schedule.cpmError ? <Notice kind="warning">Caminho crítico indisponível: {schedule.cpmError}</Notice> : null}
      {schedule.projectDurationWorkdays !== null ? (
        <p className="text-sm text-muted">
          Duração pela rede (CPM): <strong className="text-ink">{schedule.projectDurationWorkdays} dias úteis</strong> · {schedule.criticalPath.length} tarefa(s) crítica(s)
        </p>
      ) : null}
      <div className="flex overflow-hidden rounded-lg border border-line bg-white">
        <div className="w-64 shrink-0 border-r border-line">
          <div className="h-8 border-b border-line bg-surface px-2 text-xs font-semibold leading-8 text-muted">Tarefa</div>
          {rows.map((t) => (
            <button key={t.id} onClick={() => onOpen(t.id)} className="flex h-9 w-full items-center gap-1 truncate border-b border-line px-2 text-left text-sm hover:bg-surface" title={t.title}>
              <span className="text-subtle">{t.wbsCode}</span>
              <span className={cn('truncate', t.critical && 'font-semibold text-danger')}>{t.title}</span>
            </button>
          ))}
        </div>
        <div className="overflow-x-auto">
          <svg width={width} height={32 + rows.length * 36} role="img" aria-label="Diagrama de Gantt">
            <rect x={0} y={0} width={width} height={32} fill="#F5F7FA" />
            {weeks.map((w) => (
              <g key={w}>
                <line x1={x(w)} x2={x(w)} y1={0} y2={32 + rows.length * 36} stroke="#E4E7EC" />
                <text x={x(w) + 4} y={20} fontSize={11} fill="#667085">
                  {fmtDate(new Date(w).toISOString()).slice(0, 5)}
                </text>
              </g>
            ))}
            {today >= start && today <= end ? <line x1={x(today)} x2={x(today)} y1={0} y2={32 + rows.length * 36} stroke="#1565C0" strokeDasharray="4 3" /> : null}
            {rows.map((t, i) => {
              const y = 32 + i * 36;
              const s = toTime(t.startDate);
              const e = toTime(t.endDate) + DAY;
              const b = baseline.get(t.id);
              const color = t.critical ? '#C62828' : '#1565C0';
              return (
                <g key={t.id} onClick={() => onOpen(t.id)} className="cursor-pointer">
                  <title>
                    {`${t.title}: ${fmtDate(t.startDate)} a ${fmtDate(t.endDate)} · ${t.durationWorkdays} dia(s) úteis · folga ${t.float ?? '—'} · ${t.progress}%`}
                  </title>
                  <line x1={0} x2={width} y1={y + 36} y2={y + 36} stroke="#F2F4F7" />
                  {b?.startDate && b?.endDate ? (
                    <rect x={x(toTime(b.startDate))} y={y + 27} width={Math.max(4, x(toTime(b.endDate) + DAY) - x(toTime(b.startDate)))} height={4} rx={2} fill="#98A2B3" />
                  ) : null}
                  {t.isMilestone ? (
                    <rect x={x(s) - 7} y={y + 9} width={14} height={14} fill="#1B5E20" transform={`rotate(45 ${x(s)} ${y + 16})`} />
                  ) : (
                    <>
                      <rect x={x(s)} y={y + 8} width={Math.max(4, x(e) - x(s))} height={16} rx={4} fill={color} opacity={0.25} />
                      <rect x={x(s)} y={y + 8} width={Math.max(0, ((x(e) - x(s)) * t.progress) / 100)} height={16} rx={4} fill={color} />
                    </>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      </div>
      <div>
        <h3 className="mb-2 text-sm font-semibold">Não agendadas ({schedule.unscheduled.length})</h3>
        {schedule.unscheduled.length === 0 ? (
          <p className="text-sm text-muted">Todas as tarefas têm início e término.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {schedule.unscheduled.map((t: any) => (
              <li key={t.id}>
                <button onClick={() => onOpen(t.id)} className="rounded-md border border-dashed border-line bg-white px-2 py-1 text-sm hover:border-tech">
                  {t.title} {t.endDate ? <Badge tone="warning">prazo {fmtDate(t.endDate)}, sem início</Badge> : <Badge>sem datas</Badge>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
