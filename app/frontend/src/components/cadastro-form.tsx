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
import { CADASTROS, type CadastroConfig } from '@/lib/cadastros-config';
import { extrairErrosPorCampo, extrairMensagemErro } from '@/lib/error-message';

export type CadastroFormConfig = Omit<CadastroConfig, 'schema'>;

function omitirNulos(valor: unknown): unknown {
  if (valor === null) return undefined;
  if (Array.isArray(valor)) return valor.map(omitirNulos);
  if (valor && typeof valor === 'object') {
    return Object.fromEntries(
      Object.entries(valor as Record<string, unknown>).flatMap(([chave, atual]) => {
        const limpo = omitirNulos(atual);
        return limpo === undefined ? [] : [[chave, limpo]];
      }),
    );
  }
  return valor;
}

interface CadastroFormProps {
  config: CadastroFormConfig;
  /** Quando informado, o formulário edita o registro (PATCH); senão cria (POST). */
  registro?: Record<string, unknown> & { id: string };
}

export function CadastroForm({ config, registro }: CadastroFormProps) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const catalogo = CADASTROS[config.recurso];
  const schema = catalogo?.schema ?? (config as CadastroConfig).schema;
  const campos = catalogo?.campos ?? config.campos;

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
    defaultValues: {
      unidadeCompra: 'unidade',
      unidadeComercial: 'unidade',
      ...((registro ? omitirNulos(registro) : {}) as FieldValues),
    },
  });
  const { isSubmitting } = formState;

  const onSubmit = async (valores: FieldValues) => {
    setErro(null);
    const url = registro
      ? `/api/cadastros/${config.recurso}/${registro.id}`
      : `/api/cadastros/${config.recurso}`;
    // Nota: as rotas de página vivem em /cadastros/<recurso> (grupo de rota (admin) não entra na URL).
    // Campos opcionais vazios (UUID, enum status, etc.) não podem ir como "" — o Zod do backend rejeita.
    const payload: Record<string, unknown> = { ...valores };
    for (const k of Object.keys(payload)) {
      const v = payload[k];
      if (v === '' || v === null || v === undefined) {
        delete payload[k];
      } else if (v && typeof v === 'object' && !Array.isArray(v)) {
        const obj = { ...(v as Record<string, unknown>) };
        for (const kj of Object.keys(obj)) {
          if (obj[kj] === '') delete obj[kj];
        }
        payload[k] = obj;
      }
    }
    const raw = (payload.parametrosOperacionaisJson ?? {}) as Record<string, unknown>;
    if (config.recurso === 'fornecedores') {
      payload.parametrosOperacionaisJson = {
        romaneioAntecipado: Boolean(raw.romaneioAntecipado),
        ...(raw.horarioLimiteRecebimento ? { horarioLimiteRecebimento: raw.horarioLimiteRecebimento } : {}),
        ...(raw.capacidadeMaximaKg === '' || raw.capacidadeMaximaKg === undefined
          ? {}
          : { capacidadeMaximaKg: Number(raw.capacidadeMaximaKg) }),
        ...(raw.toleranciaDivergenciaPercentual === '' || raw.toleranciaDivergenciaPercentual === undefined
          ? {}
          : { toleranciaDivergenciaPercentual: Number(raw.toleranciaDivergenciaPercentual) }),
        ...(raw.notaQualidade ? { notaQualidade: raw.notaQualidade } : {}),
      };
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
      router.push(`/cadastros/${config.recurso}`);
    } catch {
      setErro('Erro de conexão');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl space-y-3" noValidate>
      <div className="grid grid-cols-1 gap-x-3.5 gap-y-2.5 sm:grid-cols-2">
        {campos.map((campo) => {
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
        <Button type="button" variant="ghost" onClick={() => router.push(`/cadastros/${config.recurso}`)}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
