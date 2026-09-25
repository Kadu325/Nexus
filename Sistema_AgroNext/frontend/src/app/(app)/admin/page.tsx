'use client';

import * as React from 'react';
import { post } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { fmtDateTime } from '@/lib/format';
import { label, options } from '@/lib/labels';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input, Label } from '@/components/ui/input';
import { CrudSection } from '@/components/crud-section';
import { EntityForm } from '@/components/entity-form';
import { ErrorBox, Loading, Notice, PageHeader } from '@/components/common';
import { ROLES, useSession } from '@/components/session';

function OrgSettings() {
  const { can, reload: reloadSession } = useSession();
  const org = useApi<any>('/admin/organization');
  const [saved, setSaved] = React.useState(false);
  if (!org.data) return org.error ? <ErrorBox message={org.error} /> : <Loading />;
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Organização</CardTitle>
          <CardDescription>Fuso, moeda, apetite a risco, limite diário de IA e bloqueio do timesheet.</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        {saved ? <Notice kind="success" className="mb-3">Configurações salvas.</Notice> : null}
        {can(ROLES.ADMIN) ? (
          <EntityForm
            key={JSON.stringify(org.data)}
            method="PATCH"
            path="/admin/organization"
            row={org.data}
            fields={[
              { name: 'name', label: 'Nome', required: true },
              { name: 'timezone', label: 'Fuso horário (IANA)', placeholder: 'America/Sao_Paulo' },
              { name: 'currency', label: 'Moeda (ISO 4217)', placeholder: 'BRL' },
              { name: 'riskAppetite', label: 'Apetite ao risco (exposição 1–25)', type: 'number', min: 1, max: 25 },
              { name: 'aiDailyLimit', label: 'Limite diário de requisições de IA', type: 'number', min: 0 },
              { name: 'timesheetLockedUntil', label: 'Bloquear apontamentos até', type: 'date' },
            ]}
            onSaved={() => {
              setSaved(true);
              org.reload();
              reloadSession();
            }}
          />
        ) : (
          <ul className="space-y-1 text-sm">
            <li>Nome: {org.data.name}</li>
            <li>Fuso: {org.data.timezone}</li>
            <li>Moeda: {org.data.currency}</li>
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminPage() {
  const { can, me } = useSession();
  const [reset, setReset] = React.useState<any | null>(null);
  const [pwd, setPwd] = React.useState('');
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null);
  const act = async (fn: () => Promise<unknown>, ok: string, reload?: () => void) => {
    setMsg(null);
    try {
      await fn();
      setMsg({ ok: true, text: ok });
      reload?.();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  };

  return (
    <>
      <PageHeader title="Usuários e organização" description="Nome de usuário único na instalação. Pessoas sem senha podem ser responsáveis por tarefas, mas não acessam o sistema. SSO, MFA e recuperação por e-mail ainda não estão configurados." />
      {msg ? msg.ok ? <Notice kind="success" className="mb-4">{msg.text}</Notice> : <div className="mb-4"><ErrorBox message={msg.text} /></div> : null}
      <div className="space-y-6">
        <CrudSection
          title="Usuários da organização"
          entityName="usuário"
          path="/admin/users"
          writeRoles={ROLES.ADMIN}
          deleteRoles={ROLES.ADMIN}
          fields={[
            { name: 'username', label: 'Nome de usuário', required: true, createOnly: true, help: 'Minúsculas, números, ponto, hífen ou sublinhado.' },
            { name: 'name', label: 'Nome completo', required: true },
            { name: 'email', label: 'E-mail' },
            { name: 'role', label: 'Papel', type: 'select', options: options('role'), required: true },
            { name: 'password', label: 'Senha inicial (opcional)', createOnly: true, help: 'Deixe em branco para cadastrar pessoa sem acesso. Mínimo de 12 caracteres.' },
          ]}
          columns={[
            {
              key: 'name',
              label: 'Pessoa',
              render: (u: any) => (
                <div>
                  <p className="font-medium">
                    {u.name} {u.id === me?.user.id ? <Badge tone="info">você</Badge> : null}
                  </p>
                  <p className="font-mono text-xs text-muted">{u.username}</p>
                </div>
              ),
            },
            { key: 'role', label: 'Papel', render: (u: any) => label('role', u.role) },
            { key: 'access', label: 'Acesso', render: (u: any) => (!u.active ? <Badge tone="danger">desativado</Badge> : u.canLogin ? <Badge tone="success">com senha</Badge> : <Badge>sem acesso</Badge>) },
            { key: 'created', label: 'Criado em', render: (u: any) => fmtDateTime(u.createdAt) },
          ]}
          rowActions={(u: any, reload) =>
            can(ROLES.ADMIN) && u.id !== me?.user.id && u.active ? (
              <>
                <Button size="sm" variant="ghost" onClick={() => setReset(u)}>
                  Definir senha
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (window.confirm(`Anonimizar ${u.name}? A conta é desativada e os dados pessoais removidos; a trilha de auditoria mantém apenas o identificador interno.`)) {
                      act(() => post(`/admin/users/${u.id}/anonymize`), 'Usuário anonimizado.', reload);
                    }
                  }}
                >
                  Anonimizar (LGPD)
                </Button>
              </>
            ) : null
          }
        />
        <OrgSettings />
      </div>
      <Dialog open={!!reset} onOpenChange={(o) => !o && setReset(null)}>
        {reset ? (
          <DialogContent title={`Definir senha — ${reset.name}`} description="As sessões ativas desse usuário serão encerradas.">
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                act(async () => {
                  await post(`/admin/users/${reset.id}/reset-password`, { newPassword: pwd });
                  setReset(null);
                  setPwd('');
                }, 'Senha definida.');
              }}
            >
              <Label htmlFor="np">Nova senha</Label>
              <Input id="np" type="password" autoComplete="new-password" minLength={12} required value={pwd} onChange={(e) => setPwd(e.target.value)} />
              <Button type="submit">Salvar</Button>
            </form>
          </DialogContent>
        ) : null}
      </Dialog>
    </>
  );
}

