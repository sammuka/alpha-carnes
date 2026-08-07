'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/ui/form-field';
import { extrairMensagemErro } from '@/lib/error-message';

const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(1, 'Senha obrigatória'),
});

type LoginForm = z.infer<typeof loginSchema>;

export function LoginFormClient() {
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
        setError(extrairMensagemErro(body, 'Credenciais inválidas'));
        return;
      }
      router.push('/');
    } catch {
      setError('Erro de conexão');
    }
  };

  return (
    <div className="w-full max-w-[400px]">
      <div className="mb-10 text-center lg:text-left">
        <h2 className="mb-2 text-xl font-bold tracking-[-0.015em] text-foreground">Bem-vindo de volta</h2>
        <p className="text-[13px] text-muted-foreground">Insira suas credenciais para acessar a operação.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
        <div className="space-y-4">
          <FormField label="E-mail" htmlFor="email" error={errors.email?.message}>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="nome@alphacarnes.com.br"
              className="h-9"
              {...register('email')}
            />
          </FormField>
          <FormField label="Senha" htmlFor="password" error={errors.password?.message}>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              className="h-9"
              {...register('password')}
            />
          </FormField>
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-md border border-destructive/30 bg-destructive-bg px-3 py-2 text-sm text-destructive"
          >
            {error}
          </div>
        )}

        <Button type="submit" variant="default" className="h-9 w-full" loading={isSubmitting}>
          Acessar Sistema
        </Button>
      </form>
    </div>
  );
}
