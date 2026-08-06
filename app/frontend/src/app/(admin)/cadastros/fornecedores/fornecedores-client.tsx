'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { CadastroMasterDetail } from '@/components/cadastro-master-detail';
import { FilterChip } from '@/components/ui/filter-chip';
import { fornecedoresConfig } from '@/lib/cadastros-config';
import { mensagemDeErro } from '@/lib/error-message';
import {
  rotuloTipoDivergencia,
  tipoDivergenciaEhSlugConhecido,
} from '@/lib/rotulos-tipo-divergencia';

interface Contagens {
  total: number;
  ativos: number;
  inativos: number;
}

interface Historico {
  ocorrenciasAno: number;
  /** `tipo`: slug da divergencia (join) ou descricao da ocorrencia (fallback — decisao 18) */
  ultimaDivergencia: { data: string; tipo: string } | null;
}

function UltimaDivergenciaLinha({ item }: { item: { data: string; tipo: string } }) {
  const dataFmt = new Date(item.data).toLocaleDateString('pt-BR');
  const textoTipo = rotuloTipoDivergencia(item.tipo);

  if (tipoDivergenciaEhSlugConhecido(item.tipo)) {
    return (
      <span className="font-medium text-foreground">
        {dataFmt} · {textoTipo}
      </span>
    );
  }

  return (
    <span className="inline-flex max-w-full items-center gap-1 font-medium text-foreground">
      <span>{dataFmt} ·</span>
      <span className="truncate max-w-[220px]" title={item.tipo}>
        {textoTipo}
      </span>
    </span>
  );
}

function Chips() {
  const [contagens, setContagens] = useState<Contagens | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/cadastros/fornecedores/contagens', { cache: 'no-store' });
        if (!res.ok) {
          setErro(await mensagemDeErro(res));
          return;
        }
        setContagens((await res.json()) as Contagens);
      } catch {
        setErro('Erro de conexão com o servidor.');
      }
    })();
  }, []);

  if (erro) {
    return (
      <p role="alert" className="text-xs text-destructive">
        {erro}
      </p>
    );
  }
  if (!contagens) return <p className="text-xs text-muted-foreground">Carregando contagens…</p>;

  return (
    <div className="flex gap-1.5 overflow-x-auto">
      <FilterChip active>Todos ({contagens.total})</FilterChip>
      <FilterChip>Ativos ({contagens.ativos})</FilterChip>
      <FilterChip>Inativos ({contagens.inativos})</FilterChip>
    </div>
  );
}

function BlocoHistorico({ fornecedorId }: { fornecedorId: string }) {
  const [historico, setHistorico] = useState<Historico | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    setHistorico(null);
    setErro(null);
    void (async () => {
      try {
        const res = await fetch(`/api/cadastros/fornecedores/${fornecedorId}/historico`, { cache: 'no-store' });
        if (!res.ok) {
          setErro(await mensagemDeErro(res));
          return;
        }
        setHistorico((await res.json()) as Historico);
      } catch {
        setErro('Erro de conexão com o servidor.');
      }
    })();
  }, [fornecedorId]);

  return (
    /* Quarta seção do detalhe — Fornecedores.tsx:201-221 */
    <section className="space-y-3">
      <h3 className="flex items-center gap-2 border-b border-border pb-2 text-[13px] font-bold text-foreground">
        <AlertTriangle className="size-4 text-muted-foreground" />
        Histórico &amp; Ocorrências
      </h3>

      {erro ? (
        <p role="alert" className="text-sm text-destructive">
          {erro}
        </p>
      ) : !historico ? (
        <p className="text-sm text-muted-foreground">Carregando histórico…</p>
      ) : (
        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 rounded-md border border-border p-3 text-xs">
          <div>
            <p className="text-muted-foreground">Total de Ocorrências (Ano)</p>
            <p className="font-medium text-destructive">
              {historico.ocorrenciasAno} {historico.ocorrenciasAno === 1 ? 'registro' : 'registros'}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Última Divergência</p>
            {historico.ultimaDivergencia ? (
              <UltimaDivergenciaLinha item={historico.ultimaDivergencia} />
            ) : (
              <p className="font-medium text-foreground">—</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

export function FornecedoresClient({ podeGerenciar }: { podeGerenciar: boolean }) {
  const { schema: _s, ...config } = fornecedoresConfig;
  void _s;

  return (
    <CadastroMasterDetail
      config={config}
      tituloPagina="Fornecedores / Frigoríficos"
      subtitulo="Cadastro de fornecedores e parâmetros operacionais"
      podeGerenciar={podeGerenciar}
      filtrosExtras={<Chips />}
      blocoDetalheExtra={(id) => <BlocoHistorico fornecedorId={id} />}
    />
  );
}
