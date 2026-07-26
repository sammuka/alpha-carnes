'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { CadastroMasterDetail } from '@/components/cadastro-master-detail';
import { Badge } from '@/components/ui/badge';
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
    <div className="flex gap-2 overflow-x-auto">
      <Badge className="bg-login-panel text-white hover:bg-login-panel">
        Todos ({contagens.total})
      </Badge>
      <Badge variant="outline" className="text-login-text">
        Ativos ({contagens.ativos})
      </Badge>
      <Badge variant="outline" className="text-login-text">
        Inativos ({contagens.inativos})
      </Badge>
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
    <section className="space-y-4">
      <h3 className="flex items-center gap-2 border-b border-border pb-2 text-sm font-bold text-foreground">
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
        <div className="space-y-3 rounded-lg border border-border p-4">
          <div className="flex items-center justify-between border-b border-border pb-2 text-sm">
            <span className="text-muted-foreground">Total de Ocorrências (Ano)</span>
            <span className="font-bold text-destructive">
              {historico.ocorrenciasAno} {historico.ocorrenciasAno === 1 ? 'registro' : 'registros'}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Última Divergência</span>
            {historico.ultimaDivergencia ? (
              <UltimaDivergenciaLinha item={historico.ultimaDivergencia} />
            ) : (
              <span className="font-medium text-foreground">—</span>
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
