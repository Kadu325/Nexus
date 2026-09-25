import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-2xl font-semibold">Página não encontrada</h1>
      <Link href="/" className="text-tech underline">
        Voltar ao início
      </Link>
    </main>
  );
}
