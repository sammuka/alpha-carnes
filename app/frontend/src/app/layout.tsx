import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AlphaCarnes',
  description: 'Sistema de gestão operacional AlphaCarnes',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
