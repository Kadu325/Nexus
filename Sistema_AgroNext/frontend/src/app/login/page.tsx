'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) throw new Error('Credenciais inválidas. Tente novamente.');
      const data = await res.json();
      // Salva a sessão para uso em headers x-org-id e x-user-id
      sessionStorage.setItem('orgId', data.organizationId);
      sessionStorage.setItem('userId', data.userId);
      sessionStorage.setItem('role', data.role);
      router.push('/projects');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F7FA]">
      <div className="w-full max-w-md bg-white p-8 rounded-lg shadow-lg">
        <div className="flex flex-col items-center mb-8">
          <div className="relative w-48 h-16 mb-2">
            <Image src="/FPNexusV2(2).jpeg" alt="Logo FPNexus" fill style={{ objectFit: 'contain' }} priority />
          </div>
          <p className="text-sm font-medium text-[#1B5E20]">Dados conectados. Decisões inteligentes.</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          {error && <div className="p-3 text-sm text-red-700 bg-red-100 rounded-md">{error}</div>}

          <div>
            <label className="block text-sm font-medium text-gray-700">Usuário</label>
            <input
              type="text" required
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-[#4CAF50] focus:border-[#4CAF50]"
              value={username} onChange={(e) => setUsername(e.target.value)} disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Senha</label>
            <div className="relative mt-1">
              <input
                type={showPassword ? 'text' : 'password'} required
                className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-[#4CAF50] focus:border-[#4CAF50]"
                value={password} onChange={(e) => setPassword(e.target.value)} disabled={loading}
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-sm text-[#1565C0]"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? 'Ocultar' : 'Exibir'}
              </button>
            </div>
          </div>

          <button
            type="submit" disabled={loading}
            className="w-full py-2 px-4 border border-transparent rounded-md text-white bg-[#4CAF50] hover:bg-[#1B5E20] transition-colors disabled:opacity-50"
          >
            {loading ? 'Autenticando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}