'use client';

import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ComboboxField, type ComboboxItem } from '@/components/ui/combobox-field';
import { Input } from '@/components/ui/input';
import { SelectNative } from '@/components/ui/select-native';
import { ROTULOS_SITUACAO, type FiltrosGrade, type SituacaoEstabelecimento } from '@/lib/fiscal-empresas';

interface FiltrosGradeProps {
  filtros: FiltrosGrade;
  empresas: ComboboxItem[];
  estabelecimentos: ComboboxItem[];
  busca: string;
  exportando: boolean;
  onBusca: (texto: string) => void;
  onEmpresa: (id: string) => void;
  onEstabelecimento: (id: string) => void;
  onSituacao: (situacao: SituacaoEstabelecimento | '') => void;
  onExportar: () => void;
}

/** Barra de filtros da grade: empresa, estabelecimento (depende da empresa), situação, busca e exportação. */
export function FiltrosGradeBarra({
  filtros,
  empresas,
  estabelecimentos,
  busca,
  exportando,
  onBusca,
  onEmpresa,
  onEstabelecimento,
  onSituacao,
  onExportar,
}: FiltrosGradeProps) {
  return (
    <div role="search" className="mb-3 flex flex-wrap items-end gap-2.5">
      <div className="flex w-56 flex-col gap-1">
        <label htmlFor="filtro-empresa" className="text-[11px] font-medium text-muted-foreground">
          Empresa
        </label>
        <ComboboxField
          id="filtro-empresa"
          items={empresas}
          value={filtros.empresaId}
          onChange={onEmpresa}
          placeholder="Todas as empresas"
          searchPlaceholder="Buscar empresa"
          emptyText="Nenhuma empresa encontrada."
          clearable
        />
      </div>
      <div className="flex w-56 flex-col gap-1">
        <label htmlFor="filtro-estabelecimento" className="text-[11px] font-medium text-muted-foreground">
          Estabelecimento
        </label>
        <ComboboxField
          id="filtro-estabelecimento"
          items={estabelecimentos}
          value={filtros.estabelecimentoId}
          onChange={onEstabelecimento}
          placeholder="Todos os estabelecimentos"
          searchPlaceholder="Buscar estabelecimento"
          emptyText="Nenhum estabelecimento encontrado."
          clearable
        />
      </div>
      <div className="flex w-44 flex-col gap-1">
        <label htmlFor="filtro-situacao" className="text-[11px] font-medium text-muted-foreground">
          Situação
        </label>
        <SelectNative
          id="filtro-situacao"
          value={filtros.situacao}
          onChange={(e) => onSituacao(e.target.value as SituacaoEstabelecimento | '')}
        >
          <option value="">Todos</option>
          {(Object.keys(ROTULOS_SITUACAO) as SituacaoEstabelecimento[]).map((s) => (
            <option key={s} value={s}>
              {ROTULOS_SITUACAO[s]}
            </option>
          ))}
        </SelectNative>
      </div>
      <Input
        type="search"
        className="w-72"
        aria-label="Buscar registros da lista"
        placeholder="Pesquisar descrição ou referência de negócio"
        maxLength={100}
        value={busca}
        onChange={(e) => onBusca(e.target.value)}
      />
      <span className="flex-1" />
      <Button type="button" size="sm" variant="secondary" loading={exportando} onClick={onExportar}>
        <Download /> Exportar visão
      </Button>
    </div>
  );
}
