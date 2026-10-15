'use client';

import { BadgeProvisorio } from '@/components/ui/badge-provisorio';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  CRITERIOS_ACEITE,
  TEXTO_ACEITE,
  TEXTO_DUPLA,
  TEXTO_EXCECAO,
  TEXTO_EXCECAO_CORPO,
  TEXTO_REGRAS,
  type DetalheHomologacao,
  type EventoHistorico,
  type PreCondicao,
} from '@/lib/fiscal-homologacoes';

interface Props {
  detalhe: DetalheHomologacao;
  historico: EventoHistorico[];
  preCondicoes: PreCondicao[];
  podeGerenciar: boolean;
  onCenarios: () => void;
  onValidar: () => void;
  onHistorico: () => void;
}

export function AbasDetalhe({ detalhe, historico, preCondicoes, podeGerenciar, onCenarios, onValidar, onHistorico }: Props) {
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
      <TabsContent value="ficha" className="grid gap-2 text-sm">
        <p>Dados principais</p>
        <p>Código {detalhe.codigo}</p>
        <p>Versão {detalhe.numeroVersao}</p>
        <p>Enquadramento fiscal {detalhe.enquadramento}</p>
        <p className="inline-flex items-center gap-2">
          Início de vigência {detalhe.vigenciaInicio}
          <BadgeProvisorio codigo="H-E01-10" />
        </p>
        <p className="inline-flex items-center gap-2">
          Fim de vigência {detalhe.vigenciaFim ?? 'Sem fim de vigência'}
          <BadgeProvisorio codigo="H-E01-10" />
        </p>
        <p>Situação {detalhe.situacao}</p>
        <p>Usuário {detalhe.usuario}</p>
        <p>Descrição {detalhe.descricao}</p>
        <p>Segurança, auditoria e aprovação</p>
        <p>Empresa {detalhe.empresa}</p>
        <p>Responsável {detalhe.responsavel ?? detalhe.aprovador}</p>
        <p>Responsável pela aprovação {detalhe.aprovador}</p>
        <p>Criado em {detalhe.criadoEm}</p>
        <p>Alterado em {detalhe.atualizadoEm}</p>
        {detalhe.situacao === 'Em revisão' && (
          <p className="inline-flex items-center gap-2">
            {TEXTO_DUPLA}
            <BadgeProvisorio codigo="H-E01-11" />
          </p>
        )}
        <div>
          {podeGerenciar && (
            <Button type="button" variant="secondary" onClick={onCenarios}>cenários aprovados</Button>
          )}
          <ul>
            {detalhe.cenarios.map((cenario) => (
              <li key={`${cenario.codigo}-${cenario.numeroVersao}`}>{cenario.codigo} · versão {cenario.numeroVersao} · {cenario.competenciaRotulo}</li>
            ))}
          </ul>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={onValidar}>Validar pré-condições</Button>
          <Button type="button" variant="secondary" onClick={onHistorico}>Consultar histórico</Button>
        </div>
        {preCondicoes.length > 0 && (
          <ul>
            {preCondicoes.map((item) => (
              <li key={item.codigo}>{item.codigo}{item.atendida ? ' atendida' : ' pendente'}{item.texto ? `: ${item.texto}` : ''}</li>
            ))}
          </ul>
        )}
      </TabsContent>
      <TabsContent value="mov" className="grid gap-2 text-sm">
        <p>Preparação → Verificação → Autorização → Conclusão</p>
      </TabsContent>
      <TabsContent value="regras" className="grid gap-2 text-sm">
        <p>{TEXTO_REGRAS}</p>
        <p>01 Quem submeteu a versão permanece autor.</p>
        <p>02 Outro usuário registra a decisão.</p>
        <p className="inline-flex items-center gap-2">
          03 {TEXTO_DUPLA}
          <BadgeProvisorio codigo="H-E01-11" />
        </p>
      </TabsContent>
      <TabsContent value="excecoes" className="grid gap-2 text-sm">
        <p>{TEXTO_EXCECAO}</p>
        <p>{TEXTO_EXCECAO_CORPO}</p>
      </TabsContent>
      <TabsContent value="historico" className="grid gap-2 text-sm">
        <p>O sistema real preservará evento, ator, empresa, objeto e versão na auditoria. Identificadores técnicos, payloads sigilosos e GUIDs não serão apresentados nesta tela.</p>
        <ul>
          {historico.map((evento) => (
            <li key={`${evento.criadoEm}-${evento.resumo ?? evento.operacao}`}>{evento.resumo} {evento.usuarioNome ?? ''}</li>
          ))}
        </ul>
      </TabsContent>
      <TabsContent value="integracoes" className="grid gap-2 text-sm">
        <p>Integração fiscal</p>
        <p>Configuração e segredo</p>
        <p>Execução batch</p>
        <Button type="button" variant="secondary" disabled title="Destino ainda não disponível">Consultar integração</Button>
        <Button type="button" variant="secondary" disabled title="Destino ainda não disponível">Configurar segredo</Button>
        <Button type="button" variant="secondary" disabled title="Destino ainda não disponível">Executar batch</Button>
      </TabsContent>
      <TabsContent value="aceite" className="grid gap-2 text-sm">
        <ul>
          {CRITERIOS_ACEITE.map((criterio, indice) => (
            <li key={criterio}>
              <input type="checkbox" id={`criterio-aceite-${indice}`} aria-label={`Critério de aceite ${indice + 1}`} />
              <label htmlFor={`criterio-aceite-${indice}`}>{criterio}</label>
            </li>
          ))}
        </ul>
        <p>{TEXTO_ACEITE}</p>
      </TabsContent>
    </Tabs>
  );
}
