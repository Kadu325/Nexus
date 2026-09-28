'use client';

import Link from 'next/link';
import { useApi } from '@/lib/hooks';
import { fmtDate, fmtMoney } from '@/lib/format';
import { label } from '@/lib/labels';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, ErrorBox, Loading, PageHeader, Stat, StatusBadge } from '@/components/common';
import { RiskMatrix } from '@/components/charts';
import { useSession } from '@/components/session';

export default function HomePage() {
  const { me } = useSession();
  const exec = useApi<any>('/analytics/executive');
  const work = useApi<any[]>('/my-work');
  const approvals = useApi<any[]>('/approvals?status=PENDENTE');
  const currency = me?.organization.currency ?? 'BRL';

  return (
    <>
      <PageHeader title={`Olá, ${me?.user.name?.split(' ')[0] ?? ''}`} description="Visão geral da organização: projetos, riscos, aprovações e o seu trabalho." />
      {exec.error ? <ErrorBox message={exec.error} onRetry={exec.reload} /> : null}
      {exec.loading && !exec.data ? <Loading /> : null}
      {exec.data ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Projetos" value={exec.data.projects.total} hint={Object.entries(exec.data.projects.byStatus).map(([k, v]) => `${label('projectStatus', k)}: ${v}`).join(' · ') || 'Nenhum projeto'} />
          <Stat label="Riscos ativos" value={exec.data.risks.active} tone={exec.data.risks.top.some((r: any) => r.band === 'CRITICA') ? 'danger' : 'neutral'} hint="Abertos ou em mitigação" />
          <Stat label="Aprovações pendentes" value={approvals.data?.length ?? '…'} tone={approvals.data?.length ? 'warning' : 'neutral'} hint={<Link className="text-tech hover:underline" href="/pmo/aprovacoes">Ver aprovações</Link>} />
          <Stat label={`CAPEX realizado ${exec.data.investments.year}`} value={fmtMoney(exec.data.investments.capexRealizado, currency)} hint={`Previsto: ${fmtMoney(exec.data.investments.capexPrevisto, currency)}`} />
        </div>
      ) : null}

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Meu Trabalho</CardTitle>
            <Link href="/meu-trabalho" className="text-sm text-tech hover:underline">
              Ver tudo
            </Link>
          </CardHeader>
          <CardContent>
            {work.loading && !work.data ? <Loading /> : null}
            {work.error ? <ErrorBox message={work.error} /> : null}
            {work.data && work.data.length === 0 ? <Empty text="Nenhuma tarefa pendente atribuída a você." /> : null}
            <ul className="divide-y divide-line">
              {work.data?.slice(0, 6).map((t) => (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <Link href={`/projetos/${t.projectId}?tarefa=${t.id}`} className="font-medium text-ink hover:text-tech">
                      {t.title}
                    </Link>
                    <p className="text-xs text-muted">
                      {t.project.code} · prazo {t.endDate ? fmtDate(t.endDate) : 'não agendado'}
                      {t.overdue ? <span className="ml-1 font-semibold text-danger">· atrasada</span> : null}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <StatusBadge group="priority" value={t.priority} />
                    <StatusBadge group="taskStatus" value={t.status} />
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Matriz de riscos ativos</CardTitle>
          </CardHeader>
          <CardContent>{exec.data ? <RiskMatrix cells={exec.data.risks.matrix.cells} /> : <Loading />}</CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Riscos de maior exposição</CardTitle>
        </CardHeader>
        <CardContent>
          {exec.data?.risks.top.length === 0 ? <Empty text="Nenhum risco ativo." /> : null}
          <ul className="divide-y divide-line">
            {exec.data?.risks.top.map((r: any) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span>
                  <span className="font-medium">{r.title}</span> <span className="text-muted">— {r.project}</span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="tabular-nums text-muted">exposição {r.exposure}</span>
                  <StatusBadge group="band" value={r.band} />
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </>
  );
}
