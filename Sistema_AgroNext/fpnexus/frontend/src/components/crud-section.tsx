'use client';

import * as React from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { del } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { Empty, ErrorBox, Loading } from '@/components/common';
import { EntityForm, Field, invalidateRef } from '@/components/entity-form';
import { Role, useSession } from '@/components/session';

export interface Column<T = any> {
  key: string;
  label: string;
  render?: (row: T) => React.ReactNode;
  className?: string;
}

export function CrudSection<T extends { id: string }>({
  title,
  description,
  path,
  query,
  fields,
  columns,
  writeRoles,
  deleteRoles,
  fixed,
  emptyText = 'Nenhum registro cadastrado.',
  rowActions,
  headerExtra,
  editable = true,
  onChange,
  entityName = 'registro',
  transform,
}: {
  title: string;
  description?: string;
  path: string;
  query?: string;
  fields: Field[];
  columns: Column<T>[];
  writeRoles: Role[];
  deleteRoles?: Role[];
  fixed?: Record<string, unknown>;
  emptyText?: string;
  rowActions?: (row: T, reload: () => void) => React.ReactNode;
  headerExtra?: React.ReactNode;
  editable?: boolean;
  onChange?: () => void;
  entityName?: string;
  transform?: (rows: T[]) => T[];
}) {
  const { can } = useSession();
  const { data, error, loading, reload } = useApi<T[]>(`${path}${query ? `?${query}` : ''}`);
  const [editing, setEditing] = React.useState<T | null | 'new'>(null);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const canWrite = can(writeRoles);
  const canDelete = deleteRoles ? can(deleteRoles) : false;
  const rows = data ? (transform ? transform(data) : data) : [];

  async function remove(row: T) {
    if (!window.confirm(`Excluir este ${entityName}? A exclusão fica registrada na trilha de auditoria.`)) return;
    setDeleteError(null);
    try {
      await del(`${path}/${row.id}`);
      invalidateRef(path);
      await reload();
      onChange?.();
    } catch (e) {
      setDeleteError((e as Error).message);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {headerExtra}
          {canWrite ? (
            <Button size="sm" onClick={() => setEditing('new')}>
              <Plus aria-hidden /> Novo
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading && !data ? <Loading /> : null}
        {error ? (
          <div className="p-4">
            <ErrorBox message={error} onRetry={reload} />
          </div>
        ) : null}
        {deleteError ? (
          <div className="p-4">
            <ErrorBox message={deleteError} />
          </div>
        ) : null}
        {data && rows.length === 0 ? (
          <div className="p-4">
            <Empty text={emptyText} />
          </div>
        ) : null}
        {rows.length > 0 ? (
          <Table>
            <THead>
              <tr>
                {columns.map((c) => (
                  <TH key={c.key} className={c.className}>
                    {c.label}
                  </TH>
                ))}
                {(canWrite && editable) || canDelete || rowActions ? <TH className="text-right">Ações</TH> : null}
              </tr>
            </THead>
            <TBody>
              {rows.map((row) => (
                <TR key={row.id}>
                  {columns.map((c) => (
                    <TD key={c.key} className={c.className}>
                      {c.render ? c.render(row) : String((row as any)[c.key] ?? '—')}
                    </TD>
                  ))}
                  {(canWrite && editable) || canDelete || rowActions ? (
                    <TD className="whitespace-nowrap text-right">
                      <div className="flex justify-end gap-1">
                        {rowActions?.(row, reload)}
                        {canWrite && editable ? (
                          <Button size="icon" variant="ghost" onClick={() => setEditing(row)} aria-label={`Editar ${entityName}`}>
                            <Pencil aria-hidden />
                          </Button>
                        ) : null}
                        {canDelete ? (
                          <Button size="icon" variant="ghost" onClick={() => remove(row)} aria-label={`Excluir ${entityName}`}>
                            <Trash2 aria-hidden className="text-danger" />
                          </Button>
                        ) : null}
                      </div>
                    </TD>
                  ) : null}
                </TR>
              ))}
            </TBody>
          </Table>
        ) : null}
      </CardContent>
      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        {editing !== null ? (
          <DialogContent title={editing === 'new' ? `Novo ${entityName}` : `Editar ${entityName}`}>
            <EntityForm
              fields={fields}
              row={editing === 'new' ? null : editing}
              path={path}
              fixed={fixed}
              onCancel={() => setEditing(null)}
              onSaved={async () => {
                setEditing(null);
                invalidateRef(path);
                await reload();
                onChange?.();
              }}
            />
          </DialogContent>
        ) : null}
      </Dialog>
    </Card>
  );
}
