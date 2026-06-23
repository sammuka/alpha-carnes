'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlphaLogo } from '@/components/ui/alpha-logo';

const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(1, 'Senha obrigatória'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (data: LoginForm) => {
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError((body as { message?: string }).message ?? 'Credenciais inválidas');
        return;
      }
      router.push('/gestao/dashboard');
    } catch {
      setError('Erro de conexão');
    }
  };

  return (
    <main className="flex min-h-screen w-full font-sans">
      {/* Painel de marca (esquerda) */}
      <div className="relative hidden w-[45%] flex-col justify-between overflow-hidden bg-[#1F2633] p-12 lg:flex">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-t from-[#1F2633] via-[#1F2633]/90 to-[#1F2633]/70" />
        </div>
        <div className="relative z-10 flex items-center gap-3">
          <AlphaLogo className="h-10 w-10" />
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

      {/* Formulário (direita) */}
      <div className="relative flex flex-1 flex-col items-center justify-center p-8">
        <div className="absolute right-8 top-8 lg:right-8">
          <span className="rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
            Ambiente: Desenvolvimento
          </span>
        </div>

        <div className="absolute left-8 top-8 flex items-center gap-3 lg:hidden">
          <AlphaLogo className="h-8 w-8" />
          <h1 className="text-lg font-bold text-foreground">AlphaCarnes</h1>
        </div>

        <div className="w-full max-w-[400px]">
          <div className="mb-10 text-center lg:text-left">
            <h2 className="mb-2 text-2xl font-bold text-foreground">Bem-vindo de volta</h2>
            <p className="text-muted-foreground">Insira suas credenciais para acessar a operação.</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="admin@alphacarnes.local"
                  className="h-12"
                  {...register('email')}
                />
                {errors.email && (
                  <p className="text-xs text-destructive">{errors.email.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="h-12"
                  {...register('password')}
                />
                {errors.password && (
                  <p className="text-xs text-destructive">{errors.password.message}</p>
                )}
              </div>
            </div>

            {error && (
              <div role="alert" className="rounded-md border border-destructive/30 bg-destructive-bg px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            <Button type="submit" className="h-12 w-full" loading={isSubmitting}>
              Entrar
            </Button>
          </form>
        </div>
      </div>
    </main>
  );
}
