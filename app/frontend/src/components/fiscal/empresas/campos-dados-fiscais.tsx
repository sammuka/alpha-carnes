'use client';

import { BadgeProvisorio } from '@/components/ui/badge-provisorio';
import { ComboboxField } from '@/components/ui/combobox-field';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { SelectNative } from '@/components/ui/select-native';
import { UFS_BRASIL } from '@/lib/dominios';
import type { CnaeItem, DadosFiscais } from '@/lib/fiscal-empresas';
import { CnaesEditor, type ErrosCnaes } from './cnaes-editor';

export const DADOS_VAZIOS: DadosFiscais = {
  nome: '',
  inscricaoEstadual: '',
  inscricaoMunicipal: '',
  uf: '',
};

export const TEXTO_OPCIONAL = 'Opcional; não impede a aprovação';
const TEXTO_SEM_CADASTRO = 'Nenhum cadastro disponível para seleção. Consulte a área responsável.';

/** Campo ainda sem cadastro de origem: desabilitado, com selo Provisório e sem bloquear a aprovação (AD-24 (2)). */
export function CampoProvisorio({ id, label, placeholder }: { id: string; label: string; placeholder: string }) {
  return (
    <FormField
      label={
        <span className="inline-flex items-center gap-1.5">
          {label}
          <BadgeProvisorio />
        </span>
      }
      htmlFor={id}
      help={TEXTO_OPCIONAL}
    >
      <ComboboxField
        id={id}
        items={[]}
        value=""
        onChange={() => undefined}
        placeholder={placeholder}
        searchPlaceholder="Pesquisar pelo nome"
        emptyText={TEXTO_SEM_CADASTRO}
        disabled
      />
    </FormField>
  );
}

interface CamposDadosFiscaisProps {
  valores: DadosFiscais;
  onCampo: (campo: keyof DadosFiscais, valor: string) => void;
  erros: Record<string, string>;
  cnaes: CnaeItem[];
  onCnaes: (lista: CnaeItem[]) => void;
  errosCnaes: ErrosCnaes;
  disabled?: boolean;
}

/** Campos editáveis comuns ao rascunho do estabelecimento e à proposta de alteração. */
export function CamposDadosFiscais({
  valores,
  onCampo,
  erros,
  cnaes,
  onCnaes,
  errosCnaes,
  disabled,
}: CamposDadosFiscaisProps) {
  return (
    <>
      <div className="grid grid-cols-1 gap-x-3.5 gap-y-2.5 sm:grid-cols-2">
        <FormField label="Estabelecimento" required htmlFor="fiscal-nome" error={erros.nome} className="sm:col-span-2">
          <Input
            id="fiscal-nome"
            value={valores.nome}
            maxLength={120}
            disabled={disabled}
            aria-invalid={'nome' in erros || undefined}
            onChange={(e) => onCampo('nome', e.target.value)}
          />
        </FormField>

        <FormField label="Inscrição estadual" required htmlFor="fiscal-ie" error={erros.inscricaoEstadual}>
          <Input
            id="fiscal-ie"
            value={valores.inscricaoEstadual}
            maxLength={20}
            disabled={disabled}
            aria-invalid={'inscricaoEstadual' in erros || undefined}
            onChange={(e) => onCampo('inscricaoEstadual', e.target.value)}
          />
        </FormField>

        <FormField label="Inscrição municipal" required htmlFor="fiscal-im" error={erros.inscricaoMunicipal}>
          <Input
            id="fiscal-im"
            value={valores.inscricaoMunicipal}
            maxLength={20}
            disabled={disabled}
            aria-invalid={'inscricaoMunicipal' in erros || undefined}
            onChange={(e) => onCampo('inscricaoMunicipal', e.target.value)}
          />
        </FormField>

        <FormField label="Estado" required htmlFor="fiscal-uf" error={erros.uf}>
          <SelectNative
            id="fiscal-uf"
            value={valores.uf}
            disabled={disabled}
            aria-invalid={'uf' in erros || undefined}
            onChange={(e) => onCampo('uf', e.target.value)}
          >
            <option value="">Selecione o estado</option>
            {UFS_BRASIL.map((uf) => (
              <option key={uf} value={uf}>
                {uf}
              </option>
            ))}
          </SelectNative>
        </FormField>

        <CampoProvisorio id="fiscal-municipio" label="Município" placeholder="Selecione o município" />
        <CampoProvisorio id="fiscal-certificado" label="Certificado vinculado" placeholder="Selecione o certificado" />
      </div>

      <CnaesEditor value={cnaes} onChange={onCnaes} erros={errosCnaes} disabled={disabled} />
    </>
  );
}
