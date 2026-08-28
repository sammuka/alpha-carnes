'use client';

import { useState } from 'react';
import { Controller, useForm, type FieldValues } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePickerField } from '@/components/ui/date-picker-field';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { SelectNative } from '@/components/ui/select-native';
import { CADASTROS } from '@/lib/cadastros-config';
import { extrairErrosPorCampo, extrairMensagemErro } from '@/lib/error-message';

interface CadastroFormProps {
  /** Segmento da rota (`fornecedores`, `clientes`, …). O config fica no cliente — funções de máscara não cruzam o limite RSC. */
  recurso: string;
  /** Quando informado, o formulário edita o registro (PATCH); senão cria (POST). */
  registro?: Record<string, unknown> & { id: string };
}

export function CadastroForm({ recurso, registro }: CadastroFormProps) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const config = CADASTROS[recurso];
  const schema = config?.schema;

  const {
    register,
    control,
    handleSubmit,
    setError,
    setValue,
    getFieldState,
    formState,
  } = useForm<FieldValues>({
    resolver: schema ? zodResolver(schema) : undefined,
    defaultValues: registro ?? {},
  });
  const { isSubmitting } = formState;

  const onSubmit = async (valores: FieldValues) => {
    setErro(null);
    const url = registro
      ? `/api/cadastros/${recurso}/${registro.id}`
      : `/api/cadastros/${recurso}`;
    // Nota: as rotas de página vivem em /cadastros/<recurso> (grupo de rota (admin) não entra na URL).
    // Campos opcionais vazios (UUID, enum status, etc.) não podem ir como "" — o Zod do backend rejeita.
    const payload: Record<string, unknown> = { ...valores };
    for (const k of Object.keys(payload)) {
      const v = payload[k];
      if (v === '') {
        delete payload[k];
      } else if (v && typeof v === 'object' && !Array.isArray(v)) {
        const obj = { ...(v as Record<string, unknown>) };
        for (const kj of Object.keys(obj)) {
          if (obj[kj] === '') delete obj[kj];
        }
        payload[k] = obj;
      }
    }
    try {
      const res = await fetch(url, {
        method: registro ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body: unknown = await res.json().catch(() => null);
        // Erros que só o backend conhece (documento duplicado, regra de negócio) ancorados no campo.
        for (const [chave, mensagem] of Object.entries(extrairErrosPorCampo(body))) {
          setError(chave, { type: 'server', message: mensagem });
        }
        setErro(extrairMensagemErro(body, 'Falha ao salvar'));
        return;
      }
      router.push(`/cadastros/${recurso}`);
    } catch {
      setErro('Erro de conexão');
    }
  };

  if (!config) return null;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl space-y-3" noValidate>
      <div className="grid grid-cols-1 gap-x-3.5 gap-y-2.5 sm:grid-cols-2">
        {config.campos.map((campo) => {
          const chave = campo.jsonCampo ? `${campo.jsonCampo}.${campo.nome}` : campo.nome;
          const erroCampo = getFieldState(chave, formState).error?.message;
          return (
            <FormField
              key={chave}
              label={campo.rotulo}
              htmlFor={chave}
              error={erroCampo}
              className={campo.tipo === 'checkbox' ? 'sm:col-span-2' : undefined}
            >
              {campo.tipo === 'select' ? (
                <SelectNative
                  id={chave}
                  aria-label={campo.rotulo}
                  aria-invalid={erroCampo ? true : undefined}
                  {...register(chave)}
                >
                  {campo.opcoes?.map((op) => (
                    <option key={op.valor} value={op.valor}>
                      {op.rotulo}
                    </option>
                  ))}
                </SelectNative>
              ) : campo.tipo === 'checkbox' ? (
                <Controller
                  name={chave}
                  control={control}
                  render={({ field }) => (
                    <label className="flex items-center gap-2 text-[13px]">
                      <Checkbox
                        id={chave}
                        checked={field.value === true}
                        onCheckedChange={(v) => field.onChange(v === true)}
                      />
                      {campo.rotulo}
                    </label>
                  )}
                />
              ) : campo.tipo === 'date' ? (
                <Controller
                  name={chave}
                  control={control}
                  render={({ field }) => (
                    <DatePickerField
                      id={chave}
                      aria-label={campo.rotulo}
                      value={typeof field.value === 'string' ? field.value : ''}
                      onChange={field.onChange}
                    />
                  )}
                />
              ) : (
                <Input
                  id={chave}
                  type={campo.tipo === 'number' ? 'number' : 'text'}
                  aria-label={campo.rotulo}
                  placeholder={campo.placeholder}
                  maxLength={campo.maxLength}
                  aria-invalid={erroCampo ? true : undefined}
                  {...register(
                    chave,
                    campo.mascara
                      ? {
                          onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                            setValue(chave, campo.mascara!(e.target.value), { shouldDirty: true });
                          },
                        }
                      : undefined,
                  )}
                />
              )}
            </FormField>
          );
        })}
      </div>

      {erro && <p className="text-sm text-destructive">{erro}</p>}

      <div className="flex gap-2">
        <Button type="submit" loading={isSubmitting}>
          {registro ? 'Salvar' : 'Criar'}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.push(`/cadastros/${recurso}`)}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
