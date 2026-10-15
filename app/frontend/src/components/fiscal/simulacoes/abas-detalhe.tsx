'use client';

import { BadgeProvisorio } from '@/components/ui/badge-provisorio';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatarDinheiroPtBr, TEXTO_FALTA_PADRAO, type DetalheSimulacao, type EventoHistorico, type Explicacao, type PreCondicao } from '@/lib/fiscal-simulacoes';
import { ExplicacaoPainel } from './explicacao-painel';

interface Props {
  detalhe: DetalheSimulacao;
  historico: EventoHistorico[];
  preCondicoes: PreCondicao[];
  explicacao: Explicacao | null;
  falta: string | null;
  onValidar: () => void;
  onExplicar: () => void;
}

export function AbasDetalhe({ detalhe, historico, preCondicoes, explicacao, falta, onValidar, onExplicar }: Props) {
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
        <p>Código {detalhe.codigo}</p>
        <p>Versão {detalhe.numeroVersao}</p>
        <p>Situação {detalhe.situacao}</p>
        <p>Cliente {detalhe.cliente}</p>
        <p>Produto {detalhe.produto}</p>
        <p>Valor líquido (calculado) {formatarDinheiroPtBr(detalhe.valorLiquido)}</p>
        <p>Base tributável (calculada) {formatarDinheiroPtBr(detalhe.baseTributavel)}</p>
        <p>ICMS {formatarDinheiroPtBr(detalhe.icms)}</p>
        <p className="inline-flex items-center gap-2">
          Competência {detalhe.competenciaRotulo}
          <BadgeProvisorio codigo="H-E01-10" />
        </p>
        <p>{detalhe.empresa}</p>
        <p>Responsável {detalhe.responsavel}</p>
        <p>Criado em {detalhe.criadoEm}</p>
        <p>Alterado em {detalhe.atualizadoEm}</p>
        <p className="inline-flex items-center gap-2">
          Esta tela não aprova nem publica regra. O quórum numérico permanece provisório.
          <BadgeProvisorio codigo="H-E01-11" />
        </p>
        {detalhe.baseDifereBruto && <p role="status">Base tributável difere de valor bruto</p>}
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={onExplicar}>Explicar tributos</Button>
          <Button type="button" variant="secondary" onClick={() => { window.location.href = `/api/erp/fiscal/simulacoes/${detalhe.id}/memoria`; }}>Exportar memória</Button>
          <Button type="button" variant="secondary" onClick={onValidar}>Validar pré-condições</Button>
        </div>
        {explicacao && <ExplicacaoPainel explicacao={explicacao} />}
        {preCondicoes.length > 0 && (
          <ul>
            {preCondicoes.map((item) => (
              <li key={item.codigo}>{item.codigo}{item.texto ? `: ${item.texto}` : ''}</li>
            ))}
          </ul>
        )}
      </TabsContent>
      <TabsContent value="mov" className="grid gap-2 text-sm">
        <p>Preparação → Verificação → Autorização → Conclusão</p>
        <p>Nenhuma simulação gera lançamento fiscal nem documento.</p>
      </TabsContent>
      <TabsContent value="regras" className="grid gap-2 text-sm">
        <p>nenhum valor gerado vira lançamento fiscal sem documento; Decimal exato</p>
        <p>Quantidade e peso informado na nota ficam registrados e não multiplicam o valor.</p>
        <p>A base e o ICMS saem de conta inteira em centavos, com meio para cima, sem número de ponto flutuante.</p>
        <p className="inline-flex items-center gap-2">
          Esta tela não aprova nem publica regra. O quórum numérico permanece provisório.
          <BadgeProvisorio codigo="H-E01-11" />
        </p>
      </TabsContent>
      <TabsContent value="excecoes" className="grid gap-2 text-sm">
        <p>Base tributável difere de valor bruto</p>
        <p>{detalhe.baseDifereBruto ? (explicacao?.textoBase ?? 'Base tributável difere de valor bruto') : 'Nesta simulação a base tributável é igual ao valor bruto.'}</p>
        <p>Falta referência legal</p>
        <p>{falta ?? TEXTO_FALTA_PADRAO}</p>
      </TabsContent>
      <TabsContent value="historico" className="grid gap-2 text-sm">
        <p>O sistema real preservará evento, ator, empresa, objeto e versão na auditoria. Identificadores técnicos, payloads sigilosos e GUIDs não serão apresentados nesta tela.</p>
        <ul>
          {historico.map((evento) => (
            <li key={`${evento.criadoEm}-${evento.resumo ?? evento.operacao}`}>{evento.resumo}</li>
          ))}
        </ul>
      </TabsContent>
      <TabsContent value="integracoes" className="grid gap-2 text-sm">
        <p>Integração fiscal</p>
        <p>Configuração e segredo</p>
        <p>Execução batch</p>
        <Button type="button" disabled title="Destino ainda não disponível">Consultar integração</Button>
        <Button type="button" disabled title="Destino ainda não disponível">Configurar segredo</Button>
        <Button type="button" disabled title="Destino ainda não disponível">Executar batch</Button>
      </TabsContent>
      <TabsContent value="aceite" className="grid gap-2 text-sm">
        <p>A seleção dos checkboxes serve apenas à revisão do protótipo: não registra aceite contratual. O aceite real depende de evidências CI, integração HML, UAT e responsável autorizado.</p>
      </TabsContent>
    </Tabs>
  );
}
