'use client';

import * as React from 'react';
import { post } from '@/lib/api';
import { fmtDate, fmtDateTime } from '@/lib/format';
import { label, options } from '@/lib/labels';
import { REF } from '@/lib/fields';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CrudSection } from '@/components/crud-section';
import { ErrorBox, Notice, PageHeader, StatusBadge } from '@/components/common';
import { ROLES, useSession } from '@/components/session';

export default function GovernancePage() {
  const { can, memberName } = useSession();
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null);
  const run = async (fn: () => Promise<unknown>, ok: string, reload: () => void) => {
    setMsg(null);
    try {
      await fn();
      setMsg({ ok: true, text: ok });
      reload();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  };

  return (
    <>
      <PageHeader
        title="Governança de TI"
        description="Catálogo de sistemas com ciclo de vida e fim de suporte (alerta com 180 dias de antecedência) e gestão de mudanças com aprovação. Mudança de risco alto ou crítico exige plano de reversão."
      />
      {msg ? msg.ok ? <Notice kind="success" className="mb-4">{msg.text}</Notice> : <div className="mb-4"><ErrorBox message={msg.text} /></div> : null}
      <div className="space-y-6">
        <CrudSection
          title="Sistemas e serviços de TI"
          entityName="sistema"
          path="/it-systems"
          writeRoles={ROLES.PMO}
          deleteRoles={ROLES.PMO}
          fields={[
            { name: 'name', label: 'Nome', required: true },
            { name: 'vendor', label: 'Fornecedor' },
            { name: 'criticality', label: 'Criticidade', type: 'select', options: options('criticality') },
            { name: 'lifecycle', label: 'Ciclo de vida', type: 'select', options: options('lifecycle') },
            { name: 'endOfSupport', label: 'Fim de suporte', type: 'date' },
            { name: 'ownerId', label: 'Responsável', type: 'member' },
            { name: 'notes', label: 'Observações', type: 'textarea' },
          ]}
          columns={[
            { key: 'name', label: 'Sistema', render: (s: any) => <span className="font-medium">{s.name}</span> },
            { key: 'vendor', label: 'Fornecedor', render: (s: any) => s.vendor ?? '—' },
            { key: 'crit', label: 'Criticidade', render: (s: any) => <StatusBadge group="criticality" value={s.criticality} /> },
            { key: 'life', label: 'Ciclo de vida', render: (s: any) => label('lifecycle', s.lifecycle) },
            {
              key: 'eos',
              label: 'Fim de suporte',
              render: (s: any) => (
                <span>
                  {fmtDate(s.endOfSupport)}{' '}
                  {s.supportAlert === 'SUPORTE_ENCERRADO' ? <Badge tone="danger">encerrado</Badge> : s.supportAlert === 'FIM_PROXIMO' ? <Badge tone="warning">{s.daysToEndOfSupport} dia(s)</Badge> : null}
                </span>
              ),
            },
            { key: 'owner', label: 'Responsável', render: (s: any) => memberName(s.ownerId) },
          ]}
        />
        <CrudSection
          title="Solicitações de mudança"
          entityName="mudança"
          path="/change-requests"
          writeRoles={ROLES.MANAGE}
          deleteRoles={ROLES.MANAGE}
          fields={[
            { name: 'title', label: 'Título', required: true, full: true },
            { name: 'systemId', label: 'Sistema afetado', type: 'ref', ref: REF.itSystem },
            { name: 'projectId', label: 'Projeto', type: 'ref', ref: REF.project },
            { name: 'risk', label: 'Risco', type: 'select', options: options('criticality') },
            { name: 'plannedStart', label: 'Janela — início', type: 'datetime' },
            { name: 'plannedEnd', label: 'Janela — fim', type: 'datetime' },
            { name: 'justification', label: 'Justificativa', type: 'textarea' },
            { name: 'rollbackPlan', label: 'Plano de reversão', type: 'textarea' },
          ]}
          columns={[
            { key: 'title', label: 'Mudança', render: (c: any) => <span className="font-medium">{c.title}</span> },
            { key: 'risk', label: 'Risco', render: (c: any) => <StatusBadge group="criticality" value={c.risk} /> },
            { key: 'window', label: 'Janela', render: (c: any) => (c.plannedStart ? `${fmtDateTime(c.plannedStart)} → ${fmtDateTime(c.plannedEnd)}` : '—') },
            {
              key: 'status',
              label: 'Situação',
              render: (c: any) => (
                <span>
                  <StatusBadge group="approval" value={c.status} /> {c.implementedAt ? <Badge tone="success">implementada {fmtDate(c.implementedAt)}</Badge> : null}
                </span>
              ),
            },
          ]}
          rowActions={(c: any, reload) =>
            can(ROLES.MANAGE) ? (
              <>
                {c.status === 'RASCUNHO' || c.status === 'REJEITADO' ? (
                  <Button size="sm" variant="outline" onClick={() => run(() => post('/approvals', { entityType: 'MUDANCA', entityId: c.id }), 'Mudança enviada para aprovação.', reload)}>
                    Submeter
                  </Button>
                ) : null}
                {c.status === 'APROVADO' && !c.implementedAt ? (
                  <Button size="sm" variant="outline" onClick={() => run(() => post(`/change-requests/${c.id}/implemented`), 'Implementação registrada.', reload)}>
                    Registrar implementação
                  </Button>
                ) : null}
              </>
            ) : null
          }
        />
      </div>
    </>
  );
}
