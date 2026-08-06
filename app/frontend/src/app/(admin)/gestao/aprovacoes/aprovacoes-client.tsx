'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { SeletorOperacao } from '@/components/gestao/seletor-operacao';
import { QuadroComparativo } from '@/components/gestao/quadro-comparativo';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader } from '@/components/ui/page-header';
import { StatusPill } from '@/components/ui/status-pill';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/cn';
import {
  buscarComparativo,
  decidirAprovacao,
  encerrarOcorrencia,
  listarAprovacoes,
  registrarAndamento,
  ROTULO_STATUS_APROVACAO,
  ROTULO_STATUS_OCORRENCIA,
  ROTULO_TIPO_APROVACAO,
  type AprovacaoOperacional,
  type OcorrenciaLista,
} from '@/lib/aprovacoes';
import { mensagemDeErro } from '@/lib/error-message';

interface DetalheOcorrencia {
  status: string;
  desfecho: string | null;
  dataHoraEncerramento: string | null;
  historico: Array<{ id: string; acao: string; situacao: string | null; createdAt: string }>;
}

function formatDataHora(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR');
}

function AprovacoesConteudo({ permissoes }: { permissoes: string[] }) {
  const searchParams = useSearchParams();
  const operacaoId = searchParams.get('operacaoId');
  const podeDecidir = permissoes.includes('APROVACOES_DECIDIR');

  const [aba, setAba] = useState<'ocorrencias' | 'operacionais'>('ocorrencias');
  const [ocorrencias, setOcorrencias] = useState<OcorrenciaLista[]>([]);
  const [operacionais, setOperacionais] = useState<AprovacaoOperacional[]>([]);
  const [ocorrenciaSel, setOcorrenciaSel] = useState<OcorrenciaLista | null>(null);
  const [aprovacaoSel, setAprovacaoSel] = useState<AprovacaoOperacional | null>(null);
  const [comparativo, setComparativo] = useState<{ itens: Parameters<typeof QuadroComparativo>[0]['itens'] } | null>(null);
  const [semComparativo, setSemComparativo] = useState(false);
  const [detalheOcorrencia, setDetalheOcorrencia] = useState<DetalheOcorrencia | null>(null);
  const [andamento, setAndamento] = useState('');
  const [motivo, setMotivo] = useState('');
  const [modalDecisao, setModalDecisao] = useState<'aprovada' | 'rejeitada' | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!operacaoId) return;
    setErro(null);
    try {
      if (aba === 'ocorrencias') {
        const res = await listarAprovacoes<OcorrenciaLista>({ operacaoId, aba: 'ocorrencias' });
        setOcorrencias(res.data);
        if (!ocorrenciaSel && res.data[0]) setOcorrenciaSel(res.data[0]);
      } else {
        const res = await listarAprovacoes<AprovacaoOperacional>({ operacaoId, aba: 'operacionais' });
        setOperacionais(res.data);
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar');
    }
  }, [operacaoId, aba, ocorrenciaSel]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const carregarDetalheOcorrencia = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/operacao/ocorrencias-fornecedor/${id}`);
      if (!res.ok) throw new Error(await mensagemDeErro(res));
      setDetalheOcorrencia(await res.json() as DetalheOcorrencia);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar detalhe da ocorrência');
    }
  }, []);

  useEffect(() => {
    if (!ocorrenciaSel) {
      setComparativo(null);
      setSemComparativo(false);
      setDetalheOcorrencia(null);
      return;
    }
    void buscarComparativo(ocorrenciaSel.id).then((c) => {
      if (!c) {
        setSemComparativo(true);
        setComparativo(null);
      } else {
        setSemComparativo(false);
        setComparativo(c as { itens: Parameters<typeof QuadroComparativo>[0]['itens'] });
      }
    });
    void carregarDetalheOcorrencia(ocorrenciaSel.id);
  }, [ocorrenciaSel, carregarDetalheOcorrencia]);

  const enviarAndamento = async () => {
    if (!ocorrenciaSel || !andamento.trim()) return;
    try {
      await registrarAndamento(ocorrenciaSel.id, andamento.trim());
      setAndamento('');
      await carregar();
      await carregarDetalheOcorrencia(ocorrenciaSel.id);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao registrar andamento');
    }
  };

  const concluir = async () => {
    if (!ocorrenciaSel || !motivo.trim()) return;
    try {
      await encerrarOcorrencia(ocorrenciaSel.id, motivo.trim());
      setMotivo('');
      await carregar();
      await carregarDetalheOcorrencia(ocorrenciaSel.id);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao encerrar');
    }
  };

  const confirmarDecisao = async () => {
    if (!aprovacaoSel || !modalDecisao || motivo.trim().length < 10) return;
    try {
      await decidirAprovacao(aprovacaoSel.id, modalDecisao, motivo.trim());
      setModalDecisao(null);
      setMotivo('');
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro na decisão');
    }
  };

  return (
    <div className="space-y-3">
      <PageHeader title="Aprovações" subtitle="Fila administrativa e aprovações operacionais">
        <SeletorOperacao />
      </PageHeader>

      {erro && (
        <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{erro}</div>
      )}

      <Tabs value={aba} onValueChange={(v) => setAba(v as 'ocorrencias' | 'operacionais')}>
        <TabsList>
          <TabsTrigger value="ocorrencias">Fila Administrativa de Ocorrências</TabsTrigger>
          <TabsTrigger value="operacionais">Aprovações Operacionais</TabsTrigger>
        </TabsList>

        <TabsContent value="ocorrencias">
          <div className="grid items-start gap-2.5 lg:grid-cols-[320px_1fr]">
            <Card>
              <div className="max-h-[560px] overflow-y-auto overflow-x-hidden">
                {ocorrencias.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setOcorrenciaSel(o)}
                    className={cn(
                      'block w-full border-b border-border px-3 py-2 text-left transition-colors duration-100 hover:bg-surface-2',
                      ocorrenciaSel?.id === o.id && 'bg-primary-soft shadow-[inset_2px_0_0_var(--color-primary)]',
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <b className="min-w-0 flex-1 truncate text-[13px] font-semibold">{o.fornecedorNome}</b>
                      <StatusPill variant="pendente" label={ROTULO_STATUS_OCORRENCIA[o.status] ?? o.status} className="h-[17px] text-[10px]" />
                    </span>
                  </button>
                ))}
              </div>
            </Card>

            <div className="space-y-2.5">
              {ocorrenciaSel && (
                <>
                  <Card>
                    <CardContent className="space-y-3">
                      <p className="text-[13px]"><strong>Fornecedor:</strong> {ocorrenciaSel.fornecedorNome}</p>
                      <p className="text-[13px]"><strong>NF:</strong> {ocorrenciaSel.nfChave ?? '—'}</p>
                      <p className="text-[13px]"><strong>Pedido/lote:</strong> {ocorrenciaSel.pedidoLote ?? '—'}</p>

                      {detalheOcorrencia?.status === 'resolvida' ? (
                        <div className="flex items-start gap-2 rounded-lg border border-success-soft-border bg-success-soft p-3">
                          <div>
                            <p className="text-[13px] font-bold text-success-fg">Resultado</p>
                            <p className="mt-0.5 text-[13px] text-success-fg">{detalheOcorrencia.desfecho}</p>
                            {detalheOcorrencia.dataHoraEncerramento && (
                              <p className="mt-1 text-xs text-success-fg/80">
                                Concluída em {formatDataHora(detalheOcorrencia.dataHoraEncerramento)}
                              </p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <>
                          <FormField label="Registrar andamento" htmlFor="andamento">
                            <Textarea id="andamento" value={andamento} onChange={(e) => setAndamento(e.target.value)} rows={2} />
                          </FormField>
                          <Button size="sm" onClick={() => void enviarAndamento()} disabled={!andamento.trim()}>Registrar andamento</Button>

                          <FormField label="Concluir tratativa" htmlFor="desfecho">
                            <Textarea id="desfecho" value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} />
                          </FormField>
                          <Button size="sm" variant="secondary" onClick={() => void concluir()} disabled={!motivo.trim()}>Concluir tratativa</Button>
                        </>
                      )}
                    </CardContent>
                  </Card>

                  {detalheOcorrencia?.historico && detalheOcorrencia.historico.length > 0 && (
                    <Card>
                      <CardContent>
                        <h3 className="text-[13px] font-semibold">Timeline de andamentos</h3>
                        <div className="mt-3 flex flex-col gap-0">
                          {[...detalheOcorrencia.historico]
                            .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
                            .map((h, i, arr) => (
                              <div key={h.id} className="flex items-start gap-3 pb-4 last:pb-0">
                                <div className="flex flex-col items-center">
                                  <div className={cn('mt-1 h-2 w-2 shrink-0 rounded-full', i === arr.length - 1 ? 'bg-primary' : 'bg-fg-faint')} />
                                  {i < arr.length - 1 && <div className="mt-1 min-h-[16px] w-px flex-1 bg-border" />}
                                </div>
                                <div className="flex-1">
                                  <div className="flex flex-wrap items-center gap-3">
                                    <span className="text-[13px] font-medium">{h.acao}</span>
                                    <span className="font-data text-[10px] text-fg-faint">{formatDataHora(h.createdAt)}</span>
                                  </div>
                                </div>
                              </div>
                            ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {semComparativo ? (
                    <p className="text-sm text-muted-foreground">Sem conferência tripla concluída para esta ocorrência</p>
                  ) : comparativo ? (
                    <QuadroComparativo itens={comparativo.itens} />
                  ) : null}
                </>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="operacionais">
          <div className="space-y-2.5">
            {operacionais.map((a) => (
              <Card key={a.id}>
                <CardContent className="p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[13px] font-semibold">{ROTULO_TIPO_APROVACAO[a.tipo]}</span>
                    <StatusPill variant="pendente" label={ROTULO_STATUS_APROVACAO[a.status] ?? a.status} />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{a.descricao}</p>
                  <p className="mt-1 text-xs text-muted-foreground"><strong className="text-foreground">Impacto:</strong> {a.impacto}</p>
                  {a.status === 'pendente' && podeDecidir && (
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" onClick={() => { setAprovacaoSel(a); setModalDecisao('aprovada'); }}>Aprovar solicitação</Button>
                      <Button size="sm" variant="destructiveOutline" onClick={() => { setAprovacaoSel(a); setModalDecisao('rejeitada'); }}>Rejeitar solicitação</Button>
                    </div>
                  )}
                  {a.decisaoMotivo && (
                    <p className="mt-2 text-xs text-muted-foreground">Decisão: {a.decisaoMotivo}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={modalDecisao !== null} onOpenChange={() => setModalDecisao(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{modalDecisao === 'aprovada' ? 'Aprovar solicitação' : 'Rejeitar solicitação'}</DialogTitle>
          </DialogHeader>
          <div className="px-4">
            <FormField label="Motivo" required help="Mín. 10 caracteres" htmlFor="motivo-decisao">
              <Textarea id="motivo-decisao" value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} />
            </FormField>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setModalDecisao(null)}>Cancelar</Button>
            <Button onClick={() => void confirmarDecisao()} disabled={motivo.trim().length < 10}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function AprovacoesClient({ permissoes }: { permissoes: string[] }) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Carregando…</p>}>
      <AprovacoesConteudo permissoes={permissoes} />
    </Suspense>
  );
}
