'use client';

import { BadgeProvisorio } from '@/components/ui/badge-provisorio';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Campo, SecaoRotulo } from '../empresas/aba-ficha';
import { AbaAceite, AbaExcecoes, AbaIntegracoes, Aviso, Regra } from '../empresas/abas-informativas';
import {
  ROTULOS_PRE_CONDICAO,
  ROTULOS_SITUACAO_ENQUADRAMENTO,
  mascararCest,
  mascararCfop,
  mascararNcm,
  rotuloData,
  rotuloDataHora,
  type DetalheEnquadramento,
  type EventoHistoricoEnquadramento,
  type PreCondicao,
} from '@/lib/fiscal-enquadramentos';

export type IdAba = 'ficha' | 'mov' | 'regras' | 'excecoes' | 'historico' | 'integracoes' | 'aceite';

const ETAPAS = ['Preparação', 'Verificação', 'Autorização', 'Conclusão'] as const;
/** No protótipo as duas primeiras etapas aparecem como vencidas; esta tela não transmite nada. */
const ETAPAS_VENCIDAS = 2;

const EXCECOES = [{ titulo: 'Empate de enquadramento' }, { titulo: 'Operação sem regra aprovada' }];

const CAMINHO_APROVACAO: Array<[string, string]> = [
  ['01 · Autor', 'Registra documento, versão e justificativa.'],
  ['02 · Revisor', 'Confere campos, normas, contratos e limites.'],
  ['03 · Aprovação', 'Responsável segregado libera o serviço, quando habilitado.'],
];

const REFERENCIA: Array<[string, string]> = [
  ['Campos', 'operação, tipo da nota, finalidade, operação fiscal (CFOP), abrangência da operação, origem do produto, classificação fiscal (NCM), substituição tributária (CEST), cliente'],
  ['Ações', 'cadastrar operação, duplicar perfil, relacionar produto e cliente, controlar prioridade'],
  ['Regras', 'perfil nunca usa CFOP global como único determinante; critério temporal obrigatório'],
  ['Exceções', 'empate de enquadramento e operação sem regra aprovada'],
];

function Provisorio({ codigo, children }: { codigo: string; children: React.ReactNode }) {
  return <span className="flex flex-wrap items-center gap-2">{children} <BadgeProvisorio codigo={codigo} /></span>;
}

function estadoPreCondicao(item: PreCondicao): string {
  if (item.provisoria) return 'provisória';
  return item.atendida ? 'atendida' : 'pendente';
}

interface Props {
  detalhe: DetalheEnquadramento;
  podeGerenciar: boolean;
  aba: IdAba;
  onAba: (aba: IdAba) => void;
  alerta: string | null;
  historico: EventoHistoricoEnquadramento[];
  preCondicoes: PreCondicao[];
  onValidarPreCondicoes: () => void;
  onConsultar: () => void;
  onEditar: () => void;
  onDuplicar: () => void;
  onInativar: () => void;
  onReativar: () => void;
  onRemover: () => void;
}

