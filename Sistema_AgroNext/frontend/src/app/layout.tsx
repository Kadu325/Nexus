import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'FPNexus - Dados conectados. Decisões inteligentes.',
  description: 'Gestão de Projetos, PMO e AgroTech',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body className="bg-[#F5F7FA] min-h-screen">
        {children}
      </body>
    </html>
  )
}
