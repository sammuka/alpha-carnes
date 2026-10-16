'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { EstabelecimentoDetalhe } from '@/lib/fiscal-empresas';
import { AbaFicha } from './aba-ficha';
import { AbaHistorico, type EstadoHistorico } from './aba-historico';
import { AbaMovimentacoes, type AcoesMovimentacao } from './aba-movimentacoes';
import { AbaAceite, AbaExcecoes, AbaIntegracoes, AbaRegras } from './abas-informativas';

export const ABAS = [
  { id: 'ficha', rotulo: 'Ficha e campos' },
  { id: 'movimentacoes', rotulo: 'Movimentações' },
  { id: 'regras', rotulo: 'Regras e validações' },
  { id: 'excecoes', rotulo: 'Exceções' },
  { id: 'historico', rotulo: 'Histórico' },
  { id: 'integracoes', rotulo: 'Integrações' },
  { id: 'aceite', rotulo: 'Aceite e testes' },
] as const;

export type IdAba = (typeof ABAS)[number]['id'];

interface AbasDetalheProps extends AcoesMovimentacao {
  det: EstabelecimentoDetalhe;
  aba: IdAba;
  onAba: (aba: IdAba) => void;
  historico: EstadoHistorico;
  podeGerenciar: boolean;
  podeAprovar: boolean;
  chaveRecarga: number;
  onEditar: () => void;
  onEditarEmpresa: () => void;
  onTentarNovamenteHistorico: () => void;
}

/** As sete abas do detalhamento do estabelecimento selecionado. */
export function AbasDetalhe({
  det,
  aba,
  onAba,
  historico,
  podeGerenciar,
  podeAprovar,
  chaveRecarga,
  onEditar,
  onEditarEmpresa,
  onTentarNovamenteHistorico,
  ...acoes
}: AbasDetalheProps) {
  return (
    <Tabs value={aba} onValueChange={(valor) => onAba(valor as IdAba)}>
      <TabsList aria-label="Detalhamento do estabelecimento" className="flex-wrap">
        {ABAS.map((a) => (
          <TabsTrigger key={a.id} value={a.id} temErro={a.id === 'historico' && !!historico.erro}>
            {a.rotulo}
          </TabsTrigger>
        ))}
      </TabsList>
      <div className="pt-3">
        <TabsContent value="ficha">
          <AbaFicha
            det={det}
            podeGerenciar={podeGerenciar}
            chaveRecarga={chaveRecarga}
            onEditar={onEditar}
            onEditarEmpresa={onEditarEmpresa}
            onVerHistorico={() => onAba('historico')}
          />
        </TabsContent>
        <TabsContent value="movimentacoes">
          <AbaMovimentacoes det={det} podeGerenciar={podeGerenciar} podeAprovar={podeAprovar} {...acoes} />
        </TabsContent>
        <TabsContent value="regras">
          <AbaRegras />
        </TabsContent>
        <TabsContent value="excecoes">
          <AbaExcecoes />
        </TabsContent>
        <TabsContent value="historico">
          <AbaHistorico estado={historico} onTentarNovamente={onTentarNovamenteHistorico} />
        </TabsContent>
        <TabsContent value="integracoes">
          <AbaIntegracoes />
        </TabsContent>
        <TabsContent value="aceite">
          <AbaAceite />
        </TabsContent>
      </div>
    </Tabs>
  );
}
