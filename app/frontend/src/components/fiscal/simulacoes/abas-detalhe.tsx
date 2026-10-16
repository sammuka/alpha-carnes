'use client';

import { BadgeProvisorio } from '@/components/ui/badge-provisorio';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { rotuloDataHora } from '@/lib/fiscal-enquadramentos';
import {
  TEXTO_FALTA_PADRAO,
  formatarDinheiroPtBr,
  formatarEscalaPtBr,
  type DetalheSimulacao,
  type EventoHistorico,
  type Explicacao,
  type PreCondicao,
} from '@/lib/fiscal-simulacoes';
import { AbaHistoricoFiscal, AbaMovimentacoes, AbaRegrasFiscal, ListaPreCondicoes } from '../comum/abas-fiscais';
import { Campo, SecaoRotulo } from '../empresas/aba-ficha';
import { AbaAceite, AbaExcecoes, AbaIntegracoes, Aviso } from '../empresas/abas-informativas';
import { ExplicacaoPainel } from './explicacao-painel';

export type IdAba = 'ficha' | 'mov' | 'regras' | 'excecoes' | 'historico' | 'integracoes' | 'aceite';

const REGRAS = [
  'nenhum valor gerado vira lançamento fiscal sem documento; Decimal exato',
  'Quantidade e peso informado na nota ficam registrados e não multiplicam o valor.',
  'A base e o ICMS saem de conta inteira em centavos, com meio para cima, sem número de ponto flutuante.',
];

const PASSO_APROVACAO = 'Esta tela não aprova nem publica regra. O quórum numérico permanece provisório.';

const REFERENCIA: Array<[string, string]> = [
  ['Campos', 'classificação fiscal (NCM), operação, cliente, competência, pesos, valor, descontos, bases, tributos por item, regras selecionadas'],
  ['Ações', 'simular, explicar tributos, exportar memória, comparar versões'],
  ['Regras', 'nenhum valor gerado vira lançamento fiscal sem documento; Decimal exato'],
  ['Exceções', 'base tributável difere de valor bruto; falta referência legal'],
];

const moeda = (canon: string) => `R$ ${formatarDinheiroPtBr(canon)}`;

interface Props {
  detalhe: DetalheSimulacao | null;
  carregandoFicha: boolean;
  podeGerenciar: boolean;
  aba: IdAba;
  onAba: (aba: IdAba) => void;
  historico: EventoHistorico[];
  carregandoHistorico: boolean;
  erroHistorico: string | null;
  preCondicoes: PreCondicao[];
  carregandoPreCondicoes: boolean;
  erroPreCondicoes: string | null;
  explicacao: Explicacao | null;
  carregandoExplicacao: boolean;
  erroExplicacao: string | null;
  /** Mensagem do último 422 FALTA_REFERENCIA_LEGAL. */
  falta: string | null;
  onExplicar: () => void;
  onExportarMemoria: () => void;
  onComparar: () => void;
  onNovaVersao: () => void;
  onValidarPreCondicoes: () => void;
  onConsultarHistorico: () => void;
}

