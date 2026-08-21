'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, RefreshCw, Download, Eye,
  Search, FileText, Ban, Info, XCircle,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { StatusPill } from '@/components/ui/status-pill';
import { statusNfseVariant } from '@/lib/status-ui';
import { conectarRealtime, type RealtimeMensagem } from '@/lib/realtime';
import { cn } from '@/lib/cn';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SelectNative } from '@/components/ui/select-native';
import { FormField } from '@/components/ui/form-field';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader } from '@/components/ui/page-header';
import { BadgeCount } from '@/components/ui/badge-count';
import { KpiStrip, Kpi } from '@/components/ui/kpi-strip';
import { Card, CardContent, CardHeader, CardTitle, CardAction } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Table, TableBody, TableCell, TableCellCode, TableCellNum, TableFooter, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import type {
  AmbienteFiscal, NotaFiscalListagem, Paginado, RastreabilidadeNota, StatusNfse,
} from '@/lib/faturamento';
import { mensagemDeErro } from '@/lib/error-message';

// ── Badge de ambiente EISS (mesmo padrão de pre-faturamento-client.tsx — T8) ────

function BadgeAmbiente({ homologacao }: { homologacao: boolean }) {
  return (
    <BadgeCount
      className={cn(
        'h-[22px] gap-1.5 px-2.5 text-[11px]',
        homologacao ? 'bg-warning-soft text-warning-fg' : 'bg-success-soft text-success-fg',
      )}
    >
      <AlertTriangle className="size-3.5 shrink-0" />
      {homologacao ? 'Homologação EISS' : 'Produção EISS'}
    </BadgeCount>
  );
}

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtKg(v: number) {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + ' kg';
}

function truncChave(chave: string | null) {
  if (!chave) return '—';
  return chave.length > 14 ? `${chave.slice(0, 8)}…${chave.slice(-6)}` : chave;
}

function rotuloStatus(status: StatusNfse): string {
  const rotulos: Record<StatusNfse, string> = {
    pendente: 'Pendente',
    emitida: 'Autorizada',
    erro_emissao: 'Erro',
    cancelada: 'Cancelada',
    erro_cancelamento: 'Erro no cancelamento',
  };
  return rotulos[status];
}

/** Mapeamento StatusPill exigido pela Tarefa 28 — autorizada→expedido, erro→bloqueado, processando→recebido, cancelada→pendente ("Cancelada"). */
function statusPillNota(status: StatusNfse): { variant: ReturnType<typeof statusNfseVariant>; label: string } {
  switch (status) {
    case 'emitida':
      return { variant: 'expedido', label: 'Autorizada' };
    case 'erro_emissao':
    case 'erro_cancelamento':
      return { variant: 'bloqueado', label: 'Erro' };
    case 'pendente':
      return { variant: 'recebido', label: 'Processando' };
    case 'cancelada':
      return { variant: 'pendente', label: 'Cancelada' };
    default:
      return { variant: statusNfseVariant(status), label: rotuloStatus(status) };
  }
}

const MOTIVOS_CANCELAMENTO = [
  'Pedido selecionado incorretamente',
  'Peso/preço lançado incorretamente',
  'Cliente incorreto',
  'Solicitação do cliente',
  'Outro',
];

// ── Modal: Cancelar Nota (D10.4) ────────────────────────────────────────────────

