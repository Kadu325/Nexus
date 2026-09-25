'use client';

import * as React from 'react';
import { AlertTriangle, Info, Loader2, Inbox } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { label, tone } from '@/lib/labels';

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold text-ink">{title}</h1>
        {description ? <p className="mt-1 max-w-3xl text-sm text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function Loading({ text = 'Carregando…' }: { text?: string }) {
  return (
    <div role="status" className="flex items-center gap-2 p-6 text-sm text-muted">
      <Loader2 className="size-4 animate-spin" aria-hidden /> {text}
    </div>
  );
}

export function Empty({ text, children }: { text: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-line bg-white p-8 text-center text-sm text-muted">
      <Inbox className="size-6 text-subtle" aria-hidden />
      <p>{text}</p>
      {children}
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-danger/30 bg-danger-50 p-4 text-sm text-danger">
      <AlertTriangle className="size-4" aria-hidden />
      <span className="flex-1">{message}</span>
      {onRetry ? (
        <button className="font-medium underline" onClick={onRetry}>
          Tentar novamente
        </button>
      ) : null}
    </div>
  );
}

export function Notice({ children, kind = 'info', className }: { children: React.ReactNode; kind?: 'info' | 'warning' | 'success'; className?: string }) {
  const styles = {
    info: 'border-tech/30 bg-tech-50 text-tech',
    warning: 'border-warning-icon/40 bg-warning-50 text-warning',
    success: 'border-success/30 bg-success-50 text-success',
  }[kind];
  return (
    <div className={cn('flex gap-2 rounded-lg border p-3 text-sm', styles, className)}>
      <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div>{children}</div>
    </div>
  );
}

export function StatusBadge({ group, value }: { group: string; value?: string | null }) {
  return <Badge tone={tone(value)}>{label(group, value)}</Badge>;
}

export function DemoBadge({ show }: { show?: boolean }) {
  return show ? (
    <Badge tone="demo" title="Registro criado pela carga de dados demonstrativos">
      Demonstração
    </Badge>
  ) : null;
}

export function Stat({ label: text, value, hint, tone: t = 'neutral' }: { label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: 'neutral' | 'success' | 'warning' | 'danger' }) {
  const color = { neutral: 'text-ink', success: 'text-success', warning: 'text-warning', danger: 'text-danger' }[t];
  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{text}</p>
      <p className={cn('mt-1 text-2xl font-semibold tabular-nums', color)}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-subtle">{hint}</p> : null}
    </div>
  );
}

/** Mostra valor do indicador ou "indisponível" com o motivo (nunca zero inventado). */
export function IndicatorValue({ ind, digits = 2 }: { ind?: { value: number | null; reason?: string } | null; digits?: number }) {
  if (!ind || ind.value === null) {
    return (
      <span className="text-sm font-normal text-subtle" title={ind?.reason}>
        indisponível
      </span>
    );
  }
  return <>{ind.value.toFixed(digits).replace('.', ',')}</>;
}
