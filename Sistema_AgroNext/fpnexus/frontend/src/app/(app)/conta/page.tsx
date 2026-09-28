'use client';

import * as React from 'react';
import { post } from '@/lib/api';
import { label } from '@/lib/labels';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Label, Select } from '@/components/ui/input';
import { ErrorBox, Notice, PageHeader } from '@/components/common';
import { useSession } from '@/components/session';

export default function AccountPage() {
  const { me, reload } = useSession();
  const [form, setForm] = React.useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (form.newPassword !== form.confirm) return setMsg({ ok: false, text: 'A confirmação não corresponde à nova senha.' });
    setBusy(true);
    try {
      await post('/auth/change-password', { currentPassword: form.currentPassword, newPassword: form.newPassword });
      setForm({ currentPassword: '', newPassword: '', confirm: '' });
      setMsg({ ok: true, text: 'Senha alterada. As suas outras sessões foram encerradas.' });
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Minha conta" />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Dados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>Nome: {me?.user.name}</p>
            <p>
              Usuário: <span className="font-mono">{me?.user.username}</span>
            </p>
            <p>Papel: {label('role', me?.role)}</p>
            {me && me.organizations.length > 1 ? (
              <div className="pt-2">
                <Label htmlFor="org">Organização ativa</Label>
                <Select
                  id="org"
                  value={me.organization.id}
                  onChange={async (e) => {
                    await post('/auth/switch-organization', { orgId: e.target.value });
                    await reload();
                    window.location.href = '/';
                  }}
                >
                  {me.organizations.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name} ({label('role', o.role)})
                    </option>
                  ))}
                </Select>
              </div>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Alterar senha</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="cur">Senha atual</Label>
                <Input id="cur" type="password" autoComplete="current-password" required value={form.currentPassword} onChange={(e) => setForm((s) => ({ ...s, currentPassword: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new">Nova senha</Label>
                <Input id="new" type="password" autoComplete="new-password" required minLength={12} value={form.newPassword} onChange={(e) => setForm((s) => ({ ...s, newPassword: e.target.value }))} />
                <p className="text-xs text-subtle">Mínimo de 12 caracteres. Prefira uma frase longa.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="conf">Confirmar nova senha</Label>
                <Input id="conf" type="password" autoComplete="new-password" required value={form.confirm} onChange={(e) => setForm((s) => ({ ...s, confirm: e.target.value }))} />
              </div>
              {msg ? msg.ok ? <Notice kind="success">{msg.text}</Notice> : <ErrorBox message={msg.text} /> : null}
              <Button type="submit" disabled={busy}>
                {busy ? 'Salvando…' : 'Alterar senha'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
