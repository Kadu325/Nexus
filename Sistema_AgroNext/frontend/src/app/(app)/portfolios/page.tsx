'use client';

import { CrudSection } from '@/components/crud-section';
import { PageHeader } from '@/components/common';
import { ROLES } from '@/components/session';
import { REF } from '@/lib/fields';

export default function PortfoliosPage() {
  return (
    <>
      <PageHeader
        title="Portfólios e programas"
        description="Cadastros compartilhados entre Gestão de Projetos e Portfólio/Estratégia. Um programa pode pertencer a um portfólio; projetos podem existir sem programa."
      />
      <div className="grid gap-6 xl:grid-cols-2">
        <CrudSection
          title="Portfólios"
          entityName="portfólio"
          path="/portfolios"
          writeRoles={ROLES.PMO}
          deleteRoles={ROLES.PMO}
          fields={[
            { name: 'name', label: 'Nome', required: true },
            { name: 'description', label: 'Descrição', type: 'textarea' },
          ]}
          columns={[
            { key: 'name', label: 'Nome', render: (r: any) => <span className="font-medium">{r.name}</span> },
            { key: 'programs', label: 'Programas', render: (r: any) => r._count?.programs ?? 0, className: 'text-right' },
            { key: 'projects', label: 'Projetos', render: (r: any) => r._count?.projects ?? 0, className: 'text-right' },
          ]}
        />
        <CrudSection
          title="Programas"
          entityName="programa"
          path="/programs"
          writeRoles={ROLES.PMO}
          deleteRoles={ROLES.PMO}
          fields={[
            { name: 'name', label: 'Nome', required: true },
            { name: 'portfolioId', label: 'Portfólio', type: 'ref', ref: REF.portfolio },
            { name: 'description', label: 'Descrição', type: 'textarea' },
          ]}
          columns={[
            { key: 'name', label: 'Nome', render: (r: any) => <span className="font-medium">{r.name}</span> },
            { key: 'portfolio', label: 'Portfólio', render: (r: any) => r.portfolio?.name ?? '—' },
            { key: 'projects', label: 'Projetos', render: (r: any) => r._count?.projects ?? 0, className: 'text-right' },
          ]}
        />
      </div>
    </>
  );
}
