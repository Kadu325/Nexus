'use client';

import * as React from 'react';
import { api, patch, post } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { fmtDateTime } from '@/lib/format';
import { label, options } from '@/lib/labels';
import { REF } from '@/lib/fields';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Select, Textarea } from '@/components/ui/input';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { Empty, ErrorBox, Loading, Notice, PageHeader, StatusBadge } from '@/components/common';
import { EntityForm } from '@/components/entity-form';
import { ROLES, useSession } from '@/components/session';

function DocumentDialog({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const { can } = useSession();
  const [doc, setDoc] = React.useState<any | null>(null);
  const [text, setText] = React.useState('');
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null);
  const load = React.useCallback(() => api(`/documents/${id}`).then((d) => {
    setDoc(d);
    const draft = d.versions.find((v: any) => v.status === 'RASCUNHO' || v.status === 'REJEITADO');
    setText(draft?.content ?? d.versions[0]?.content ?? '');
  }), [id]);
  React.useEffect(() => {
    load().catch((e) => setMsg({ ok: false, text: e.message }));
  }, [load]);
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setMsg(null);
    try {
      await fn();
      setMsg({ ok: true, text: ok });
      await load();
      onChanged();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  };
  const draft = doc?.versions.find((v: any) => v.status === 'RASCUNHO' || v.status === 'REJEITADO');
  const locked = doc?.versions.some((v: any) => v.status === 'EM_APROVACAO');
  const manage = can(ROLES.MANAGE);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={doc?.title ?? 'Documento'} description={doc ? label('docType', doc.type) : undefined} className="max-w-3xl">
        {!doc ? <Loading /> : null}
        {msg ? msg.ok ? <Notice kind="success">{msg.text}</Notice> : <ErrorBox message={msg.text} /> : null}
        {doc ? (
          <div className="space-y-4">
            {manage && !locked ? (
              <>
                <Textarea aria-label="Conteúdo" rows={12} value={text} onChange={(e) => setText(e.target.value)} />
                <div className="flex flex-wrap gap-2">
                  {draft ? (
                    <>
                      <Button onClick={() => run(() => patch(`/documents/versions/${draft.id}`, { content: text }), 'Rascunho salvo.')}>Salvar rascunho v{draft.version}</Button>
                      <Button variant="outline" onClick={() => run(() => post('/approvals', { entityType: 'DOCUMENTO', entityId: draft.id }), 'Versão enviada para aprovação.')}>
                        Submeter para aprovação
                      </Button>
                    </>
                  ) : (
                    <Button onClick={() => run(() => post(`/documents/${id}/versions`, { content: text }), 'Nova versão criada; as anteriores foram preservadas.')}>Criar nova versão</Button>
                  )}
                </div>
              </>
            ) : null}
            {locked ? <Notice kind="warning">Há uma versão em aprovação.</Notice> : null}
            <ul className="space-y-2">
              {doc.versions.map((v: any) => (
                <li key={v.id} className="rounded-md border border-line p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong>Versão {v.version}</strong>
                    <StatusBadge group="approval" value={v.status} />
                    {v.aiGenerated ? <Badge tone="demo">gerada com IA</Badge> : null}
                    <span className="text-xs text-subtle">{fmtDateTime(v.createdAt)}</span>
                  </div>
                  {v.status === 'APROVADO' ? <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap font-sans text-sm text-muted">{v.content}</pre> : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export default function DocumentsPage() {
  const { can } = useSession();
  const [type, setType] = React.useState('');
  const { data, error, loading, reload } = useApi<any[]>(`/documents${type ? `?type=${type}` : ''}`);
  const [open, setOpen] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);

  return (
    <>
      <PageHeader
        title="Biblioteca de documentos"
        description="Wiki, POPs, procedimentos, políticas, lições aprendidas e atas, com versionamento e aprovação. Versões aprovadas não são reescritas."
        actions={
          <>
            <Select aria-label="Filtrar por tipo" value={type} onChange={(e) => setType(e.target.value)} className="w-48">
              <option value="">Todos os tipos</option>
              {options('docType').map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
            {can(ROLES.MANAGE) ? <Button onClick={() => setCreating(true)}>Novo documento</Button> : null}
          </>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle>Documentos</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading && !data ? <Loading /> : null}
          {error ? <ErrorBox message={error} onRetry={reload} /> : null}
          {data?.length === 0 ? (
            <div className="p-4">
              <Empty text="Nenhum documento." />
            </div>
          ) : null}
          {data?.length ? (
            <Table>
              <THead>
                <tr>
                  <TH>Título</TH>
                  <TH>Tipo</TH>
                  <TH>Última versão</TH>
                  <TH>Criado em</TH>
                </tr>
              </THead>
              <TBody>
                {data.map((d) => (
                  <TR key={d.id}>
                    <TD>
                      <button className="font-medium hover:text-tech" onClick={() => setOpen(d.id)}>
                        {d.title}
                      </button>
                    </TD>
                    <TD>{label('docType', d.type)}</TD>
                    <TD>{d.latest ? <>v{d.latest.version} <StatusBadge group="approval" value={d.latest.status} /></> : '—'}</TD>
                    <TD>{fmtDateTime(d.createdAt)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          ) : null}
        </CardContent>
      </Card>
      {open ? <DocumentDialog id={open} onClose={() => setOpen(null)} onChanged={reload} /> : null}
      <Dialog open={creating} onOpenChange={setCreating}>
        {creating ? (
          <DialogContent title="Novo documento" description="Atas são criadas na Sala de Reuniões.">
            <EntityForm
              path="/documents"
              fields={[
                { name: 'title', label: 'Título', required: true },
                { name: 'type', label: 'Tipo', type: 'select', required: true, options: options('docType').filter((o) => o.value !== 'ATA') },
                { name: 'projectId', label: 'Projeto (opcional)', type: 'ref', ref: REF.project },
                { name: 'content', label: 'Conteúdo (versão 1)', type: 'textarea', required: true },
              ]}
              onCancel={() => setCreating(false)}
              onSaved={() => {
                setCreating(false);
                reload();
              }}
            />
          </DialogContent>
        ) : null}
      </Dialog>
    </>
  );
}
