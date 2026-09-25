'use client';

import * as React from 'react';
import { post } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { fmtDateTime } from '@/lib/format';
import { label, options } from '@/lib/labels';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, Textarea } from '@/components/ui/input';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { Empty, ErrorBox, Loading, Notice, PageHeader, StatusBadge } from '@/components/common';
import { useSession } from '@/components/session';

export default function ApprovalsPage() {
  const [status, setStatus] = React.useState('PENDENTE');
  const { data, error, loading, reload } = useApi<any[]>(`/approvals${status ? `?status=${status}` : ''}`);
  const { me } = useSession();
  const [comments, setComments] = React.useState<Record<string, string>>({});
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null);

  async function run(fn: () => Promise<unknown>, ok: string) {
    setMsg(null);
    try {
      await fn();
      setMsg({ ok: true, text: ok });
      reload();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  }

  return (
    <>
      <PageHeader
        title="Aprovações"
        description="Aprovação eletrônica interna de TAP, Business Case, documentos (atas, políticas) e mudanças de TI. Quem submete não aprova o próprio pedido. Assinatura digital por provedor externo ainda não está integrada."
        actions={
          <Select aria-label="Filtrar por situação" value={status} onChange={(e) => setStatus(e.target.value)} className="w-48">
            <option value="">Todas</option>
            {options('decision').map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        }
      />
      {msg ? msg.ok ? <Notice kind="success" className="mb-4">{msg.text}</Notice> : <div className="mb-4"><ErrorBox message={msg.text} /></div> : null}
      <Card>
        <CardContent className="p-0">
          {loading && !data ? <Loading /> : null}
          {error ? <ErrorBox message={error} onRetry={reload} /> : null}
          {data?.length === 0 ? (
            <div className="p-4">
              <Empty text="Nenhum pedido nesta situação." />
            </div>
          ) : null}
          {data?.length ? (
            <Table>
              <THead>
                <tr>
                  <TH>Item</TH>
                  <TH>Tipo</TH>
                  <TH>Solicitante</TH>
                  <TH>Situação</TH>
                  <TH>Decisão</TH>
                </tr>
              </THead>
              <TBody>
                {data.map((r) => (
                  <TR key={r.id}>
                    <TD className="font-medium">{r.title}</TD>
                    <TD>{label('approvalEntity', r.entityType)}</TD>
                    <TD>
                      {r.requestedByName}
                      <p className="text-xs text-subtle">{fmtDateTime(r.createdAt)}</p>
                    </TD>
                    <TD>
                      <StatusBadge group="decision" value={r.status} />
                    </TD>
                    <TD className="min-w-72">
                      {r.canDecide ? (
                        <div className="space-y-2">
                          <Textarea
                            rows={2}
                            aria-label={`Comentário para ${r.title}`}
                            placeholder="Comentário (obrigatório para rejeitar)"
                            value={comments[r.id] ?? ''}
                            onChange={(e) => setComments((s) => ({ ...s, [r.id]: e.target.value }))}
                          />
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => run(() => post(`/approvals/${r.id}/decide`, { decision: 'APROVADO', comment: comments[r.id] || undefined }), 'Pedido aprovado.')}>
                              Aprovar
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => run(() => post(`/approvals/${r.id}/decide`, { decision: 'REJEITADO', comment: comments[r.id] || undefined }), 'Pedido rejeitado.')}>
                              Rejeitar
                            </Button>
                          </div>
                        </div>
                      ) : r.status === 'PENDENTE' && r.requestedById === me?.user.id ? (
                        <div className="space-y-1 text-xs text-muted">
                          <p>Aguardando outro aprovador (Administrador ou PMO).</p>
                          <Button size="sm" variant="secondary" onClick={() => run(() => post(`/approvals/${r.id}/cancel`), 'Pedido cancelado; item voltou a rascunho.')}>
                            Cancelar pedido
                          </Button>
                        </div>
                      ) : r.decidedAt ? (
                        <div className="text-xs text-muted">
                          {r.decidedByName} · {fmtDateTime(r.decidedAt)}
                          {r.comment ? <p className="mt-1 text-ink">“{r.comment}”</p> : null}
                        </div>
                      ) : (
                        <span className="text-xs text-subtle">Aguardando Administrador ou PMO.</span>
                      )}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          ) : null}
        </CardContent>
      </Card>
    </>
  );
}
