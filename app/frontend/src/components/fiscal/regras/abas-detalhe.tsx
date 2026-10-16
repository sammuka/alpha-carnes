'use client';

import { BadgeProvisorio } from '@/components/ui/badge-provisorio';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { rotuloData, rotuloDataHora, mascararCfop } from '@/lib/fiscal-enquadramentos';
import { formatarPercentualPtBr, type DetalheRegra, type EventoHistorico, type PreCondicao } from '@/lib/fiscal-regras';
import { AbaHistoricoFiscal, AbaMovimentacoes, AbaRegrasFiscal, ListaPreCondicoes } from '../comum/abas-fiscais';
import { Campo, SecaoRotulo } from '../empresas/aba-ficha';
import { AbaAceite, AbaExcecoes, AbaIntegracoes } from '../empresas/abas-informativas';

export type IdAba = 'ficha' | 'mov' | 'regras' | 'excecoes' | 'historico' | 'integracoes' | 'aceite';

/** Última recusa do servidor por exceção documentada, exibida na aba Exceções. */
export interface OcorrenciasRegra {
  beneficio?: string;
  vigencia?: string;
}

const REGRAS = [
  'motor de regras não permite edição retroativa em nota emitida; aprovação segregada',
  'Versão aprovada ou aposentada não é alterada; a alteração é uma versão nova.',
];

const PASSO_APROVACAO = 'Um aprovador diferente de quem submeteu libera a versão. O quórum numérico permanece provisório.';

const NOTA_NT = 'Esta tela não tem campo de versão de NT e o protótipo não traz código de erro. Nenhuma gravação é recusada por esse motivo.';

const REFERENCIA: Array<[string, string]> = [
  ['Campos', 'tratamento do ICMS, redução de base do ICMS, alíquota, benefício fiscal, tratamento de IPI e PIS/COFINS, tratamento de IBS/CBS e classificação IBS/CBS'],
  ['Ações', 'criar rascunho, adicionar versão, comparar, submeter, aprovar, aposentar'],
  ['Regras', 'motor de regras não permite edição retroativa em nota emitida; aprovação segregada'],
  ['Exceções', 'benefício não elegível; vigência ambígua; versão NT inválida'],
];

interface Props {
  detalhe: DetalheRegra | null;
  carregandoFicha: boolean;
  podeGerenciar: boolean;
  podeAprovar: boolean;
  aba: IdAba;
  onAba: (aba: IdAba) => void;
  historico: EventoHistorico[];
  carregandoHistorico: boolean;
  erroHistorico: string | null;
  preCondicoes: PreCondicao[];
  carregandoPreCondicoes: boolean;
  erroPreCondicoes: string | null;
  ocorrencias: OcorrenciasRegra;
  onEditar: () => void;
  onValidarPreCondicoes: () => void;
  onConsultarHistorico: () => void;
  onSubmeter: () => void;
  onAprovar: () => void;
  onAposentar: () => void;
  onAdicionarVersao: () => void;
  onComparar: () => void;
}