function ModalCancelar({ nota, onClose, onConfirm }: {
  nota: NotaFiscalListagem | null;
  onClose: () => void;
  onConfirm: (motivo: string) => Promise<void>;
}) {
  const [motivo, setMotivo] = useState('');
  const [obs, setObs] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setMotivo('');
    setObs('');
  }, [nota]);

  if (!nota) return null;

  if (nota.caminhaoLiberado) {
    return (
      <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelamento bloqueado</DialogTitle>
          </DialogHeader>
          <div className="flex items-start gap-2 rounded-md border border-danger-soft-border bg-danger-soft p-3">
            <Ban className="mt-0.5 size-3.5 shrink-0 text-danger-fg" />
            <p className="text-xs leading-snug text-danger-fg">
              O caminhão desta carga já foi liberado. Notas só podem ser canceladas antes da liberação do caminhão.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={onClose}>Entendi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancelar Nota {nota.numeroNfse ?? nota.id}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-y-1.5 rounded-lg bg-surface-2 p-3 text-xs">
          <div><span className="text-muted-foreground">Pedido: </span><span className="font-data font-semibold text-foreground">{nota.pedidoVendaId.slice(0, 8)}</span></div>
          <div><span className="text-muted-foreground">Cliente: </span><span className="font-semibold text-foreground">{nota.clienteNome}</span></div>
          <div className="col-span-2"><span className="text-muted-foreground">Valor: </span><span className="font-data font-semibold text-foreground">{fmtBRL(Number(nota.valor))}</span></div>
        </div>
        <FormField label="Motivo do cancelamento" required htmlFor="motivo-cancelamento-nota">
          <SelectNative id="motivo-cancelamento-nota" value={motivo} onChange={(e) => setMotivo(e.target.value)}>
            <option value="">Selecionar...</option>
            {MOTIVOS_CANCELAMENTO.map((m) => <option key={m}>{m}</option>)}
          </SelectNative>
        </FormField>
        <FormField label="Observação" htmlFor="obs-cancelamento-nota">
          <Textarea id="obs-cancelamento-nota" rows={2} value={obs} onChange={(e) => setObs(e.target.value)} />
        </FormField>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>Voltar</Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!motivo || submitting}
            onClick={() => {
              setSubmitting(true);
              void onConfirm(motivo).finally(() => setSubmitting(false));
            }}
          >
            Confirmar Cancelamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Drawer: rastreabilidade (D10.7) ─────────────────────────────────────────────

function DrawerRastreabilidade({ notaId, onClose }: { notaId: string | null; onClose: () => void }) {
  const [dados, setDados] = useState<RastreabilidadeNota | null>(null);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    if (!notaId) { setDados(null); return; }
    setCarregando(true);
    fetch(`/api/operacao/faturamento/notas/${notaId}/rastreabilidade`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: RastreabilidadeNota | null) => setDados(data))
      .finally(() => setCarregando(false));
  }, [notaId]);

  if (!notaId) return null;
  const nota = dados?.nota;

  return (
    <Sheet open={!!notaId} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent side="right" className="w-[520px] sm:max-w-[520px] gap-0 p-0">
        <SheetHeader className="flex-row items-center justify-between gap-2 border-b border-border p-4">
          <SheetTitle className="text-[16px] font-bold">Nota {nota?.numeroNfse ?? '—'}</SheetTitle>
        </SheetHeader>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {carregando && <p className="text-xs text-muted-foreground">Carregando…</p>}

          {nota && (
            <>
              <div className="flex items-center gap-2">
                {(() => {
                  const s = statusPillNota(nota.statusNfse);
                  return <StatusPill variant={s.variant} label={s.label} />;
                })()}
              </div>

              {nota.statusNfse === 'erro_emissao' && nota.ultimoErroNfse && (
                <div className="flex items-start gap-2 rounded-md border border-danger-soft-border bg-danger-soft p-3">
                  <XCircle className="mt-0.5 size-3.5 shrink-0 text-danger-fg" />
                  <p className="text-xs text-danger-fg">{nota.ultimoErroNfse}</p>
                </div>
              )}

              {/* Vínculo pedido ↔ peças ↔ pesos ↔ item fiscal */}
              <div>
                <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.04em] text-muted-foreground">
                  Vínculo pedido ↔ peças ↔ pesos ↔ item fiscal
                </p>
                <div className="grid grid-cols-2 gap-3 rounded-md bg-surface-2 p-3 text-xs">
                  {[
                    ['Pedido', dados?.pedido?.id?.slice(0, 8) ?? nota.pedidoVendaId.slice(0, 8)],
                    ['Cliente', dados?.pedido?.clienteNome ?? '—'],
                    ['Chave de verificação', nota.codigoVerificacao ?? '—'],
                    ['Data/hora', nota.emitidaEm ?? nota.createdAt],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <p className="text-[10px] font-medium uppercase tracking-[0.04em] text-fg-faint">{k}</p>
                      <p className="mt-0.5 text-xs font-semibold text-foreground">{v}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Peças/subitens */}
              <div>
                <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.04em] text-muted-foreground">Peças</p>
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Etiqueta</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead className="text-right">Peso</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(dados?.pecas ?? []).map((p, i) => (
                      <TableRow key={i}>
                        <TableCellCode>{p.etiqueta ?? '—'}</TableCellCode>
                        <TableCell className="font-semibold text-foreground">{p.produtoNome}</TableCell>
                        <TableCellNum>{fmtKg(Number(p.peso ?? 0))}</TableCellNum>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={2}>Peso total</TableCell>
                      <TableCellNum>{dados ? fmtKg(Number(dados.pesoTotalKg)) : '—'}</TableCellNum>
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            </>
          )}
        </div>

        <div className="flex gap-2 border-t border-border p-4">
          <a
            href={nota?.linkNfse ?? undefined}
            target="_blank"
            rel="noopener noreferrer"
            title={nota?.linkNfse ? 'Baixar XML' : 'Link da nota ainda não disponível'}
            aria-disabled={!nota?.linkNfse}
            className={cn(
              buttonVariants({ variant: 'secondary', size: 'sm' }),
              !nota?.linkNfse && 'pointer-events-none opacity-50',
            )}
          >
            <Download /> Baixar XML
          </a>
          <a
            href={nota?.linkNfse ?? undefined}
            target="_blank"
            rel="noopener noreferrer"
            title={nota?.linkNfse ? 'Ver DANFE' : 'Link da nota ainda não disponível'}
            aria-disabled={!nota?.linkNfse}
            className={cn(
              buttonVariants({ variant: 'secondary', size: 'sm' }),
              !nota?.linkNfse && 'pointer-events-none opacity-50',
            )}
          >
            <FileText /> Ver DANFE
          </a>
          <Button className="ml-auto" size="sm" onClick={onClose}>Fechar</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function NotasXmlClient({ permissoes }: { permissoes: string[] }) {
  const pode = (p: string) => permissoes.includes(p);

  const [notas, setNotas] = useState<NotaFiscalListagem[]>([]);
  const [total, setTotal] = useState(0);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<StatusNfse | 'Todos'>('Todos');
  const [drawerNotaId, setDrawerNotaId] = useState<string | null>(null);
  const [modalCancelar, setModalCancelar] = useState<NotaFiscalListagem | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reprocessandoId, setReprocessandoId] = useState<string | null>(null);
  const [ambiente, setAmbiente] = useState<AmbienteFiscal | null>(null);

  useEffect(() => {
    fetch('/api/operacao/faturamento/ambiente', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: AmbienteFiscal | null) => setAmbiente(data))
      .catch(() => setAmbiente(null));
  }, []);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const params = new URLSearchParams();
      if (busca.trim()) params.set('busca', busca.trim());
      if (filtroStatus !== 'Todos') params.set('status', filtroStatus);
      const res = await fetch(`/api/operacao/faturamento/notas?${params.toString()}`, { cache: 'no-store' });
      if (!res.ok) { setErro('Falha ao carregar notas'); return; }
      const data = (await res.json()) as Paginado<NotaFiscalListagem>;
      setNotas(data.data);
      setTotal(data.total);
    } catch {
      setErro('Erro de conexão');
    } finally {
      setLoading(false);
    }
  }, [busca, filtroStatus]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    const EVENTOS_RELEVANTES = new Set(['nfse_emitida', 'nfse_cancelada', 'nfse_erro_emissao', 'caminhao_liberado']);
    const onMessage = (msg: RealtimeMensagem) => {
      if (EVENTOS_RELEVANTES.has(msg.type)) void carregar();
    };
    const desconectar = conectarRealtime({ rooms: ['dashboard'], onMessage, onReconnect: () => void carregar() });
    return desconectar;
  }, [carregar]);

  const kpis = useMemo(() => {
    const hoje = new Date().toISOString().slice(0, 10);
    const emitidasHoje = notas.filter((n) => n.emitidaEm?.startsWith(hoje));
    return {
      autorizadasHoje: emitidasHoje.filter((n) => n.statusNfse === 'emitida').length,
      comErro: notas.filter((n) => n.statusNfse === 'erro_emissao').length,
      aguardandoRetorno: notas.filter((n) => n.statusNfse === 'pendente').length,
    };
  }, [notas]);

  async function reprocessar(notaId: string) {
    setReprocessandoId(notaId);
    setErro(null);
    try {
      const res = await fetch(`/api/operacao/faturamento/notas/${notaId}/reprocessar`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
      });
      if (!res.ok) { setErro(await mensagemDeErro(res, 'Falha ao reprocessar')); return; }
      await carregar();
    } catch {
      setErro('Erro de conexão');
    } finally {
      setReprocessandoId(null);
    }
  }

  async function confirmarCancelamento(motivo: string) {
    if (!modalCancelar) return;
    setErro(null);
    try {
      const res = await fetch(`/api/operacao/faturamento/notas/${modalCancelar.id}/cancelar`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ motivo }),
      });
      if (!res.ok) { setErro(await mensagemDeErro(res, 'Falha ao cancelar')); return; }
      setModalCancelar(null);
      await carregar();
    } catch {
      setErro('Erro de conexão');
    }
  }

  return (
    <div className="space-y-3">
      <PageHeader title="Notas / XML" subtitle="Consulta das notas emitidas via integração EISS Osasco-SP.">
        {ambiente && <BadgeAmbiente homologacao={ambiente.homologacao} />}
      </PageHeader>

      {erro && (
        <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {erro}
        </div>
      )}

      {/* KPIs */}
      <KpiStrip>
        <Kpi label="Autorizadas hoje" value={kpis.autorizadasHoje} hint="notas autorizadas" tone="ok" />
        <Kpi label="Com erro" value={kpis.comErro} hint="aguardando reprocessamento" tone="danger" />
        <Kpi label="Aguardando retorno" value={kpis.aguardandoRetorno} hint="processando no EISS" tone="alert" />
      </KpiStrip>

      {/* Tabela */}
      <Card>
        <CardHeader>
          <CardTitle>Notas fiscais</CardTitle>
          <BadgeCount>{total}</BadgeCount>
          <CardAction>
            <Input
              adornLeft={<Search />}
              placeholder="Buscar nota, chave, cliente..."
              className="h-7 w-[240px] text-xs"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
            <SelectNative
              selectSize="sm"
              className="w-[150px]"
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value as StatusNfse | 'Todos')}
            >
              <option value="Todos">Status: Todos</option>
              <option value="emitida">Autorizada</option>
              <option value="erro_emissao">Erro</option>
              <option value="pendente">Processando</option>
              <option value="cancelada">Cancelada</option>
            </SelectNative>
          </CardAction>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-6 text-xs text-muted-foreground" data-testid="loading">Carregando notas…</p>
          ) : notas.length === 0 ? (
            <EmptyState icon={<FileText />} title="Nenhuma nota encontrada para os filtros atuais." className="py-12" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Nº nota</TableHead>
                  <TableHead>Chave / autenticador</TableHead>
                  <TableHead>Pedido / Carga</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data/hora</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {notas.map((n) => {
                  const pill = statusPillNota(n.statusNfse);
                  return (
                    <TableRow key={n.id} className="group">
                      <TableCellCode>{n.numeroNfse ?? '—'}</TableCellCode>
                      <TableCellCode title={n.codigoVerificacao ?? undefined}>{truncChave(n.codigoVerificacao)}</TableCellCode>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-semibold text-foreground">{n.pedidoVendaId.slice(0, 8)}</span>
                          <span className="text-[10px] text-muted-foreground">{n.caminhaoId.slice(0, 8)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[160px] truncate text-fg-secondary">{n.clienteNome}</TableCell>
                      <TableCellNum>{fmtBRL(Number(n.valor))}</TableCellNum>
                      <TableCell>
                        <StatusPill variant={pill.variant} label={pill.label} />
                        {n.caminhaoLiberado && <p className="mt-0.5 text-[10px] text-muted-foreground">Caminhão liberado</p>}
                      </TableCell>
                      <TableCellNum>{n.emitidaEm ?? n.createdAt}</TableCellNum>
                      <TableCell>
                        <div className="flex justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                          <a
                            href={n.linkNfse ?? undefined}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={n.linkNfse ? 'Baixar XML' : 'Link da nota ainda não disponível — emissão pendente ou sem retorno do EISS'}
                            aria-disabled={!n.linkNfse}
                            className={cn(
                              buttonVariants({ variant: 'ghost', size: 'iconSm' }),
                              !n.linkNfse && 'pointer-events-none opacity-40',
                            )}
                          >
                            <Download />
                          </a>
                          <a
                            href={n.linkNfse ?? undefined}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={n.linkNfse ? 'Ver DANFE' : 'Link da nota ainda não disponível — emissão pendente ou sem retorno do EISS'}
                            aria-disabled={!n.linkNfse}
                            className={cn(
                              buttonVariants({ variant: 'ghost', size: 'iconSm' }),
                              !n.linkNfse && 'pointer-events-none opacity-40',
                            )}
                          >
                            <FileText />
                          </a>
                          <Button variant="ghost" size="iconSm" title="Ver detalhe" onClick={() => setDrawerNotaId(n.id)}>
                            <Eye />
                          </Button>
                          {n.statusNfse === 'erro_emissao' && pode('NFSE_EMITIR') && (
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Reprocessar"
                              disabled={reprocessandoId === n.id}
                              onClick={() => void reprocessar(n.id)}
                            >
                              <RefreshCw /> {reprocessandoId === n.id ? 'Reprocessando…' : 'Reprocessar'}
                            </Button>
                          )}
                          {n.statusNfse === 'emitida' && pode('NFSE_CANCELAR') && (
                            n.caminhaoLiberado ? (
                              <span
                                title="Caminhão já liberado — cancelamento bloqueado"
                                className="flex size-7 items-center justify-center text-fg-faint"
                              >
                                <Ban className="size-3.5" />
                              </span>
                            ) : (
                              <Button variant="ghost" size="iconSm" title="Cancelar nota" onClick={() => setModalCancelar(n)}>
                                <XCircle />
                              </Button>
                            )
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Rodapé informativo */}
      <p className="text-[11px] text-fg-faint">
        <Info className="mr-1 inline size-3.5 shrink-0 -translate-y-px" aria-hidden="true" />
        Número, chave, XML e DANFE são obtidos do retorno da integração EISS Osasco-SP. Cancelamento de nota só é permitido antes da liberação do caminhão.
      </p>

      <DrawerRastreabilidade notaId={drawerNotaId} onClose={() => setDrawerNotaId(null)} />
      <ModalCancelar nota={modalCancelar} onClose={() => setModalCancelar(null)} onConfirm={confirmarCancelamento} />
    </div>
  );
}
