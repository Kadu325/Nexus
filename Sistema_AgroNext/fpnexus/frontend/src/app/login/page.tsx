'use client';

import * as React from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';

function safeNext(value: string | null) {
  // evita redirecionamento aberto: aceita apenas caminhos internos
  return value && value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/login') ? value : '/';
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [show, setShow] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const errorRef = React.useRef<HTMLParagraphElement>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api('/auth/login', { method: 'POST', body: { username, password } });
      router.replace(safeNext(params.get('next')));
    } catch (err) {
      const msg =
        err instanceof ApiError && err.status === 429
          ? err.message
          : err instanceof ApiError && err.status === 401
            ? 'Usuário ou senha inválidos.'
            : 'Não foi possível entrar agora. Tente novamente em instantes.';
      setError(msg);
      setPassword('');
      requestAnimationFrame(() => errorRef.current?.focus());
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5" aria-describedby={error ? 'login-erro' : undefined}>
      <div className="space-y-1.5">
        <Label htmlFor="username">Usuário</Label>
        <Input
          id="username"
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          aria-invalid={!!error}
          autoFocus
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Senha</Label>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={show ? 'text' : 'password'}
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={!!error}
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-md text-muted hover:text-ink"
            aria-label={show ? 'Ocultar senha' : 'Exibir senha'}
            aria-pressed={show}
          >
            {show ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
          </button>
        </div>
      </div>
      {error ? (
        <p id="login-erro" ref={errorRef} tabIndex={-1} role="alert" className="rounded-md border border-danger/30 bg-danger-50 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
      <Button type="submit" size="lg" className="w-full" disabled={loading || !username || !password}>
        {loading ? (
          <>
            <Loader2 className="animate-spin" aria-hidden /> Entrando…
          </>
        ) : (
          'Entrar'
        )}
      </Button>
      <p className="text-center text-xs text-subtle">
        Esqueceu a senha? Procure o administrador da sua organização. A recuperação por e-mail ainda não está disponível.
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="flex items-center justify-center bg-white px-6 py-10">
        <div className="w-full max-w-md">
          {/* logo oficial com o slogan embutido; fundo branco preservado, sem repetir o slogan em texto */}
          <Image
            src="/brand/fpnexus-logo.jpeg"
            alt="FPNexus — Dados conectados. Decisões inteligentes."
            width={1600}
            height={552}
            priority
            className="mb-8 h-auto w-full max-w-[440px]"
          />
          <h1 className="mb-1 text-xl font-semibold text-ink">Acesse sua conta</h1>
          <p className="mb-6 text-sm text-muted">Use o usuário e a senha fornecidos pela administração da sua organização.</p>
          <React.Suspense fallback={null}>
            <LoginForm />
          </React.Suspense>
        </div>
      </section>
      <section
        aria-hidden
        className="relative hidden overflow-hidden bg-gradient-to-br from-agro-dark via-[#1f6b3a] to-petrol lg:flex lg:flex-col lg:justify-end lg:p-12"
      >
        <svg className="absolute inset-0 h-full w-full opacity-20" viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice">
          {Array.from({ length: 14 }).map((_, i) => (
            <path key={i} d={`M0 ${40 + i * 26} Q 200 ${10 + i * 26} 400 ${40 + i * 26}`} stroke="white" strokeWidth="1" fill="none" />
          ))}
          {[
            [80, 90],
            [300, 140],
            [210, 260],
            [120, 320],
            [340, 300],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="5" fill="white" />
          ))}
        </svg>
        <div className="relative max-w-md text-white">
          <p className="text-3xl font-semibold leading-tight">Projetos, portfólio, governança e campo em uma única plataforma.</p>
          <p className="mt-3 text-sm text-white/85">PMO, finanças, recursos, compliance, IA e indicadores do agronegócio com rastreabilidade de ponta a ponta.</p>
        </div>
      </section>
    </main>
  );
}
