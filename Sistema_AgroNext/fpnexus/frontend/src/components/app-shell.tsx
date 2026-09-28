'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  BarChart3,
  Bell,
  Bot,
  Briefcase,
  CalendarCheck,
  ClipboardCheck,
  Coins,
  FileText,
  FolderKanban,
  Gauge,
  Handshake,
  Home,
  KeyRound,
  ListChecks,
  LogOut,
  Menu,
  Server,
  Settings,
  ShieldCheck,
  Sprout,
  Timer,
  Users,
  X,
} from 'lucide-react';
import { api, post } from '@/lib/api';
import { fmtDateTime } from '@/lib/format';
import { label } from '@/lib/labels';
import { cn } from '@/lib/utils';
import { Role, SessionProvider, useSession } from '@/components/session';

interface NavItem {
  href: string;
  text: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: Role[];
}

const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: 'Gestão de Projetos',
    items: [
      { href: '/', text: 'Início', icon: Home },
      { href: '/meu-trabalho', text: 'Meu Trabalho', icon: ListChecks },
      { href: '/projetos', text: 'Projetos', icon: FolderKanban },
      { href: '/portfolios', text: 'Portfólios e programas', icon: Briefcase },
    ],
  },
  {
    group: 'PMO Corporativo',
    items: [
      { href: '/pmo/aprovacoes', text: 'Aprovações', icon: ClipboardCheck },
      { href: '/pmo/reunioes', text: 'Sala de Reuniões', icon: CalendarCheck },
      { href: '/pmo/documentos', text: 'Documentos', icon: FileText },
      { href: '/pmo/contratos', text: 'Contratos', icon: Handshake },
    ],
  },
  {
    group: 'Governança e Compliance',
    items: [
      { href: '/governanca', text: 'Governança de TI', icon: Server },
      { href: '/compliance', text: 'Compliance Tecnológico', icon: ShieldCheck },
    ],
  },
  {
    group: 'Operação',
    items: [
      { href: '/financeiro', text: 'Gestão Financeira', icon: Coins },
      { href: '/recursos', text: 'Gestão de Recursos', icon: Users },
      { href: '/recursos/timesheet', text: 'Timesheet', icon: Timer, roles: ['ADMIN', 'PMO', 'GERENTE', 'MEMBRO'] },
      { href: '/agro', text: 'Agronegócio', icon: Sprout },
    ],
  },
  {
    group: 'Inteligência',
    items: [
      { href: '/ia', text: 'Inteligência Artificial', icon: Bot },
      { href: '/analytics', text: 'Analytics Avançado', icon: BarChart3 },
    ],
  },
  {
    group: 'Administração',
    items: [
      { href: '/admin', text: 'Usuários e organização', icon: Settings, roles: ['ADMIN', 'PMO'] },
      { href: '/compliance/auditoria', text: 'Trilha de auditoria', icon: Gauge, roles: ['ADMIN', 'PMO'] },
    ],
  },
];

