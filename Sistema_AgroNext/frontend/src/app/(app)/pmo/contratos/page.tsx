'use client';

import { useApi } from '@/lib/hooks';
import { fmtDate, fmtMoney } from '@/lib/format';
import { options } from '@/lib/labels';
import { REF } from '@/lib/fields';
import { Badge } from '@/components/ui/badge';
import { CrudSection } from '@/components/crud-section';
import { PageHeader, StatusBadge } from '@/components/common';
import { ROLES, useSession } from '@/components/session';

export default function ContractsPage() {
  const { me, memberName } = useSession();
  const balances = useApi<any[]>('/contracts-balance');
  const currency = me?.organization.currency ?? 'BRL';
  const bal = new Map((balances.data ?? []).map((b) => [b.contractId, b]));
  return (
    <>
      <PageHeader
        title="Contratos e aquisições"
        description="Saldo = valor total − despesas realizadas vinculadas ao contrato. Aviso de vencimento nos 30 dias finais de vigência. Integração com ERP pendente."
      />
      <CrudSection
        title="Contratos"
        entityName="contrato"
        path="/contracts"
        writeRoles={ROLES.PMO}
        deleteRoles={ROLES.PMO}
        onChange={balances.reload}
        fields={[
          { name: 'supplier', label: 'Fornecedor', required: true },
          { name: 'object', label: 'Objeto', required: true },
          { name: 'totalValue', label: 'Valor total', type: 'money', required: true },
          { name: 'status', label: 'Situação', type: 'select', options: options('contract') },
          { name: 'startDate', label: 'Início da vigência', type: 'date', required: true },
          { name: 'endDate', label: 'Fim da vigência', type: 'date', required: true },
          { name: 'projectId', label: 'Projeto', type: 'ref', ref: REF.project },
          { name: 'costCenterId', label: 'Centro de custo', type: 'ref', ref: REF.costCenter },
          { name: 'ownerId', label: 'Responsável', type: 'member' },
        ]}
        columns={[
          {
            key: 'supplier',
            label: 'Contrato',
            render: (c: any) => (
              <div>
                <p className="font-medium">{c.supplier}</p>
                <p className="text-xs text-muted">{c.object}</p>
              </div>
            ),
          },
          { key: 'status', label: 'Situação', render: (c: any) => <StatusBadge group="contract" value={c.status} /> },
          {
            key: 'vig',
            label: 'Vigência',
            render: (c: any) => (
              <span>
                {fmtDate(c.startDate)} a {fmtDate(c.endDate)} {c.expiringSoon ? <Badge tone="warning">vence em {c.daysToEnd} dia(s)</Badge> : null}
              </span>
            ),
          },
          { key: 'total', label: 'Valor', render: (c: any) => fmtMoney(c.totalValue, currency), className: 'text-right tabular-nums' },
          { key: 'saldo', label: 'Saldo', render: (c: any) => (bal.get(c.id) ? fmtMoney(bal.get(c.id).saldo, currency) : '…'), className: 'text-right tabular-nums' },
          { key: 'owner', label: 'Responsável', render: (c: any) => memberName(c.ownerId) },
        ]}
      />
    </>
  );
}
