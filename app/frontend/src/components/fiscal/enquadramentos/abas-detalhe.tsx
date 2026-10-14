'use client';

import { BadgeProvisorio } from '@/components/ui/badge-provisorio';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ROTULOS_SITUACAO_ENQUADRAMENTO,
  rotuloData,
  type DetalheEnquadramento,
  type EventoHistoricoEnquadramento,
  type PreCondicao,
} from '@/lib/fiscal-enquadramentos';

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
      <TabsContent value="ficha" className="grid gap-3 text-sm">
        <p>Código {detalhe.codigo}</p>
        <p>Situação {situacao}</p>
        <p>Responsável {detalhe.responsavel}</p>
        <p>Criado em {detalhe.criadoEm}</p>
        <p>Alterado em {detalhe.atualizadoEm}</p>
        {detalhe.origemCodigo && <p>Duplicado do código {detalhe.origemCodigo}</p>}
        <p>Estabelecimento {detalhe.estabelecimentoNome}</p>
        <p>Operação {detalhe.operacaoRotulo}</p>
        <p>Tipo da nota {detalhe.tipoNota}</p>
        <p>Finalidade {detalhe.finalidade}</p>
        <p className="inline-flex items-center gap-2">Operação fiscal (CFOP) {detalhe.cfopCodigo} <BadgeProvisorio codigo="H-E01-08" /></p>
        <p>Abrangência da operação {detalhe.abrangenciaRotulo}</p>
        <p>Origem do produto {detalhe.tipoProdutoRotulo}</p>
        <p>Produto {detalhe.produtoNome}</p>
        <p className="inline-flex items-center gap-2">Classificação fiscal (NCM) {detalhe.ncmCodigo} <BadgeProvisorio codigo="H-E01-08" /></p>
        <p className="inline-flex items-center gap-2">Substituição tributária (CEST) {detalhe.cest} <BadgeProvisorio codigo="H-E01-09" /></p>
        <p>Cliente {detalhe.clienteNome}</p>
        <p className="inline-flex items-center gap-2">
          Início de vigência {rotuloData(detalhe.vigenciaInicio)}
          {detalhe.vigenciaFim ? ` · Fim de vigência ${rotuloData(detalhe.vigenciaFim)}` : ''}
          <BadgeProvisorio codigo="H-E01-10" />
        </p>
        <p className="inline-flex items-center gap-2">Prioridade {detalhe.prioridade} <BadgeProvisorio codigo="H-E01-06" /></p>
        <div>
          <p className="font-semibold">Trilha e responsabilização</p>
          <p>Empresa <span>{detalhe.empresaNome}</span></p>
          <p>Situação {situacao}</p>
          <p className="inline-flex items-center gap-2">Responsável {detalhe.responsavel} <BadgeProvisorio codigo="H-E01-11" /></p>
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
