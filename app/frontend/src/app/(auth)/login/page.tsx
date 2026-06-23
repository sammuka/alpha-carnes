import dynamic from 'next/dynamic';
import { AlphaLogo } from '@/components/ui/alpha-logo';

const LoginFormClient = dynamic(
  () => import('./login-form-client').then((m) => m.LoginFormClient),
  {
    ssr: false,
    loading: () => (
      <div className="w-full max-w-[400px] animate-pulse space-y-6">
        <div className="mb-10 space-y-2">
          <div className="h-8 w-48 rounded bg-muted" />
          <div className="h-4 w-full rounded bg-muted" />
        </div>
        <div className="space-y-4">
          <div className="h-12 rounded bg-muted" />
          <div className="h-12 rounded bg-muted" />
        </div>
        <div className="h-12 rounded bg-muted" />
      </div>
    ),
  },
);

export default function LoginPage() {
  return (
    <main className="flex min-h-screen w-full font-sans">
      <div className="relative hidden w-[45%] flex-col justify-between overflow-hidden bg-[#1F2633] p-12 lg:flex">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-t from-[#1F2633] via-[#1F2633]/90 to-[#1F2633]/70" />
        </div>
        <div className="relative z-10 flex items-center gap-3">
          <AlphaLogo className="h-10 w-10" priority />
          <div>
            <h1 className="text-xl font-bold leading-tight text-white">AlphaCarnes</h1>
            <p className="text-[10px] uppercase tracking-widest text-[#70748C]">Sistema Integrado</p>
          </div>
        </div>
        <div className="relative z-10 max-w-sm">
          <h2 className="mb-4 text-3xl font-bold leading-tight text-white">
            Distribuição inteligente ponta a ponta.
          </h2>
          <p className="text-lg leading-relaxed text-[#B0B4BD]">
            Gestão operacional de recebimento, transformação e expedição.
          </p>
        </div>
      </div>

      <div className="relative flex flex-1 flex-col items-center justify-center p-8">
        <div className="absolute right-8 top-8 lg:right-8">
          <span className="rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
            Ambiente: Desenvolvimento
          </span>
        </div>

        <div className="absolute left-8 top-8 flex items-center gap-3 lg:hidden">
          <AlphaLogo className="h-8 w-8" priority />
          <h1 className="text-lg font-bold text-foreground">AlphaCarnes</h1>
        </div>

        <LoginFormClient />
      </div>
    </main>
  );
}
