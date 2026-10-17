'use client';

import type { ReactNode } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AbaHistoricoFiscal, AbaMovimentacoes } from '@/components/fiscal/comum/abas-fiscais';
import { SecaoRotulo } from '@/components/fiscal/empresas/aba-ficha';
import { Aviso, Regra } from '@/components/fiscal/empresas/abas-informativas';
import { SeloSituacao } from './grade-contabil';

export const ABAS = ['Ficha e campos', 'Movimentações', 'Regras e validações', 'Exceções', 'Histórico', 'Integrações', 'Aceite e testes'] as const;
export type Aba = (typeof ABAS)[number];

/** Critérios de aceite de `aplicacao.js` L223–L232, somente leitura. */
const ACEITE = [
  'Todos os campos de negócio e seus formatos são exibidos e validados',
  'Ações de cadastro, edição, confirmação, cancelamento e versões possuem estados visíveis',
  'Regras de negócio do backend e pré-condições são verificadas',
  'Fluxos negativos exibem erros e não produzem gravações parciais',
  'Permissões e segregação das aprovações são auditáveis',
  'Concorrência, duplicação e reprocessamento seguros são testados',
  'Interface respeita DS v3, teclado, estados vazios e tratamento de loading/erro',
  'Integrações e batch possuem evidência de contrato, sandbox e rastreabilidade',
];

/**
 * Parágrafo do modal "Ação do domínio" (`aplicacao.js` L401). Sai só a cláusula da casca de protótipo
 * ("e não é efetuada no protótipo"), Princípio I.2(a).
 */
export function detalheAcao(acao: string, regras: string, riscos: string): string {
  return `Ação prevista na especificação: ${acao}. Pré-condições: ${regras}. Riscos: ${riscos}. Qualquer transação bancária, fiscal, assinatura ou baixa requer confirmação externa.`;
}

export interface EventoContabil { quando: string; quem: string; acontecimento: string; justificativa: string }

interface Props {
  aba: Aba;
  onAba: (aba: Aba) => void;
  /** Conteúdo da aba Ficha e campos (campos da tela). */
  ficha: ReactNode;
  eventos: EventoContabil[];
  carregandoEventos: boolean;
  erroEventos: string | null;
  situacao: { situacao: string; rotulo: string } | null;
  /** Texto literal de `catalogo.js` (regras da tela). */
  regras: string;
  /** Itens de `catalogo.js` (exceções), já com a primeira letra maiúscula. */
  excecoes: string[];
  /** Referência do requisito: campos, ações, regras e exceções de `catalogo.js`. */
  referencia: Array<[string, string]>;
}

/** As sete abas do detalhamento do protótipo (`aplicacao.js` L7), com o conteúdo real da fatia. */
export function AbasContabeis({ aba, onAba, ficha, eventos, carregandoEventos, erroEventos, situacao, regras, excecoes, referencia }: Props) {
  return (
    <Tabs value={aba} onValueChange={(valor) => onAba(valor as Aba)}>
      <TabsList className="w-full justify-start overflow-x-auto">
        {ABAS.map((nome) => <TabsTrigger key={nome} value={nome} className="shrink-0 text-xs">{nome}</TabsTrigger>)}
      </TabsList>
      <TabsContent value="Ficha e campos" className="pt-3">{ficha}</TabsContent>
      <TabsContent value="Movimentações" className="pt-3">
        <AbaMovimentacoes>
          {erroEventos && <p role="alert" className="text-xs text-destructive">{erroEventos}</p>}
          <div className="overflow-x-auto rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Acontecimento</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Efeito</TableHead>
                  <TableHead>Situação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {eventos.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={4} className="text-muted-foreground">
                      {carregandoEventos ? 'Carregando acontecimentos…' : 'Nenhum acontecimento registrado.'}
                    </TableCell>
                  </TableRow>
                ) : eventos.map((evento) => (
                  <TableRow key={`${evento.quando}-${evento.acontecimento}`}>
                    <TableCell>{evento.acontecimento}</TableCell>
                    <TableCell>{evento.quem}</TableCell>
                    <TableCell>{evento.justificativa}</TableCell>
                    <TableCell>{situacao ? <SeloSituacao situacao={situacao.situacao} rotulo={situacao.rotulo} /> : null}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </AbaMovimentacoes>
      </TabsContent>
      <TabsContent value="Regras e validações" className="pt-3 text-sm">
        <SecaoRotulo>Regras de negócio documentadas</SecaoRotulo>
        <Regra>{regras}</Regra>
        <Aviso>A permissão é conferida no servidor. A visibilidade do menu não substitui o controle de acesso ou de alçada.</Aviso>
      </TabsContent>
      <TabsContent value="Exceções" className="pt-3 text-sm">
        <SecaoRotulo>Catálogo de erros e respostas da interface</SecaoRotulo>
        {excecoes.map((item) => (
          <Regra key={item} erro>
            <p><b>Bloqueio / exceção:</b> {item}.</p>
            <span className="text-muted-foreground">
              Ação: bloquear conclusão, preservar alterações válidas, registrar ocorrência e permitir revisão autorizada.
            </span>
          </Regra>
        ))}
      </TabsContent>
      <TabsContent value="Histórico" className="pt-3">
        <AbaHistoricoFiscal
          eventos={eventos.map((evento) => ({ resumo: evento.acontecimento, criadoEm: evento.quando, usuarioNome: evento.quem, justificativa: evento.justificativa }))}
          carregando={carregandoEventos}
          erro={erroEventos}
        />
      </TabsContent>
      <TabsContent value="Integrações" className="pt-3 text-sm">
        <SecaoRotulo>Dependências e conexões do domínio</SecaoRotulo>
        <Regra>Esta tela não chama serviço externo.</Regra>
      </TabsContent>
      <TabsContent value="Aceite e testes" className="pt-3 text-sm">
        <SecaoRotulo>Matriz de homologação funcional e técnica</SecaoRotulo>
        <ul aria-label="Critérios de aceite" className="list-disc space-y-1.5 pl-5 text-xs">
          {ACEITE.map((item) => <li key={item}>{item}</li>)}
        </ul>
        <SecaoRotulo>Referência do requisito</SecaoRotulo>
        {referencia.map(([titulo, texto]) => (
          <Regra key={titulo}><strong>{titulo}</strong><br />{texto}</Regra>
        ))}
        <Aviso alerta>
          Os critérios acima são de leitura e não registram aceite. O aceite depende de evidências automatizadas,
          homologação e responsável autorizado.
        </Aviso>
      </TabsContent>
    </Tabs>
  );
}
