'use client';

import Link from 'next/link';
import { CrudSection } from '@/components/crud-section';
import { DemoBadge, PageHeader, StatusBadge } from '@/components/common';
import { ROLES } from '@/components/session';
import { projectFields } from '@/lib/fields';
import { fmtDate } from '@/lib/format';
import { label } from '@/lib/labels';

export default function ProjectsPage() {
  return (
    <>
      <PageHeader title="Projetos" description="Projetos estratégicos e operacionais, vinculados a portfólios, programas, centros de custo e unidades." />
      <CrudSection
        title="Todos os projetos"
        entityName="projeto"
        path="/projects"
        fields={projectFields}
        writeRoles={ROLES.MANAGE}
        deleteRoles={ROLES.PMO}
        emptyText="Nenhum projeto cadastrado. Use “Novo” para criar o primeiro."
        columns={[
          {
            key: 'name',
            label: 'Projeto',
            render: (p: any) => (
              <div>
                <Link href={`/projetos/${p.id}`} className="font-medium text-ink hover:text-tech">
                  {p.code} — {p.name}
                </Link>{' '}
                <DemoBadge show={p.isDemo} />
                <p className="text-xs text-muted">{[p.portfolio?.name, p.program?.name].filter(Boolean).join(' › ') || 'Sem portfólio'}</p>
              </div>
            ),
          },
          { key: 'type', label: 'Tipo', render: (p: any) => label('projectType', p.type) },
          { key: 'status', label: 'Status', render: (p: any) => <StatusBadge group="projectStatus" value={p.status} /> },
          { key: 'period', label: 'Período', render: (p: any) => `${fmtDate(p.startDate)} a ${fmtDate(p.endDate)}` },
          { key: 'tasks', label: 'Tarefas', render: (p: any) => p._count?.tasks ?? 0, className: 'text-right tabular-nums' },
        ]}
      />
    </>
  );
}
