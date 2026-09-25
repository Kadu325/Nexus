'use client';

import * as React from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input, Label, Select, Textarea } from '@/components/ui/input';
import { ErrorBox } from '@/components/common';
import { useSession } from '@/components/session';
import { cn } from '@/lib/utils';

export type FieldType = 'text' | 'textarea' | 'number' | 'money' | 'decimal' | 'date' | 'datetime' | 'select' | 'checkbox' | 'member' | 'ref' | 'tags';

export interface Field {
  name: string;
  label: string;
  type?: FieldType;
  required?: boolean;
  options?: { value: string; label: string }[];
  ref?: { path: string; labelOf: (r: any) => string };
  help?: string;
  placeholder?: string;
  createOnly?: boolean;
  defaultValue?: unknown;
  min?: number;
  max?: number;
  full?: boolean;
}

const refCache = new Map<string, Promise<any[]>>();
export function invalidateRef(path?: string) {
  if (path) refCache.delete(path);
  else refCache.clear();
}

function RefSelect({ field, value, onChange, id }: { field: Field; value: string; onChange: (v: string) => void; id: string }) {
  const [rows, setRows] = React.useState<any[] | null>(null);
  React.useEffect(() => {
    const path = field.ref!.path;
    if (!refCache.has(path)) refCache.set(path, api<any[]>(path).catch((e) => (refCache.delete(path), Promise.reject(e))));
    refCache.get(path)!.then(setRows, () => setRows([]));
  }, [field.ref]);
  return (
    <Select id={id} value={value} onChange={(e) => onChange(e.target.value)} required={field.required} disabled={!rows}>
      <option value="">{rows ? '— selecione —' : 'Carregando…'}</option>
      {(rows ?? []).map((r) => (
        <option key={r.id} value={r.id}>
          {field.ref!.labelOf(r)}
        </option>
      ))}
    </Select>
  );
}

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function initialValue(f: Field, row?: Record<string, any>) {
  const v = row?.[f.name] ?? (row ? undefined : f.defaultValue);
  if (f.type === 'checkbox') return !!v;
  if (v === null || v === undefined) return '';
  if (f.type === 'date') return String(v).slice(0, 10);
  if (f.type === 'datetime') return toLocalInput(String(v));
  if (f.type === 'tags') return Array.isArray(v) ? v.join(', ') : String(v);
  return String(v);
}

export function EntityForm({
  fields,
  row,
  path,
  fixed,
  onSaved,
  onCancel,
  submitLabel,
  method,
}: {
  fields: Field[];
  row?: Record<string, any> | null;
  path: string;
  fixed?: Record<string, unknown>;
  onSaved: (saved: any) => void;
  onCancel?: () => void;
  submitLabel?: string;
  method?: 'POST' | 'PATCH' | 'PUT';
}) {
  const { members } = useSession();
  const editing = !!row?.id;
  const visible = fields.filter((f) => !(editing && f.createOnly));
  const [values, setValues] = React.useState<Record<string, any>>(() => Object.fromEntries(visible.map((f) => [f.name, initialValue(f, row ?? undefined)])));
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const set = (name: string, v: unknown) => setValues((s) => ({ ...s, [name]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const body: Record<string, unknown> = { ...(editing ? {} : fixed) };
    for (const f of visible) {
      const raw = values[f.name];
      const original = row ? initialValue(f, row) : '';
      if (f.type === 'checkbox') {
        body[f.name] = !!raw;
        continue;
      }
      if (raw === '' || raw === undefined) {
        if (editing && original !== '') body[f.name] = null;
        continue;
      }
      switch (f.type) {
        case 'number':
          body[f.name] = Number(raw);
          break;
        case 'datetime':
          body[f.name] = new Date(raw).toISOString();
          break;
        case 'tags':
          body[f.name] = String(raw)
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
          break;
        case 'money':
        case 'decimal':
          body[f.name] = String(raw).replace(',', '.');
          break;
        default:
          body[f.name] = raw;
      }
    }
    setSaving(true);
    try {
      const target = editing && !method ? `${path}/${row!.id}` : path;
      const saved = await api(target, { method: method ?? (editing ? 'PATCH' : 'POST'), body });
      onSaved(saved);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate={false}>
      <div className="grid gap-4 sm:grid-cols-2">
        {visible.map((f) => {
          const id = `f-${f.name}`;
          const v = values[f.name];
          const full = f.full || f.type === 'textarea';
          let control: React.ReactNode;
          switch (f.type) {
            case 'textarea':
              control = <Textarea id={id} value={v} onChange={(e) => set(f.name, e.target.value)} required={f.required} placeholder={f.placeholder} rows={4} />;
              break;
            case 'select':
              control = (
                <Select id={id} value={v} onChange={(e) => set(f.name, e.target.value)} required={f.required}>
                  <option value="">— selecione —</option>
                  {f.options!.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              );
              break;
            case 'member':
              control = (
                <Select id={id} value={v} onChange={(e) => set(f.name, e.target.value)} required={f.required}>
                  <option value="">— sem responsável —</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </Select>
              );
              break;
            case 'ref':
              control = <RefSelect id={id} field={f} value={v} onChange={(x) => set(f.name, x)} />;
              break;
            case 'checkbox':
              control = (
                <input id={id} type="checkbox" className="size-4 accent-[var(--color-agro-dark)]" checked={!!v} onChange={(e) => set(f.name, e.target.checked)} />
              );
              break;
            default: {
              const typeMap: Record<string, string> = { number: 'number', money: 'text', decimal: 'text', date: 'date', datetime: 'datetime-local' };
              const type = typeMap[f.type ?? 'text'] ?? 'text';
              control = (
                <Input
                  id={id}
                  type={type}
                  inputMode={f.type === 'money' || f.type === 'decimal' ? 'decimal' : undefined}
                  value={v}
                  min={f.min}
                  max={f.max}
                  onChange={(e) => set(f.name, e.target.value)}
                  required={f.required}
                  placeholder={f.placeholder ?? (f.type === 'money' ? '0,00' : f.type === 'tags' ? 'separe por vírgulas' : undefined)}
                />
              );
            }
          }
          return (
            <div key={f.name} className={cn('space-y-1.5', full && 'sm:col-span-2', f.type === 'checkbox' && 'flex items-center gap-2 space-y-0')}>
              {f.type === 'checkbox' ? control : null}
              <Label htmlFor={id}>
                {f.label}
                {f.required ? <span className="text-danger"> *</span> : null}
              </Label>
              {f.type !== 'checkbox' ? control : null}
              {f.help ? <p className="text-xs text-subtle">{f.help}</p> : null}
            </div>
          );
        })}
      </div>
      {error ? <ErrorBox message={error} /> : null}
      <div className="flex justify-end gap-2">
        {onCancel ? (
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancelar
          </Button>
        ) : null}
        <Button type="submit" disabled={saving}>
          {saving ? 'Salvando…' : submitLabel ?? 'Salvar'}
        </Button>
      </div>
    </form>
  );
}
