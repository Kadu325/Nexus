'use client';

import Link from 'next/link';
import { CrudSection } from '@/components/crud-section';
import { PageHeader } from '@/components/common';
import { ROLES } from '@/components/session';
import { REF } from '@/lib/fields';
import { label, options } from '@/lib/labels';

export default function MeetingsPage() {
  return (
    <>
      <PageHeader
        title="Sala de Reuniões"
        description="Cada projeto tem sua sala: reuniões, decisões, ações e ata versionada. Integração com Teams, Outlook, Meet e Google Calendar ainda não está configurada."
      />
      <CrudSection
        title="Reuniões"
        entityName="reunião"
        path="/meetings"
        writeRoles={ROLES.MANAGE}
        deleteRoles={ROLES.PMO}
        fields={[
          { name: 'projectId', label: 'Projeto', type: 'ref', ref: REF.project, required: true, createOnly: true },
          { name: 'title', label: 'Título', required: true },
          { name: 'type', label: 'Tipo', type: 'select', options: options('meetingType') },
          { name: 'scheduledAt', label: 'Data e hora', type: 'datetime', required: true },
          { name: 'location', label: 'Local ou link' },
          { name: 'notes', label: 'Anotações', type: 'textarea', help: 'Ex.: “Marcos deverá validar o contrato até 15/10.” ou “Ação: …; responsável: …; prazo: dd/mm/aaaa”.' },
        ]}
        columns={[
          {
            key: 'title',
            label: 'Reunião',
            render: (m: any) => (
              <Link href={`/pmo/reunioes/${m.id}`} className="font-medium hover:text-tech">
                {m.title}
              </Link>
            ),
          },
          { key: 'type', label: 'Tipo', render: (m: any) => label('meetingType', m.type) },
          { key: 'when', label: 'Quando', render: (m: any) => new Date(m.scheduledAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) },
        ]}
      />
    </>
  );
}
