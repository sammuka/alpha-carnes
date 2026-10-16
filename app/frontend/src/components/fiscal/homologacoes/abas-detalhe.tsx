'use client';

import { BadgeProvisorio } from '@/components/ui/badge-provisorio';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { rotuloData, rotuloDataHora } from '@/lib/fiscal-enquadramentos';
import {
  TEXTO_DUPLA,
  TEXTO_EXCECAO,
  TEXTO_EXCECAO_CORPO,
  TEXTO_PENDENTE,
  rotuloAprovador,
  TEXTO_REGRAS,
  type DetalheHomologacao,
  type EventoHistorico,
  type PreCondicao,
} from '@/lib/fiscal-homologacoes';
import { AbaHistoricoFiscal, AbaMovimentacoes, AbaRegrasFiscal, ListaPreCondicoes } from '../comum/abas-fiscais';
import { Campo, SecaoRotulo } from '../empresas/aba-ficha';
import { AbaAceite, AbaExcecoes, AbaIntegracoes } from '../empresas/abas-informativas';

export type IdAba = 'ficha' | 'mov' | 'regras' | 'excecoes' | 'historico' | 'integracoes' | 'aceite';

const REFERENCIA: Array<[string, string]> = [
  ['Campos', 'enquadramento fiscal, usuário, descrição, justificativa auditável, cenários aprovados, vigência'],
  ['Ações', 'revisar diff, aprovar/rejeitar, publicar e auditar'],
  ['Regras', TEXTO_REGRAS],
  ['Exceções', 'atualização normativa em meio à operação'],
];

/** Situações em que cada ação do processo é aceita pelo servidor (D8). */
export function podeDecidir(situacao: string): boolean { return situacao === 'Em revisão'; }
export function podePublicar(situacao: string): boolean { return situacao === 'Aprovada'; }
export function podeVincular(situacao: string): boolean { return situacao === 'Em revisão' || situacao === 'Aprovada'; }

interface Props {
  detalhe: DetalheHomologacao | null;
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
  onCenarios: () => void;
  onRevisarDiff: () => void;
  onDecidir: () => void;
  onPublicar: () => void;
  onValidarPreCondicoes: () => void;
  onConsultarHistorico: () => void;
}

export function AbasDetalhe({
  detalhe, carregandoFicha, podeGerenciar, podeAprovar, aba, onAba, historico, carregandoHistorico, erroHistorico,
  preCondicoes, carregandoPreCondicoes, erroPreCondicoes,
  onCenarios, onRevisarDiff, onDecidir, onPublicar, onValidarPreCondicoes, onConsultarHistorico,
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
            <Campo label="Enquadramento fiscal">{detalhe.enquadramento}</Campo>
            <Campo label="Início de vigência">
              <span className="flex flex-wrap items-center gap-2">{rotuloData(detalhe.vigenciaInicio)} <BadgeProvisorio codigo="H-E01-10" /></span>
            </Campo>
            <Campo label="Fim de vigência">
              <span className="flex flex-wrap items-center gap-2">{detalhe.vigenciaFim ? rotuloData(detalhe.vigenciaFim) : 'Sem fim'} <BadgeProvisorio codigo="H-E01-10" /></span>
            </Campo>
            <Campo label="Situação">
              <span className="flex flex-wrap items-center gap-2">{situacao} {situacao === 'Em revisão' && <BadgeProvisorio codigo="H-E01-11" />}</span>
            </Campo>
            <Campo label="Usuário">{detalhe.usuario || '—'}</Campo>
            <Campo label="Descrição">{detalhe.descricao}</Campo>
          </div>
        </div>
        <div>
          <SecaoRotulo>Trilha e responsabilização</SecaoRotulo>
          <div className="grid grid-cols-1 gap-x-3.5 gap-y-2.5 sm:grid-cols-3">
            <Campo label="Empresa">{detalhe.empresa}</Campo>
            <Campo label="Responsável">{detalhe.responsavel || TEXTO_PENDENTE}</Campo>
            <Campo label="Responsável pela aprovação">{rotuloAprovador(detalhe)}</Campo>
            <Campo label="Criado em">{rotuloDataHora(detalhe.criadoEm)}</Campo>
            <Campo label="Alterado em">{rotuloDataHora(detalhe.atualizadoEm)}</Campo>
          </div>
        </div>
        <div>
          <SecaoRotulo>cenários aprovados</SecaoRotulo>
          {detalhe.cenarios.length === 0 && <p className="mb-2 text-xs text-muted-foreground">Nenhum cenário vinculado.</p>}
          <ul aria-label="Cenários vinculados" className="mb-2 grid gap-1 text-xs">
            {detalhe.cenarios.map((cenario) => (
              <li key={`${cenario.codigo}-${cenario.numeroVersao}`}>{cenario.codigo} · versão {cenario.numeroVersao} · {cenario.competenciaRotulo}</li>
            ))}
          </ul>
          {podeGerenciar && (
            <Button type="button" variant="secondary" disabled={!podeVincular(situacao)} onClick={onCenarios}>cenários aprovados</Button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={onValidarPreCondicoes}>Validar pré-condições</Button>
          <Button type="button" variant="secondary" onClick={onConsultarHistorico}>Consultar histórico</Button>
        </div>
        <ListaPreCondicoes itens={preCondicoes} carregando={carregandoPreCondicoes} erro={erroPreCondicoes} />
      </TabsContent>
      <TabsContent value="mov">
        <AbaMovimentacoes>
          <div>
            <SecaoRotulo>Ações da homologação</SecaoRotulo>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={onRevisarDiff}>Revisar diff</Button>
              {podeAprovar && <Button type="button" variant="secondary" disabled={!podeDecidir(situacao)} onClick={onDecidir}>Aprovar/rejeitar</Button>}
              {podeAprovar && <Button type="button" variant="secondary" disabled={!podePublicar(situacao)} onClick={onPublicar}>Publicar e auditar</Button>}
            </div>
          </div>
        </AbaMovimentacoes>
      </TabsContent>
      <TabsContent value="regras">
        <AbaRegrasFiscal regras={[TEXTO_REGRAS]} passoAprovacao={TEXTO_DUPLA} />
      </TabsContent>
      <TabsContent value="excecoes">
        <AbaExcecoes itens={[{ titulo: TEXTO_EXCECAO, nota: TEXTO_EXCECAO_CORPO }]} />
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
