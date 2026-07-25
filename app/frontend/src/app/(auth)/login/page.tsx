import { AlphaLogo } from '@/components/ui/alpha-logo';
import { LoginFormShell } from './login-form-shell';

const ambiente = process.env.NEXT_PUBLIC_AMBIENTE;

export default function LoginPage() {
  return (
    <main className="flex min-h-screen w-full bg-card font-sans">
      <div className="relative hidden w-[45%] flex-col justify-between overflow-hidden bg-login-panel p-12 lg:flex">
        <div
          className="absolute inset-0 z-0 bg-gradient-to-t from-login-panel via-login-panel/80 to-transparent"
          aria-hidden="true"
        />
        <div className="relative z-10 flex items-center gap-3">
          <AlphaLogo className="h-10 w-10" priority />
          <div>
            <h1 className="text-xl font-bold leading-tight text-white">AlphaCarnes</h1>
            <p className="text-[10px] uppercase leading-none tracking-widest text-login-panel-caption">
              Sistema Integrado
            </p>
          </div>
        </div>
        <div className="relative z-10 max-w-sm">
          <h2 className="mb-4 text-3xl font-bold leading-tight text-white">
            Distribuição inteligente ponta a ponta.
          </h2>
          <p className="text-lg leading-relaxed text-login-panel-text">
            Gestão operacional de recebimento, transformação e expedição.
          </p>
        </div>
      </div>

      <div className="relative flex flex-1 flex-col items-center justify-center p-8">
        <div className="absolute left-8 top-8 flex items-center gap-3 lg:hidden">
          <AlphaLogo className="h-8 w-8" priority />
          <h1 className="text-lg font-bold text-login-heading">AlphaCarnes</h1>
        </div>

        {ambiente && (
          <div className="absolute right-8 top-8">
            <span className="rounded-full border border-border-chip bg-surface-chip px-3 py-1 text-xs font-medium text-login-text">
              Ambiente: {ambiente}
            </span>
          </div>
        )}

        <LoginFormShell />
      </div>
    </main>
  );
}