export function AbasDetalhe({
  detalhe, podeGerenciar, aba, onAba, alerta, historico, preCondicoes,
  onValidarPreCondicoes, onConsultar, onEditar, onDuplicar, onInativar, onReativar, onRemover,
}: Props) {
  const situacao = ROTULOS_SITUACAO_ENQUADRAMENTO[detalhe.situacao as 'ATIVA' | 'INATIVA'] ?? detalhe.situacaoRotulo;
  const eventos = [...historico].sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));

  function consultarHistorico() {
    onAba('historico');
    document.querySelector<HTMLElement>('[data-aba="historico"]')?.focus();
  }

  return (
    <Tabs value={aba} onValueChange={(valor) => onAba(valor as IdAba)}>
      <TabsList>
        <TabsTrigger value="ficha">Ficha e campos</TabsTrigger>
        <TabsTrigger value="mov">Movimentações</TabsTrigger>
        <TabsTrigger value="regras">Regras e validações</TabsTrigger>
        <TabsTrigger value="excecoes">Exceções</TabsTrigger>
        <TabsTrigger value="historico" data-aba="historico">Histórico</TabsTrigger>
        <TabsTrigger value="integracoes">Integrações</TabsTrigger>
        <TabsTrigger value="aceite">Aceite e testes</TabsTrigger>
      </TabsList>
      <TabsContent value="ficha" className="grid gap-4 text-sm">
        <div>
          <SecaoRotulo>Informações do registro selecionado</SecaoRotulo>
          <p className="mb-2 text-[11px] font-semibold text-muted-foreground">Dados principais</p>
          <div className="grid grid-cols-1 gap-x-3.5 gap-y-2.5 sm:grid-cols-2">
            <Campo label="Código"><span className="font-data">{detalhe.codigo}</span></Campo>
            <Campo label="Estabelecimento">{detalhe.estabelecimentoNome}</Campo>
            <Campo label="Operação">{detalhe.operacaoRotulo}</Campo>
            <Campo label="Tipo da nota">{detalhe.tipoNota}</Campo>
            <Campo label="Finalidade">{detalhe.finalidade}</Campo>
            <Campo label="Operação fiscal (CFOP)"><Provisorio codigo="H-E01-08"><span className="font-data">{mascararCfop(detalhe.cfopCodigo)}</span></Provisorio></Campo>
            <Campo label="Abrangência da operação">{detalhe.abrangenciaRotulo}</Campo>
            <Campo label="Origem do produto">{detalhe.tipoProdutoRotulo}</Campo>
            <Campo label="Produto">{detalhe.produtoNome}</Campo>
            <Campo label="Classificação fiscal (NCM)"><Provisorio codigo="H-E01-08"><span className="font-data">{mascararNcm(detalhe.ncmCodigo)}</span></Provisorio></Campo>
            <Campo label="Substituição tributária (CEST)"><Provisorio codigo="H-E01-09"><span className="font-data">{mascararCest(detalhe.cest)}</span></Provisorio></Campo>
            <Campo label="Cliente">{detalhe.clienteNome}</Campo>
            <Campo label="Início de vigência"><Provisorio codigo="H-E01-10">{rotuloData(detalhe.vigenciaInicio)}</Provisorio></Campo>
            <Campo label="Fim de vigência"><Provisorio codigo="H-E01-10">{detalhe.vigenciaFim ? rotuloData(detalhe.vigenciaFim) : 'Sem fim'}</Provisorio></Campo>
            <Campo label="Prioridade"><Provisorio codigo="H-E01-06">{detalhe.prioridade}</Provisorio></Campo>
          </div>
        </div>
        <div>
          <SecaoRotulo>Trilha e responsabilização</SecaoRotulo>
          <div className="grid grid-cols-1 gap-x-3.5 gap-y-2.5 sm:grid-cols-3">
            <Campo label="Empresa">{detalhe.empresaNome}</Campo>
            <Campo label="Situação">{situacao}</Campo>
            <Campo label="Responsável"><Provisorio codigo="H-E01-11">{detalhe.responsavel}</Provisorio></Campo>
            <Campo label="Criado em">{rotuloDataHora(detalhe.criadoEm)}</Campo>
            <Campo label="Alterado em">{rotuloDataHora(detalhe.atualizadoEm)}</Campo>
            {detalhe.origemCodigo && <Campo label="Duplicado do código">{detalhe.origemCodigo}</Campo>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {podeGerenciar && <Button type="button" onClick={onEditar}>Editar versão</Button>}
          <Button type="button" variant="secondary" onClick={onValidarPreCondicoes}>Validar pré-condições</Button>
          <Button type="button" variant="secondary" onClick={consultarHistorico}>Consultar histórico</Button>
        </div>
        {preCondicoes.length > 0 && (
          <ul aria-label="Pré-condições" className="grid gap-1.5 text-xs">
            {preCondicoes.map((item) => {
              const info = ROTULOS_PRE_CONDICAO[item.codigo];
              return (
                <li key={item.codigo} className="flex flex-wrap items-center gap-2">
                  <span>{info?.rotulo ?? 'Pré-condição'}: {estadoPreCondicao(item)}</span>
                  {item.provisoria && info?.pendencia && <BadgeProvisorio codigo={info.pendencia} />}
                </li>
              );
            })}
          </ul>
        )}
      </TabsContent>
      <TabsContent value="mov" className="grid gap-4 text-sm">
        <div>
          <SecaoRotulo>Etapas e evidências de negócio</SecaoRotulo>
          <ol className="grid grid-cols-4 gap-2" aria-label="Etapas do enquadramento">
            {ETAPAS.map((etapa, i) => (
              <li
                key={etapa}
                className={`border-t-[3px] px-1 py-2 text-[11px] ${i < ETAPAS_VENCIDAS ? 'border-primary text-foreground' : 'border-border text-muted-foreground'}`}
              >
                {etapa}
              </li>
            ))}
          </ol>
        </div>
        {podeGerenciar && (
          <div>
            <SecaoRotulo>Ações do enquadramento</SecaoRotulo>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={onDuplicar}>Duplicar</Button>
              {detalhe.situacao === 'ATIVA'
                ? <Button type="button" variant="secondary" onClick={onInativar}>Inativar</Button>
                : <Button type="button" variant="secondary" onClick={onReativar}>Reativar</Button>}
              <Button type="button" variant="destructiveOutline" onClick={onRemover}>Remover</Button>
            </div>
          </div>
        )}
      </TabsContent>
      <TabsContent value="regras" className="text-sm">
        <SecaoRotulo>Regras de negócio documentadas</SecaoRotulo>
        <Regra>perfil nunca usa CFOP global como único determinante; critério temporal obrigatório</Regra>
        <Regra>A prioridade é registrada e não escolhe enquadramento</Regra>
        <Regra>Esta tela não calcula tributo</Regra>
        <div className="flex items-center gap-2">
          <SecaoRotulo>Caminho de aprovação</SecaoRotulo>
          <BadgeProvisorio codigo="H-E01-11" />
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {CAMINHO_APROVACAO.map(([titulo, texto]) => (
            <div key={titulo} className="rounded-md border border-border bg-surface-2 p-3 text-[11px]">
              <b className="mb-1.5 block">{titulo}</b>
              {texto}
            </div>
          ))}
        </div>
        <Aviso>A permissão é conferida no servidor. A visibilidade do menu não substitui o controle de acesso ou de alçada.</Aviso>
      </TabsContent>
      <TabsContent value="excecoes">
        <AbaExcecoes itens={EXCECOES}>
          {alerta && <p role="alert" className="my-2 rounded-md bg-warning-soft p-2.5 text-xs text-warning-fg">{alerta}</p>}
          <Button type="button" onClick={onConsultar}>Validar</Button>
        </AbaExcecoes>
      </TabsContent>
      <TabsContent value="historico" className="text-sm">
        <SecaoRotulo>Histórico e justificativas</SecaoRotulo>
        {eventos.length === 0 && <p className="text-xs text-muted-foreground">Nenhum evento de histórico.</p>}
        <ol className="grid gap-2.5">
          {eventos.map((evento, indice) => (
            <li key={`${evento.criadoEm}-${indice}`} className="border-l-2 border-border-strong py-1 pl-3.5 text-[11px]">
              <strong className="block text-xs">{evento.resumo}</strong>
              <small className="text-[10px] text-muted-foreground">
                {rotuloDataHora(evento.criadoEm)} • {evento.usuarioNome || 'Sistema'}
              </small>
              {evento.justificativa && <span className="block">Justificativa: {evento.justificativa}</span>}
              {evento.versao != null && <span className="block text-muted-foreground">Versão {evento.versao}</span>}
            </li>
          ))}
        </ol>
        <Aviso>
          A auditoria preserva evento, responsável, objeto e justificativa. Identificadores técnicos nunca são apresentados nesta tela.
        </Aviso>
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