export function AbasDetalhe({
  detalhe, carregandoFicha, podeGerenciar, aba, onAba, historico, carregandoHistorico, erroHistorico,
  preCondicoes, carregandoPreCondicoes, erroPreCondicoes, explicacao, carregandoExplicacao, erroExplicacao, falta,
  onExplicar, onExportarMemoria, onComparar, onNovaVersao, onValidarPreCondicoes, onConsultarHistorico,
}: Props) {
  if (!detalhe) {
    return carregandoFicha ? <Skeleton className="h-40" aria-label="Carregando a ficha" /> : null;
  }
  const notaBase = detalhe.baseDifereBruto
    ? (explicacao?.textoBase ?? (erroExplicacao ?? (carregandoExplicacao ? 'Carregando a explicação da base tributável…' : undefined)))
    : 'Nesta simulação a base tributável é igual ao valor bruto.';
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
        {detalhe.baseDifereBruto && <Aviso alerta>Base tributável difere de valor bruto</Aviso>}
        <div>
          <SecaoRotulo>Informações do registro selecionado</SecaoRotulo>
          <p className="mb-2 text-[11px] font-semibold text-muted-foreground">Dados principais</p>
          <div className="grid grid-cols-1 gap-x-3.5 gap-y-2.5 sm:grid-cols-2">
            <Campo label="Código"><span className="font-data">{detalhe.codigo}</span></Campo>
            <Campo label="Versão">{detalhe.numeroVersao}</Campo>
            <Campo label="Situação">{detalhe.situacao}</Campo>
            <Campo label="Estabelecimento">{detalhe.estabelecimento}</Campo>
            <Campo label="Operação">{detalhe.operacao}</Campo>
            <Campo label="Cliente">{detalhe.cliente}</Campo>
            <Campo label="Produto">{detalhe.produto}</Campo>
            <Campo label="Classificação fiscal (NCM)"><span className="font-data">{detalhe.ncm}</span></Campo>
            <Campo label="Quantidade">{formatarEscalaPtBr(detalhe.quantidade)}</Campo>
            <Campo label="Peso informado na nota (kg)">{formatarEscalaPtBr(detalhe.pesoNf)}</Campo>
            <Campo label="Valor">{moeda(detalhe.valor)}</Campo>
            <Campo label="Desconto">{moeda(detalhe.desconto)}</Campo>
            <Campo label="Competência">
              <span className="flex flex-wrap items-center gap-2">{detalhe.competenciaRotulo} <BadgeProvisorio codigo="H-E01-10" /></span>
            </Campo>
            <Campo label="Enquadramento fiscal">{detalhe.enquadramento}</Campo>
            <Campo label="Base tributável (calculada)">{moeda(detalhe.baseTributavel)}</Campo>
            <Campo label="Valor líquido (calculado)">{moeda(detalhe.valorLiquido)}</Campo>
          </div>
        </div>
        <div>
          <SecaoRotulo>Trilha e responsabilização</SecaoRotulo>
          <div className="grid grid-cols-1 gap-x-3.5 gap-y-2.5 sm:grid-cols-3">
            <Campo label="Empresa">{detalhe.empresa}</Campo>
            <Campo label="Situação">{detalhe.situacao}</Campo>
            <Campo label="Responsável">
              <span className="flex flex-wrap items-center gap-2">{detalhe.responsavel} <BadgeProvisorio codigo="H-E01-11" /></span>
            </Campo>
            <Campo label="Criado em">{rotuloDataHora(detalhe.criadoEm)}</Campo>
            <Campo label="Alterado em">{rotuloDataHora(detalhe.atualizadoEm)}</Campo>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={onExplicar}>Explicar tributos</Button>
          <Button type="button" variant="secondary" onClick={onExportarMemoria}>Exportar memória</Button>
          <Button type="button" variant="secondary" onClick={onComparar}>Comparar versões</Button>
          {podeGerenciar && <Button type="button" variant="secondary" onClick={onNovaVersao}>Nova versão</Button>}
          <Button type="button" variant="secondary" onClick={onValidarPreCondicoes}>Validar pré-condições</Button>
          <Button type="button" variant="secondary" onClick={onConsultarHistorico}>Consultar histórico</Button>
        </div>
        {carregandoExplicacao && <Skeleton className="h-16" aria-label="Carregando a explicação" />}
        {erroExplicacao && <p role="alert" className="text-xs text-destructive">{erroExplicacao}</p>}
        {explicacao && <ExplicacaoPainel explicacao={explicacao} />}
        <ListaPreCondicoes itens={preCondicoes} carregando={carregandoPreCondicoes} erro={erroPreCondicoes} />
      </TabsContent>
      <TabsContent value="mov">
        <AbaMovimentacoes>
          <Aviso>Nenhuma simulação gera lançamento fiscal nem documento.</Aviso>
        </AbaMovimentacoes>
      </TabsContent>
      <TabsContent value="regras">
        <AbaRegrasFiscal regras={REGRAS} passoAprovacao={PASSO_APROVACAO} />
      </TabsContent>
      <TabsContent value="excecoes">
        <AbaExcecoes
          itens={[
            { titulo: 'Base tributável difere de valor bruto', nota: notaBase },
            { titulo: 'Falta referência legal', nota: falta ?? TEXTO_FALTA_PADRAO },
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
