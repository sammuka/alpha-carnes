'use client';

import { useState } from 'react';
import { useForm, type FieldValues } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CADASTROS, type CadastroConfig } from '@/lib/cadastros-config';

export type CadastroFormConfig = Omit<CadastroConfig, 'schema'>;

interface CadastroFormProps {
  config: CadastroFormConfig;
  /** Quando informado, o formulário edita o registro (PATCH); senão cria (POST). */
  registro?: Record<string, unknown> & { id: string };
}

export function CadastroForm({ config, registro }: CadastroFormProps) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const schema = CADASTROS[config.recurso]?.schema;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FieldValues>({
    resolver: schema ? zodResolver(schema) : undefined,
    defaultValues: registro ?? {},
  });

  const onSubmit = async (valores: FieldValues) => {
    setErro(null);
    const url = registro
      ? `/api/cadastros/${config.recurso}/${registro.id}`
      : `/api/cadastros/${config.recurso}`;
    // Nota: as rotas de página vivem em /cadastros/<recurso> (grupo de rota (admin) não entra na URL).
    try {
      const res = await fetch(url, {
        method: registro ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(valores),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        // Erro do backend (ex.: documento inválido/duplicado) é exibido ao usuário (RA-05).
        setErro(body.message ?? 'Falha ao salvar');
        return;
      }
      router.push(`/cadastros/${config.recurso}`);
    } catch {
      setErro('Erro de conexão');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl space-y-4" noValidate>
      {config.campos.map((campo) => {
        const erroCampo = errors[campo.nome]?.message as string | undefined;
        return (
          <div key={campo.nome} className="space-y-1">
            <Label htmlFor={campo.nome}>{campo.rotulo}</Label>
            {campo.tipo === 'select' ? (
              <select
                id={campo.nome}
                aria-label={campo.rotulo}
                className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
                {...register(campo.nome)}
              >
                {campo.opcoes?.map((op) => (
                  <option key={op.valor} value={op.valor}>
                    {op.rotulo}
                  </option>
                ))}
              </select>
            ) : campo.tipo === 'checkbox' ? (
              <input id={campo.nome} type="checkbox" aria-label={campo.rotulo} {...register(campo.nome)} />
            ) : (
              <Input
                id={campo.nome}
                type={campo.tipo === 'number' ? 'number' : campo.tipo === 'date' ? 'date' : 'text'}
                aria-label={campo.rotulo}
                placeholder={campo.placeholder}
                {...register(campo.nome)}
              />
            )}
            {erroCampo && <p className="text-sm text-destructive">{erroCampo}</p>}
          </div>
        );
      })}

      {erro && <p className="text-sm text-destructive">{erro}</p>}

      <div className="flex gap-2">
        <Button type="submit" loading={isSubmitting}>
          {registro ? 'Salvar' : 'Criar'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push(`/cadastros/${config.recurso}`)}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
