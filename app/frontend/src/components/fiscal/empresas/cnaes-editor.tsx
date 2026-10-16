'use client';

import { Info, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { SelectNative } from '@/components/ui/select-native';
import {
  ErroFiscal,
  mascararCnae,
  normalizarCnae,
  ROTULOS_TIPO_CNAE,
  type CnaeItem,
  type TipoCnae,
} from '@/lib/fiscal-empresas';

/** Erros do editor: um texto por linha (índice) e um texto da lista inteira. */
export interface ErrosCnaes {
  lista: string | null;
  linhas: Record<number, string>;
}

export const SEM_ERROS_CNAES: ErrosCnaes = { lista: null, linhas: {} };

export const AVISO_CONFERENCIA_CNAE =
  'Confira os códigos e descrições com a documentação da empresa (cartão CNPJ). O sistema não consulta a Receita Federal.';

const MSG_FORMATO = 'CNAE deve ter 7 dígitos (0000-0/00).';

/** Validação local: formato, descrição e código repetido. Principal ausente só é exigido na aprovação. */
export function validarCnaes(lista: CnaeItem[]): ErrosCnaes {
  const linhas: Record<number, string> = {};
  const vistos = new Map<string, number>();
  lista.forEach((cnae, i) => {
    const codigo = normalizarCnae(cnae.codigo);
    if (codigo.length !== 7) linhas[i] = MSG_FORMATO;
    else if (vistos.has(codigo)) linhas[i] = 'Código de CNAE repetido.';
    else if (!cnae.descricao.trim()) linhas[i] = 'Informe a descrição da atividade.';
    vistos.set(codigo, i);
  });
  return { lista: null, linhas };
}

/** Lista normalizada e ordenada para envio e comparação: a ordem do backend não é contrato. */
export function normalizarListaCnaes(lista: CnaeItem[]): CnaeItem[] {
  return lista
    .map((c) => ({ codigo: normalizarCnae(c.codigo), descricao: c.descricao.trim(), tipo: c.tipo }))
    .sort((a, b) => a.codigo.localeCompare(b.codigo) || a.tipo.localeCompare(b.tipo));
}

export function temErroCnaes(erros: ErrosCnaes): boolean {
  return erros.lista !== null || Object.keys(erros.linhas).length > 0;
}

/** Traduz a resposta 400/422 do backend para a linha ou para a lista do editor. */
export function errosCnaesDoServidor(erro: unknown, lista: CnaeItem[]): ErrosCnaes | null {
  if (!(erro instanceof ErroFiscal)) return null;
  const linhas: Record<number, string> = {};
  for (const [caminho, texto] of Object.entries(erro.porCampo)) {
    const achado = /^cnaes\.(\d+)\./.exec(caminho);
    if (achado) linhas[Number(achado[1])] = texto;
  }
  if (Object.keys(linhas).length > 0) return { lista: null, linhas };
  if (erro.codigo === 'CNAE_DUPLICADO') {
    const codigo = normalizarCnae(String(erro.dados.codigo ?? ''));
    lista.forEach((cnae, i) => {
      if (normalizarCnae(cnae.codigo) === codigo) linhas[i] = 'Código de CNAE repetido.';
    });
    return Object.keys(linhas).length > 0 ? { lista: null, linhas } : { lista: erro.message, linhas };
  }
  if (erro.codigo === 'CNAE_PRINCIPAL_UNICO' || erro.codigo === 'CNAE_PRINCIPAL_AUSENTE') {
    return { lista: erro.message, linhas };
  }
  return null;
}

interface CnaesEditorProps {
  value: CnaeItem[];
  onChange: (lista: CnaeItem[]) => void;
  erros?: ErrosCnaes;
  disabled?: boolean;
}

/** Editor manual de CNAEs: um principal, sem código repetido, sem consulta externa (AD-24 (3)). */
export function CnaesEditor({ value, onChange, erros = SEM_ERROS_CNAES, disabled }: CnaesEditorProps) {
  const alterarLinha = (indice: number, mudanca: Partial<CnaeItem>) => {
    onChange(
      value.map((cnae, i) => {
        if (i === indice) return { ...cnae, ...mudanca };
        // Marcar uma linha como principal desmarca a anterior.
        if (mudanca.tipo === 'PRINCIPAL' && cnae.tipo === 'PRINCIPAL') return { ...cnae, tipo: 'SECUNDARIA' };
        return cnae;
      }),
    );
  };

  const adicionar = () => {
    const tipo: TipoCnae = value.some((c) => c.tipo === 'PRINCIPAL') ? 'SECUNDARIA' : 'PRINCIPAL';
    onChange([...value, { codigo: '', descricao: '', tipo }]);
  };

  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
        Atividade econômica (CNAE)
      </legend>

      <div className="flex items-start gap-2 rounded-md bg-info-soft p-2.5 text-[11px] text-info-fg">
        <Info className="mt-px size-3.5 shrink-0" aria-hidden="true" />
        <p>{AVISO_CONFERENCIA_CNAE}</p>
      </div>

      {value.length === 0 && (
        <p className="text-xs text-muted-foreground">Nenhuma atividade informada. Adicione ao menos a principal.</p>
      )}

      {value.map((cnae, i) => (
        <div key={i} className="grid grid-cols-[110px_minmax(0,1fr)_120px_auto] items-start gap-2">
          <FormField label="Código" htmlFor={`cnae-codigo-${i}`} error={erros.linhas[i]}>
            <Input
              id={`cnae-codigo-${i}`}
              aria-label={`Código do CNAE ${i + 1}`}
              inputMode="numeric"
              maxLength={9}
              placeholder="0000-0/00"
              value={mascararCnae(cnae.codigo)}
              aria-invalid={i in erros.linhas || undefined}
              onChange={(e) => alterarLinha(i, { codigo: normalizarCnae(e.target.value) })}
            />
          </FormField>
          <FormField label="Descrição" htmlFor={`cnae-descricao-${i}`}>
            <Input
              id={`cnae-descricao-${i}`}
              aria-label={`Descrição do CNAE ${i + 1}`}
              maxLength={255}
              value={cnae.descricao}
              aria-invalid={i in erros.linhas || undefined}
              onChange={(e) => alterarLinha(i, { descricao: e.target.value })}
            />
          </FormField>
          <FormField label="Tipo" htmlFor={`cnae-tipo-${i}`}>
            <SelectNative
              id={`cnae-tipo-${i}`}
              aria-label={`Tipo da atividade ${i + 1}`}
              value={cnae.tipo}
              onChange={(e) => alterarLinha(i, { tipo: e.target.value as TipoCnae })}
            >
              <option value="PRINCIPAL">{ROTULOS_TIPO_CNAE.PRINCIPAL}</option>
              <option value="SECUNDARIA">{ROTULOS_TIPO_CNAE.SECUNDARIA}</option>
            </SelectNative>
          </FormField>
          <Button
            type="button"
            variant="ghost"
            size="iconSm"
            className="mt-[22px]"
            aria-label={`Remover atividade ${i + 1}`}
            title="Remover atividade"
            onClick={() => onChange(value.filter((_, j) => j !== i))}
          >
            <Trash2 className="text-destructive" />
          </Button>
        </div>
      ))}

      {erros.lista && (
        <p role="alert" className="text-[11px] font-medium text-danger-fg">
          {erros.lista}
        </p>
      )}

      <Button type="button" variant="secondary" size="sm" onClick={adicionar}>
        <Plus /> Adicionar atividade
      </Button>
    </fieldset>
  );
}
