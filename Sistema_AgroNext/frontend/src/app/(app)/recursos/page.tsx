'use client';

import { useApi } from '@/lib/hooks';
import { fmtDate, fmtMoney, fmtNumber, fmtPct } from '@/lib/format';
import { label, options } from '@/lib/labels';
import { REF } from '@/lib/fields';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { CrudSection } from '@/components/crud-section';
import { ErrorBox, Loading, PageHeader } from '@/components/common';
import { ROLES, useSession } from '@/components/session';

/** Heatmap sequencial de utilização (uma matiz, claro→escuro); acima de 100% usa a cor de alerta com texto. */
function cellStyle(u: number | null) {
  if (u === null) return 'bg-white text-subtle';
  if (u > 1) return 'bg-danger-50 text-danger font-semibold';
  if (u >= 0.85) return 'bg-agro-dark text-white';
  if (u >= 0.6) return 'bg-[#2E7D32] text-white';
  if (u >= 0.3) return 'bg-agro-100 text-agro-darker';
  if (u > 0) return 'bg-agro-50 text-agro-darker';
  return 'bg-white text-subtle';
}

export default function ResourcesPage() {
  const { me } = useSession();
  const currency = me?.organization.currency ?? 'BRL';
  const cap = useApi<any>('/resources-capacity?weeks=8');
  const resources = useApi<any[]>('/resources');
  const projects = useApi<any[]>('/projects');
  const rName = new Map((resources.data ?? []).map((r) => [r.id, r.name]));
  const pName = new Map((projects.data ?? []).map((p) => [p.id, `${p.code} — ${p.name}`]));

  return (
    <>
      <PageHeader title="Gestão de Recursos" description="Pessoas, equipamentos, máquinas, veículos e consultores; competências; alocação e capacidade. Banco de horas e horas extras aguardam a política de jornada da organização." />
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Capacidade × demanda (próximas 8 semanas)</CardTitle>
            <CardDescription>
              Utilização = maior valor entre horas alocadas e horas apontadas aprovadas, dividido pela capacidade semanal cadastrada. Sem capacidade cadastrada: “—”.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {cap.loading && !cap.data ? <Loading /> : null}
          {cap.error ? <ErrorBox message={cap.error} /> : null}
          {cap.data ? (
            <Table>
              <THead>
                <tr>
                  <TH>Recurso</TH>
                  <TH className="text-right">Cap. (h/sem)</TH>
                  {cap.data.weeks.map((w: string) => (
                    <TH key={w} className="text-center">
                      {fmtDate(w).slice(0, 5)}
                    </TH>
                  ))}
                </tr>
              </THead>
              <TBody>
                {cap.data.rows.map((r: any) => (
                  <TR key={r.resource.id}>
                    <TD>
                      <span className="font-medium">{r.resource.name}</span>
                      <p className="text-xs text-muted">{label('resourceType', r.resource.type)}</p>
                    </TD>
                    <TD className="text-right tabular-nums">{r.capacity ?? '—'}</TD>
                    {r.cells.map((c: any) => (
                      <TD key={c.week} className="p-1 text-center">
                        <div
                          className={cn('rounded px-1 py-2 text-xs tabular-nums', cellStyle(c.utilization))}
                          title={`Alocado ${fmtNumber(c.allocated)} h · apontado ${fmtNumber(c.logged)} h`}
                        >
                          {c.utilization === null ? (c.allocated ? `${fmtNumber(c.allocated, 0)} h` : '—') : fmtPct(c.utilization, 0)}
                        </div>
                      </TD>
                    ))}
                  </TR>
                ))}
              </TBody>
            </Table>
          ) : null}
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <CrudSection
          title="Recursos"
          entityName="recurso"
          path="/resources"
          writeRoles={ROLES.PMO}
          deleteRoles={ROLES.PMO}
          onChange={() => {
            cap.reload();
            resources.reload();
          }}
          fields={[
            { name: 'name', label: 'Nome', required: true },
            { name: 'type', label: 'Tipo', type: 'select', options: options('resourceType'), required: true },
            { name: 'userId', label: 'Usuário vinculado (pessoas)', type: 'member' },
            { name: 'weeklyCapacityHours', label: 'Capacidade semanal (h)', type: 'decimal', help: 'Informada pela organização; não há valor presumido.' },
            { name: 'costPerHour', label: 'Custo por hora', type: 'money' },
            { name: 'skills', label: 'Competências', type: 'tags' },
            { name: 'certifications', label: 'Certificações', type: 'tags' },
            { name: 'active', label: 'Ativo', type: 'checkbox', defaultValue: true },
          ]}
          columns={[
            {
              key: 'name',
              label: 'Recurso',
              render: (r: any) => (
                <div>
                  <p className="font-medium">{r.name}</p>
                  <p className="text-xs text-muted">{[...r.skills, ...r.certifications].join(', ') || 'Sem competências cadastradas'}</p>
                </div>
              ),
            },
            { key: 'type', label: 'Tipo', render: (r: any) => label('resourceType', r.type) },
            { key: 'cap', label: 'Cap. (h/sem)', render: (r: any) => r.weeklyCapacityHours ?? '—', className: 'text-right' },
            { key: 'cost', label: 'Custo/h', render: (r: any) => fmtMoney(r.costPerHour, currency), className: 'text-right' },
          ]}
        />
        <CrudSection
          title="Alocações"
          entityName="alocação"
          path="/allocations"
          writeRoles={ROLES.MANAGE}
          deleteRoles={ROLES.MANAGE}
          onChange={cap.reload}
          fields={[
            { name: 'resourceId', label: 'Recurso', type: 'ref', ref: REF.resource, required: true },
            { name: 'projectId', label: 'Projeto', type: 'ref', ref: REF.project, required: true },
            { name: 'startDate', label: 'Início', type: 'date', required: true },
            { name: 'endDate', label: 'Término', type: 'date', required: true },
            { name: 'hoursPerWeek', label: 'Horas por semana', type: 'decimal', required: true },
          ]}
          columns={[
            {
              key: 'res',
              label: 'Recurso / projeto',
              render: (a: any) => (
                <div>
                  <p className="font-medium">{rName.get(a.resourceId) ?? '…'}</p>
                  <p className="text-xs text-muted">{pName.get(a.projectId) ?? '…'}</p>
                </div>
              ),
            },
            { key: 'period', label: 'Período', render: (a: any) => `${fmtDate(a.startDate)} a ${fmtDate(a.endDate)}` },
            { key: 'h', label: 'h/sem', render: (a: any) => a.hoursPerWeek, className: 'text-right' },
          ]}
        />
      </div>
    </>
  );
}