function Brand() {
  return (
    <div className="border-b border-line bg-white px-4 py-4">
      {/* logo oficial sobre superfície branca; nesta largura o slogan da imagem fica ilegível e é repetido em texto */}
      <Image src="/brand/fpnexus-logo.jpeg" alt="FPNexus" width={1600} height={552} priority className="h-auto w-[200px]" />
      <p className="mt-1 text-[11px] font-medium text-agro-dark">Dados conectados. Decisões inteligentes.</p>
    </div>
  );
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { can } = useSession();
  // item ativo = rota de navegação mais específica que corresponde ao caminho atual
  const activeHref = NAV.flatMap((g) => g.items.map((i) => i.href))
    .filter((h) => (h === '/' ? pathname === '/' : pathname === h || pathname.startsWith(`${h}/`)))
    .sort((a, b) => b.length - a.length)[0];
  return (
    <nav aria-label="Navegação principal" className="flex h-full flex-col bg-white">
      <Brand />
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {NAV.map((g) => {
          const items = g.items.filter((i) => !i.roles || can(i.roles));
          if (!items.length) return null;
          return (
            <div key={g.group} className="mb-4">
              <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-subtle">{g.group}</p>
              <ul className="space-y-0.5">
                {items.map((i) => {
                  const active = i.href === activeHref;
                  return (
                    <li key={i.href}>
                      <Link
                        href={i.href}
                        onClick={onNavigate}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted hover:bg-surface hover:text-ink',
                          active && 'bg-agro-50 font-semibold text-agro-dark',
                        )}
                      >
                        <i.icon className={cn('size-4', active ? 'text-agro-dark' : 'text-subtle')} aria-hidden />
                        {i.text}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </nav>
  );
}

function Notifications() {
  const [open, setOpen] = React.useState(false);
  const [data, setData] = React.useState<{ unread: number; rows: any[] } | null>(null);
  const load = React.useCallback(() => api('/notifications').then(setData).catch(() => undefined), []);
  React.useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);
  return (
    <div className="relative">
      <button
        className="relative rounded-md p-2 text-muted hover:bg-surface"
        aria-label={`Notificações${data?.unread ? `: ${data.unread} não lidas` : ''}`}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Bell className="size-5" aria-hidden />
        {data?.unread ? (
          <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-danger px-1 text-[10px] font-bold text-white">{data.unread}</span>
        ) : null}
      </button>
      {open ? (
        <div className="absolute right-0 z-30 mt-2 w-80 rounded-lg border border-line bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-line px-3 py-2">
            <p className="text-sm font-semibold">Notificações</p>
            <button className="text-xs text-tech hover:underline" onClick={() => post('/notifications/read-all').then(load)}>
              Marcar todas como lidas
            </button>
          </div>
          <ul className="max-h-96 divide-y divide-line overflow-y-auto">
            {data?.rows.length ? (
              data.rows.map((n) => (
                <li key={n.id} className={cn('px-3 py-2 text-sm', !n.readAt && 'bg-agro-50/60')}>
                  <Link
                    href={n.link ?? '#'}
                    className="block"
                    onClick={() => {
                      setOpen(false);
                      if (!n.readAt) post(`/notifications/${n.id}/read`).then(load);
                    }}
                  >
                    <p className="font-medium text-ink">{n.title}</p>
                    {n.body ? <p className="text-muted">{n.body}</p> : null}
                    <p className="text-xs text-subtle">{fmtDateTime(n.createdAt)}</p>
                  </Link>
                </li>
              ))
            ) : (
              <li className="px-3 py-6 text-center text-sm text-muted">Nenhuma notificação.</li>
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function Header({ onMenu }: { onMenu: () => void }) {
  const { me } = useSession();
  const router = useRouter();
  async function logout() {
    try {
      await post('/auth/logout');
    } finally {
      router.replace('/login');
    }
  }
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-white px-4">
      <button className="rounded-md p-2 text-muted hover:bg-surface lg:hidden" onClick={onMenu} aria-label="Abrir menu">
        <Menu className="size-5" aria-hidden />
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">{me?.organization.name ?? '…'}</p>
        <p className="truncate text-xs text-subtle">{me ? `${me.organization.timezone} · ${me.organization.currency}` : ''}</p>
      </div>
      <Notifications />
      <div className="hidden text-right sm:block">
        <p className="text-sm font-medium text-ink">{me?.user.name}</p>
        <p className="text-xs text-subtle">{me ? label('role', me.role) : ''}</p>
      </div>
      <Link href="/conta" className="rounded-md p-2 text-muted hover:bg-surface" aria-label="Minha conta e alteração de senha">
        <KeyRound className="size-5" aria-hidden />
      </Link>
      <button onClick={logout} className="flex items-center gap-1 rounded-md px-2 py-2 text-sm text-muted hover:bg-surface" aria-label="Sair">
        <LogOut className="size-5" aria-hidden />
        <span className="hidden sm:inline">Sair</span>
      </button>
    </header>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobile, setMobile] = React.useState(false);
  return (
    <SessionProvider>
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:p-2">
        Pular para o conteúdo
      </a>
      <div className="flex min-h-screen">
        <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-line lg:block">
          <Sidebar />
        </aside>
        {mobile ? (
          <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
            <div className="absolute inset-0 bg-black/40" onClick={() => setMobile(false)} />
            <div className="absolute inset-y-0 left-0 w-72 border-r border-line bg-white">
              <button className="absolute right-2 top-2 rounded-md p-2 text-muted" onClick={() => setMobile(false)} aria-label="Fechar menu">
                <X className="size-5" aria-hidden />
              </button>
              <Sidebar onNavigate={() => setMobile(false)} />
            </div>
          </div>
        ) : null}
        <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
          <Header onMenu={() => setMobile(true)} />
          <main id="conteudo" className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6">
            {children}
          </main>
        </div>
      </div>
    </SessionProvider>
  );
}
