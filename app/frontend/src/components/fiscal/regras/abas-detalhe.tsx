'use client';

import { BadgeProvisorio } from '@/components/ui/badge-provisorio';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatarPercentualPtBr, type DetalheRegra, type EventoHistorico, type PreCondicao } from '@/lib/fiscal-regras';

interface Props {
  detalhe: DetalheRegra;
  historico: EventoHistorico[];
  preCondicoes: PreCondicao[];
  onValidar: () => void;
}

const CRITERIOS = [
  'Campos obrigatórios da ficha preenchidos',
  'Vigência informada',
  'Enquadramento ativo',
  'Benefício fiscal ativo',
  'Classificação IBS/CBS ativa',
  'Aprovação por usuário diferente de quem submeteu',
  'Versão aprovada ou aposentada não é reescrita',
  'Comparação entre versões do mesmo código',
];

export function AbasDetalhe({ detalhe, historico, preCondicoes, onValidar }: Props) {
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
        <section>
          <p className="font-semibold">Dados principais</p>
          <p>Código {detalhe.codigo}</p>
          <p>Versão {detalhe.numeroVersao}</p>
          <p>Situação {detalhe.situacao}</p>
          <p>Tratamento ICMS {detalhe.tratamentoIcms}</p>
          <p>Redução de base do ICMS (%) {formatarPercentualPtBr(detalhe.pRedBc)}</p>
          <p>Alíquota (%) {formatarPercentualPtBr(detalhe.pIcms)}</p>
          <p className="inline-flex items-center gap-2">
            Início de vigência {detalhe.vigenciaInicio}
            {detalhe.vigenciaFim ? ` · Fim de vigência ${detalhe.vigenciaFim}` : ' · Fim de vigência'}
            <BadgeProvisorio codigo="H-E01-10" />
          </p>
        </section>
        <section>
          <p className="font-semibold">Segurança, auditoria e aprovação</p>
          <p>Empresa</p>
          <p>{detalhe.empresaNome}</p>
          <p>Situação {detalhe.situacao}</p>
          <p>Responsável {detalhe.responsavel}</p>
          <p>Criado em {detalhe.criadoEm}</p>
          <p>Alterado em {detalhe.atualizadoEm}</p>
          <p className="inline-flex items-center gap-2">
            Um aprovador diferente de quem submeteu registra a aprovação.
            <BadgeProvisorio codigo="H-E01-11" />
          </p>
        </section>
        <Button type="button" variant="secondary" onClick={onValidar}>Validar pré-condições</Button>
        <Button type="button" variant="secondary" onClick={() => document.getElementById('historico-regras')?.scrollIntoView()}>Consultar histórico</Button>
        {preCondicoes.length > 0 && (
          <ul>
            {preCondicoes.map((item) => (
              <li key={item.codigo}>{item.codigo}: {item.provisoria ? 'provisória' : item.atendida ? 'atendida' : 'pendente'}{item.texto ? ` ${item.texto}` : ''}</li>
            ))}
          </ul>
        )}
      </TabsContent>
      <TabsContent value="mov" className="grid gap-2 text-sm">
        <p>Preparação → Verificação → Autorização → Conclusão</p>
      </TabsContent>
      <TabsContent value="regras" className="grid gap-2 text-sm">
        <p>motor de regras não permite edição retroativa em nota emitida; aprovação segregada</p>
        <p>Versão aprovada ou aposentada não é alterada; a alteração é uma versão nova.</p>
        <p>01 · Autor registra documento, versão e justificativa.</p>
        <p>02 · Revisor confere campos, normas, contratos e limites.</p>
        <p className="inline-flex items-center gap-2">
          03 · Um aprovador diferente de quem submeteu libera a versão. O quórum numérico permanece provisório.
          <BadgeProvisorio codigo="H-E01-11" />
        </p>
      </TabsContent>
      <TabsContent value="excecoes" className="grid gap-2 text-sm">
        <p>Benefício não elegível</p>
        <p>Vigência ambígua</p>
        <p>Versão NT inválida</p>
        <p>Esta tela não tem campo de versão de NT e o protótipo não traz código de erro. Nenhuma gravação é recusada por esse motivo.</p>
      </TabsContent>
      <TabsContent value="historico" className="grid gap-2 text-sm" id="historico-regras">
        {historico.length === 0 && <p>Nenhum evento de histórico.</p>}
        {historico.map((evento, indice) => (
          <p key={`${evento.criadoEm}-${indice}`}>{evento.resumo} · {evento.usuarioNome} · {evento.justificativa}</p>
        ))}
      </TabsContent>
      <TabsContent value="integracoes" className="grid gap-2 text-sm">
        <Button type="button" disabled title="Destino ainda não disponível">Abrir simulador</Button>
        <Button type="button" disabled title="Destino ainda não disponível">Abrir publicação</Button>
      </TabsContent>
      <TabsContent value="aceite" className="grid gap-1 text-sm">
        <p>Checkbox não é aceite. Os critérios abaixo são somente leitura.</p>
        {CRITERIOS.map((criterio) => <p key={criterio}>{criterio}</p>)}
      </TabsContent>
    </Tabs>
  );
}
