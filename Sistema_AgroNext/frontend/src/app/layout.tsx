import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'FPNexus', template: '%s · FPNexus' },
  description: 'FPNexus — Dados conectados. Decisões inteligentes.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: '#1B5E20' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