export function AbasDetalhe({
  detalhe, carregandoFicha, podeGerenciar, podeAprovar, aba, onAba, historico, carregandoHistorico, erroHistorico,
  preCondicoes, carregandoPreCondicoes, erroPreCondicoes, ocorrencias,
  onEditar, onValidarPreCondicoes, onConsultarHistorico, onSubmeter, onAprovar, onAposentar, onAdicionarVersao, onComparar,
}: Props) {
  if (!detalhe) {
    return carregandoFicha ? <Skeleton className="h-40" aria-label="Carregando a ficha" /> : null;
  }
  const situacao = detalhe.situacao;
  return (
    <Tabs value={aba} onValueChange={(valor) => onAba(valor as IdAba)}>
      <TabsList>
        <TabsTrigger value="ficha">Ficha e campos</TabsTrigger>
        <TabsTrigger value="mov">Movimentações</TabsTrigger>
        <TabsTrigger value="regras">Regras e validações</TabsTrigger>
        <TabsTrigger value="excecoes">Exceções</TabsTrigger>
        <TabsTrigger value="historico">Histórico</TabsTrigger>
        <TabsTrigger value="integracoes">Integrações</TabsTrigger>
        <TabsTrigger value="aceite">Aceite e testes</TabsTrigger>
      </TabsList>
      <TabsContent value="ficha" className="grid gap-4 text-sm">
        <div>
          <SecaoRotulo>Informações do registro selecionado</SecaoRotulo>
          <p className="mb-2 text-[11px] font-semibold text-muted-foreground">Dados principais</p>
          <div className="grid grid-cols-1 gap-x-3.5 gap-y-2.5 sm:grid-cols-2">
            <Campo label="Código"><span className="font-data">{detalhe.codigo}</span></Campo>
            <Campo label="Versão">{detalhe.numeroVersao}</Campo>
            <Campo label="Enquadramento fiscal">{detalhe.enquadramentoCodigo}</Campo>
            <Campo label="Operação">{detalhe.operacaoRotulo}</Campo>
            <Campo label="Operação fiscal (CFOP)"><span className="font-data">{mascararCfop(detalhe.cfopCodigo)}</span></Campo>
            <Campo label="Tratamento ICMS">{detalhe.tratamentoIcms}</Campo>
            <Campo label="Redução de base do ICMS (%)">{formatarPercentualPtBr(detalhe.pRedBc)}</Campo>
            <Campo label="Alíquota (%)">{formatarPercentualPtBr(detalhe.pIcms)}</Campo>
            <Campo label="Benefício fiscal">{detalhe.beneficioDescricao}</Campo>
            <Campo label="Tratamento IPI">{detalhe.tratamentoIpi}</Campo>
            <Campo label="Tratamento PIS/COFINS">{detalhe.tratamentoPis}</Campo>
            <Campo label="Tratamento IBS/CBS">{detalhe.tratamentoIbs}</Campo>
            <Campo label="Classificação IBS/CBS">{detalhe.classificacaoDescricao}</Campo>
            <Campo label="Início de vigência">
              <span className="flex flex-wrap items-center gap-2">{rotuloData(detalhe.vigenciaInicio)} <BadgeProvisorio codigo="H-E01-10" /></span>
            </Campo>
            <Campo label="Fim de vigência">
              <span className="flex flex-wrap items-center gap-2">{detalhe.vigenciaFim ? rotuloData(detalhe.vigenciaFim) : 'Sem fim'} <BadgeProvisorio codigo="H-E01-10" /></span>
            </Campo>
          </div>
        </div>
        <div>
          <SecaoRotulo>Trilha e responsabilização</SecaoRotulo>
          <div className="grid grid-cols-1 gap-x-3.5 gap-y-2.5 sm:grid-cols-3">
            <Campo label="Empresa">{detalhe.empresaNome}</Campo>
            <Campo label="Situação">{situacao}</Campo>
            <Campo label="Responsável">
              <span className="flex flex-wrap items-center gap-2">{detalhe.responsavel} <BadgeProvisorio codigo="H-E01-11" /></span>
            </Campo>
            <Campo label="Criado em">{rotuloDataHora(detalhe.criadoEm)}</Campo>
            <Campo label="Alterado em">{rotuloDataHora(detalhe.atualizadoEm)}</Campo>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {podeGerenciar && situacao === 'Rascunho' && <Button type="button" onClick={onEditar}>Editar versão</Button>}
          <Button type="button" variant="secondary" onClick={onValidarPreCondicoes}>Validar pré-condições</Button>
          <Button type="button" variant="secondary" onClick={onConsultarHistorico}>Consultar histórico</Button>
        </div>
        <ListaPreCondicoes itens={preCondicoes} carregando={carregandoPreCondicoes} erro={erroPreCondicoes} />
      </TabsContent>
      <TabsContent value="mov">
        <AbaMovimentacoes>
          {(podeGerenciar || podeAprovar) && (
            <div>
              <SecaoRotulo>Ações da regra</SecaoRotulo>
              <div className="flex flex-wrap gap-2">
                {podeGerenciar && <Button type="button" variant="secondary" disabled={situacao !== 'Rascunho'} onClick={onSubmeter}>Submeter</Button>}
                {podeAprovar && <Button type="button" disabled={situacao !== 'Submetida'} onClick={onAprovar}>Aprovar</Button>}
                {podeAprovar && <Button type="button" variant="secondary" disabled={situacao !== 'Aprovada'} onClick={onAposentar}>Aposentar</Button>}
                {podeGerenciar && <Button type="button" variant="secondary" disabled={situacao !== 'Aprovada' && situacao !== 'Aposentada'} onClick={onAdicionarVersao}>Adicionar versão</Button>}
                <Button type="button" variant="secondary" onClick={onComparar}>Comparar</Button>
              </div>
            </div>
          )}
        </AbaMovimentacoes>
      </TabsContent>
      <TabsContent value="regras">
        <AbaRegrasFiscal regras={REGRAS} passoAprovacao={PASSO_APROVACAO} />
      </TabsContent>
      <TabsContent value="excecoes">
        <AbaExcecoes
          itens={[
            { titulo: 'Benefício não elegível', nota: ocorrencias.beneficio },
            { titulo: 'Vigência ambígua', nota: ocorrencias.vigencia },
            { titulo: 'Versão NT inválida', nota: NOTA_NT },
          ]}
        />
      </TabsContent>
      <TabsContent value="historico">
        <AbaHistoricoFiscal eventos={historico} carregando={carregandoHistorico} erro={erroHistorico} />
      </TabsContent>
      <TabsContent value="integracoes">
        <AbaIntegracoes />
      </TabsContent>
      <TabsContent value="aceite">
        <AbaAceite referencia={REFERENCIA} />
      </TabsContent>
    </Tabs>
  );
}
