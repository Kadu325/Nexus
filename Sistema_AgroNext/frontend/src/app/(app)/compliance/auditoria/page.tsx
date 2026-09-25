'use client';

import * as React from 'react';
import { useApi } from '@/lib/hooks';
import { fmtDateTime } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { Empty, ErrorBox, Loading, PageHeader } from '@/components/common';

export default function AuditPage() {
  const [page, setPage] = React.useState(1);
  const [entity, setEntity] = React.useState('');
  const [filter, setFilter] = React.useState('');
  const { data, error, loading, reload } = useApi<any>(`/audit-logs?page=${page}${filter ? `&entity=${encodeURIComponent(filter)}` : ''}`);
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <>
      <PageHeader
        title="Trilha de auditoria"
        description="Registro de acessos, alterações, aprovações, exclusões, exportações e consultas. Senhas e tokens nunca são gravados. A própria consulta desta trilha é auditada."
      />
      <form
        className="mb-4 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setFilter(entity.trim());
        }}
      >
        <Input aria-label="Filtrar por entidade" placeholder="Entidade (ex.: Tarefa, Sessao, Aprovacao)" value={entity} onChange={(e) => setEntity(e.target.value)} className="max-w-xs" />
        <Button type="submit" variant="secondary">
          Filtrar
        </Button>
      </form>
      <Card>
        <CardContent className="p-0">
          {loading && !data ? <Loading /> : null}
          {error ? <ErrorBox message={error} onRetry={reload} /> : null}
          {data?.rows.length === 0 ? (
            <div className="p-4">
              <Empty text="Nenhum evento." />
            </div>
          ) : null}
          {data?.rows.length ? (
            <Table>
              <THead>
                <tr>
                  <TH>Quando</TH>
                  <TH>Usuário</TH>
                  <TH>Ação</TH>
                  <TH>Entidade</TH>
                  <TH>Detalhes</TH>
                </tr>
              </THead>
              <TBody>
                {data.rows.map((r: any) => (
                  <TR key={r.id}>
                    <TD className="whitespace-nowrap">{fmtDateTime(r.createdAt)}</TD>
                    <TD>{r.userName ?? 'Sistema'}</TD>
                    <TD className="font-medium">{r.action}</TD>
                    <TD>
                      {r.entity}
                      {r.entityId ? <p className="font-mono text-[11px] text-subtle">{r.entityId}</p> : null}
                    </TD>
                    <TD>
                      {r.summary ? (
                        <details>
                          <summary className="cursor-pointer text-xs text-tech">ver</summary>
                          <pre className="mt-1 max-w-md overflow-auto whitespace-pre-wrap text-[11px] text-muted">{JSON.stringify(r.summary, null, 2)}</pre>
                        </details>
                      ) : (
                        '—'
                      )}
                      {r.ip ? <p className="text-[11px] text-subtle">IP {r.ip}</p> : null}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          ) : null}
        </CardContent>
      </Card>
      <div className="mt-3 flex items-center gap-2 text-sm">
        <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
          Anterior
        </Button>
        <span>
          Página {page} de {pages} {data ? `· ${data.total} evento(s)` : ''}
        </span>
        <Button size="sm" variant="secondary" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
          Próxima
        </Button>
      </div>
    </>
  );
}
