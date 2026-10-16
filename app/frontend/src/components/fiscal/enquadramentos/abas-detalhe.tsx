'use client';

import { BadgeProvisorio } from '@/components/ui/badge-provisorio';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Campo, SecaoRotulo } from '../empresas/aba-ficha';
import {
  ROTULOS_SITUACAO_ENQUADRAMENTO,
  rotuloData,
  rotuloDataHora,
  type DetalheEnquadramento,
  type EventoHistoricoEnquadramento,
  type PreCondicao,
} from '@/lib/fiscal-enquadramentos';

function Provisorio({ codigo, children }: { codigo: string; children: React.ReactNode }) {
  return <span className="flex flex-wrap items-center gap-2">{children} <BadgeProvisorio codigo={codigo} /></span>;
}

interface Props {
  detalhe: DetalheEnquadramento;
  podeGerenciar: boolean;
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
  detalhe, podeGerenciar, alerta, historico, preCondicoes,
  onValidarPreCondicoes, onConsultar, onEditar, onDuplicar, onInativar, onReativar, onRemover,
}: Props) {
  const situacao = ROTULOS_SITUACAO_ENQUADRAMENTO[detalhe.situacao as 'ATIVA' | 'INATIVA'] ?? detalhe.situacaoRotulo;
  return (
    <Tabs defaultValue="ficha">
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
            <Campo label="Estabelecimento">{detalhe.estabelecimentoNome}</Campo>
            <Campo label="Operação">{detalhe.operacaoRotulo}</Campo>
            <Campo label="Tipo da nota">{detalhe.tipoNota}</Campo>
            <Campo label="Finalidade">{detalhe.finalidade}</Campo>
            <Campo label="Operação fiscal (CFOP)"><Provisorio codigo="H-E01-08">{detalhe.cfopCodigo}</Provisorio></Campo>
            <Campo label="Abrangência da operação">{detalhe.abrangenciaRotulo}</Campo>
            <Campo label="Origem do produto">{detalhe.tipoProdutoRotulo}</Campo>
            <Campo label="Produto">{detalhe.produtoNome}</Campo>
            <Campo label="Classificação fiscal (NCM)"><Provisorio codigo="H-E01-08">{detalhe.ncmCodigo}</Provisorio></Campo>
            <Campo label="Substituição tributária (CEST)"><Provisorio codigo="H-E01-09">{detalhe.cest}</Provisorio></Campo>
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
          <Button type="button" variant="secondary" onClick={() => document.getElementById('aba-historico-enq')?.scrollIntoView()}>Consultar histórico</Button>
        </div>
        {preCondicoes.length > 0 && (
          <ul>
            {preCondicoes.map((item) => (
              <li key={item.codigo}>{item.codigo}: {item.provisoria ? 'provisória' : item.atendida ? 'atendida' : 'pendente'}</li>
            ))}
          </ul>
        )}
      </TabsContent>
      <TabsContent value="mov" className="grid gap-2 text-sm">
        <p>Preparação → Verificação → Autorização → Conclusão</p>
        {podeGerenciar && (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={onDuplicar}>Duplicar</Button>
            {detalhe.situacao === 'ATIVA'
              ? <Button type="button" variant="secondary" onClick={onInativar}>Inativar</Button>
              : <Button type="button" variant="secondary" onClick={onReativar}>Reativar</Button>}
            <Button type="button" variant="secondary" onClick={onRemover}>Remover</Button>
          </div>
        )}
      </TabsContent>
      <TabsContent value="regras" className="grid gap-2 text-sm">
        <p>perfil nunca usa CFOP global como único determinante; critério temporal obrigatório</p>
        <p>A prioridade é registrada e não escolhe enquadramento</p>
        <p>Esta tela não calcula tributo</p>
        <p className="inline-flex items-center gap-2">01 · Autor registra documento, versão e justificativa. <BadgeProvisorio codigo="H-E01-11" /></p>
        <p>02 · Revisor confere campos, normas, contratos e limites.</p>
        <p>03 · Aprovação — responsável segregado libera o serviço, quando habilitado.</p>
      </TabsContent>
      <TabsContent value="excecoes" className="grid gap-2 text-sm">
        <p>Empate de enquadramento</p>
        <p>Operação sem regra aprovada</p>
        {alerta && <p role="alert">{alerta}</p>}
        <Button type="button" onClick={onConsultar}>Validar</Button>
      </TabsContent>
      <TabsContent value="historico" className="grid gap-2 text-sm">
        {historico.length === 0 && <p>Nenhum evento de histórico.</p>}
        {historico.map((evento, indice) => (
          <p key={`${evento.criadoEm}-${indice}`}>{evento.resumo} · {evento.usuarioNome} · {evento.justificativa} · versão {evento.versao ?? ''}</p>
        ))}
      </TabsContent>
      <TabsContent value="integracoes" className="grid gap-2 text-sm">
        <p>E01 — regras e simulação ficam nas telas seguintes.</p>
        <Button type="button" disabled title="Destino ainda não disponível">Abrir simulador</Button>
      </TabsContent>
      <TabsContent value="aceite" className="text-sm">
        <p>Checkbox não é aceite. Os critérios abaixo são somente leitura.</p>
      </TabsContent>
    </Tabs>
  );
}
