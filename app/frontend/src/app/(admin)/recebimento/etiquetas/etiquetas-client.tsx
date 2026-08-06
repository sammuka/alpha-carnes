'use client';

import { useCallback, useEffect, useState } from 'react';
import { Eye, Printer, QrCode, Search, XCircle } from 'lucide-react';
import type { EtiquetaListada, EstadoEtiqueta, PaginadoRecebimento, RecebimentoResumo } from '@/lib/operacao';
import { rotuloDestinoPeca, statusPecaVariant } from '@/lib/status-ui';
import { Badge } from '@/components/ui/badge';
import { BadgeCount } from '@/components/ui/badge-count';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { StatusPill } from '@/components/ui/status-pill';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { SelectNative } from '@/components/ui/select-native';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableCellCode,
  TableCellNum,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// Derivação D6.2: domínio v1.1 §10.4 → os 5 rótulos de EtiquetasRecebimento.tsx:13.
export function rotuloEtiqueta(e: EtiquetaListada): string {
  if (e.estado === 'cancelada') return 'Cancelada';
  if (e.estado === 'invalidada_por_troca') return 'Cancelada';
  if (e.estado === 'emitida') return 'Pendente de impressão';
  if (e.bloqueada) return 'Bloqueada';
  return e.estado === 'reimpressa' ? 'Reimpressa' : 'Ativa';
}

export const cancelavel = (e: EtiquetaListada) =>
  !e.bloqueada && ['ativa', 'reimpressa', 'emitida'].includes(e.estado);
export const reimprimivel = (e: EtiquetaListada) =>
  e.estado !== 'cancelada' && e.estado !== 'invalidada_por_troca';

export function rotuloStatusDesossa(statusPeca: string): { texto: string; classe: string } {
  return statusPeca === 'em_transformacao' || statusPeca === 'transformada'
    ? { texto: 'Consumida por transformação', classe: 'text-violet-700' }
    : { texto: 'Aguardando desossa', classe: 'text-amber-600' };
}

// EtiquetasRecebimento.tsx:433 — título dinâmico da 3ª seção, NUNCA a string fixa "Destino"
export function tituloSecaoDestino(e: EtiquetaListada): string {
  if (e.pedidoVendaId) return 'Pedido vinculado';
  if (e.statusPeca === 'em_sobra') return 'Estoque';
  return 'Desossa';
}

const ESTADOS: EstadoEtiqueta[] = [
  'emitida', 'ativa', 'invalidada_por_troca', 'reimpressa', 'cancelada',
];

const MOTIVOS_CANCEL = [
  { value: 'peso_incorreto', label: 'Peso informado incorretamente' },
  { value: 'pedido_incorreto', label: 'Pedido selecionado incorretamente' },
  { value: 'destino_incorreto', label: 'Destino selecionado incorretamente' },
  { value: 'etiqueta_incorreta', label: 'Etiqueta impressa incorretamente' },
  { value: 'peca_incorreta', label: 'Peça identificada incorretamente' },
  { value: 'outro', label: 'Outro' },
] as const;

interface PaginadoEtiquetas {
  data: EtiquetaListada[];
  total: number;
  page: number;
  pageSize: number;
}

export function EtiquetasRecebimentoClient({ permissoes }: { permissoes: string[] }) {
  const podeLer = permissoes.includes('ETIQUETA_GERENCIAR') || permissoes.includes('PESAGEM_LER');
  const podeGerenciar = permissoes.includes('ETIQUETA_GERENCIAR');

  const [recebimentos, setRecebimentos] = useState<RecebimentoResumo[]>([]);
  const [recebimentoId, setRecebimentoId] = useState('');
  const [etiquetas, setEtiquetas] = useState<EtiquetaListada[]>([]);
  const [busca, setBusca] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState<string>('');
  const [selecionada, setSelecionada] = useState<EtiquetaListada | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [motivoCancel, setMotivoCancel] = useState<string>('etiqueta_incorreta');
  const [obsCancel, setObsCancel] = useState('');
  const [modalCancelar, setModalCancelar] = useState(false);
  const [modalReimprimir, setModalReimprimir] = useState(false);

  const codigoLote = recebimentos.find((r) => r.id === recebimentoId)?.codigoLote
    ?? recebimentoId.slice(0, 8).toUpperCase();

  const carregarRecebimentos = useCallback(async () => {
    const res = await fetch('/api/operacao/recebimentos?pageSize=30', { cache: 'no-store' });
    if (res.ok) {
      const pag = (await res.json()) as PaginadoRecebimento;
      setRecebimentos(pag.data);
      if (pag.data[0] && !recebimentoId) setRecebimentoId(pag.data[0].id);
    }
  }, [recebimentoId]);

  const carregarEtiquetas = useCallback(async () => {
    if (!recebimentoId || !podeLer) return;
    setCarregando(true);
    setErro(null);
    const qs = new URLSearchParams({ recebimentoId, pageSize: '100' });
    if (busca.trim()) qs.set('busca', busca.trim());
    if (estadoFiltro) qs.set('estado', estadoFiltro);
    const res = await fetch(`/api/operacao/etiquetas?${qs}`, { cache: 'no-store' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErro((body as { message?: string }).message ?? 'Erro ao carregar etiquetas');
      setCarregando(false);
      return;
    }
    const pag = (await res.json()) as PaginadoEtiquetas;
    setEtiquetas(pag.data);
    setCarregando(false);
  }, [recebimentoId, podeLer, busca, estadoFiltro]);

  useEffect(() => { void carregarRecebimentos(); }, [carregarRecebimentos]);
  useEffect(() => { void carregarEtiquetas(); }, [carregarEtiquetas]);

  const reimprimir = async (pecaId: string) => {
    if (!podeGerenciar) return;
    setErro(null);
    const res = await fetch(`/api/operacao/pesagem/pecas/${pecaId}/etiqueta/reimprimir`, { method: 'POST' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErro((body as { message?: string }).message ?? 'Erro ao reimprimir');
      return;
    }
    setModalReimprimir(false);
    await carregarEtiquetas();
  };

  const cancelar = async () => {
    if (!selecionada || !podeGerenciar) return;
    setErro(null);
    const res = await fetch(`/api/operacao/etiquetas/${selecionada.id}/cancelar`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        motivo: motivoCancel,
        ...(motivoCancel === 'outro' && obsCancel.trim() ? { observacoes: obsCancel.trim() } : {}),
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErro((body as { message?: string }).message ?? 'Erro ao cancelar etiqueta');
      return;
    }
    setModalCancelar(false);
    setSelecionada(null);
    await carregarEtiquetas();
  };

  if (!podeLer) {
    return <p className="text-sm text-destructive">Você não tem permissão para visualizar etiquetas.</p>;
  }

  const tituloDestino = selecionada
    ? (selecionada.pedidoVendaId
      || selecionada.statusPeca === 'em_sobra'
      || ['para_corte', 'em_transformacao', 'transformada'].includes(selecionada.statusPeca)
      ? tituloSecaoDestino(selecionada)
      : null)
    : null;

  return (
    <div className="space-y-3">
      <PageHeader
        title="Etiquetas — recebimento"
        subtitle="Consulta, reimpressão e cancelamento conforme v1.1 §10.4"
      />

      {erro && (
        <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {erro}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Etiquetas</CardTitle>
          <BadgeCount>{etiquetas.length}</BadgeCount>
          <CardAction>
            <SelectNative
              aria-label="Recebimento"
              selectSize="sm"
              className="w-[220px]"
              value={recebimentoId}
              onChange={(e) => setRecebimentoId(e.target.value)}
            >
              {recebimentos.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.dataOperacao} — {r.codigoLote ?? r.id.slice(0, 8)}…
                </option>
              ))}
            </SelectNative>
            <SelectNative
              aria-label="Estado"
              selectSize="sm"
              className="w-[150px]"
              value={estadoFiltro || 'todos'}
              onChange={(e) => setEstadoFiltro(e.target.value === 'todos' ? '' : e.target.value)}
            >
              <option value="todos">Todos os estados</option>
              {ESTADOS.map((e) => (
                <option key={e} value={e}>{e}</option>
              ))}
            </SelectNative>
            <div className="w-[200px]">
              <Input
                adornLeft={<Search />}
                placeholder="Código, peça…"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="h-7 text-xs"
              />
            </div>
          </CardAction>
        </CardHeader>
        <CardContent className="p-0">
          {carregando ? (
            <p className="p-6 text-sm text-muted-foreground">Carregando etiquetas…</p>
          ) : etiquetas.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">Nenhuma etiqueta neste recebimento.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Etiqueta</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-right">Peso</TableHead>
                  <TableHead>Destino</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {etiquetas.map((e) => (
                  <TableRow key={e.id} className="group">
                    <TableCellCode>
                      <span className="inline-flex items-center gap-1">
                        <QrCode size={13} />
                        {e.codigo ?? e.pecaId.slice(0, 8)}
                      </span>
                    </TableCellCode>
                    <TableCell><Badge variant="outline">{rotuloEtiqueta(e)}</Badge></TableCell>
                    <TableCell className="text-muted-foreground">{e.produtoCodigo} — {e.produtoDescricao}</TableCell>
                    <TableCellNum>{e.pesoOriginal} kg</TableCellNum>
                    <TableCell>
                      <StatusPill variant={statusPecaVariant(e.statusPeca)} label={rotuloDestinoPeca(e.statusPeca)} />
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                        <Button variant="ghost" size="iconSm" onClick={() => setSelecionada(e)} aria-label="Ver etiqueta">
                          <Eye />
                        </Button>
                        {podeGerenciar && reimprimivel(e) && (
                          <Button variant="ghost" size="iconSm" onClick={() => { setSelecionada(e); setModalReimprimir(true); }} aria-label="Reimprimir">
                            <Printer />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Sheet open={Boolean(selecionada)} onOpenChange={(o) => !o && setSelecionada(null)}>
        <SheetContent className="overflow-y-auto sm:max-w-[520px]">
          <SheetHeader>
            <SheetTitle>Detalhe da etiqueta</SheetTitle>
          </SheetHeader>
          {selecionada && (
            <div className="space-y-3 p-4 text-sm">
              {/* Preview */}
              <pre className="rounded-md bg-surface-2 p-3 font-data text-[11px] leading-relaxed">
                <span className="block uppercase tracking-widest text-muted-foreground">Preview da etiqueta</span>
                <span className="mt-1 block text-[18px] font-black">{selecionada.codigo ?? '—'}</span>
                <span className="block">{selecionada.produtoCodigo} · {selecionada.produtoDescricao}</span>
                <span className="block">{selecionada.pesoOriginal} kg · NF-e {selecionada.nfNumero ?? '—'}</span>
                <span className="block">Lote {codigoLote} · {selecionada.frigorifico}</span>
              </pre>

              {(selecionada.estado === 'cancelada' || selecionada.estado === 'invalidada_por_troca') && (
                <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-destructive">
                  Motivo: {selecionada.motivoCancelamento ?? '—'}
                </div>
              )}

              <section>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Dados da peça</p>
                <dl className="space-y-2">
                  <div><dt className="text-muted-foreground">Código</dt><dd className="font-mono text-xs">{selecionada.pecaId}</dd></div>
                  <div><dt className="text-muted-foreground">Produto</dt><dd>{selecionada.produtoCodigo} — {selecionada.produtoDescricao}</dd></div>
                  <div><dt className="text-muted-foreground">Peso</dt><dd>{selecionada.pesoOriginal} kg</dd></div>
                  <div><dt className="text-muted-foreground">Status</dt><dd>{rotuloDestinoPeca(selecionada.statusPeca)}</dd></div>
                  <div><dt className="text-muted-foreground">Destino</dt><dd>{rotuloDestinoPeca(selecionada.statusPeca)}</dd></div>
                  {selecionada.caracteristicas.length > 0 && (
                    <div><dt className="text-muted-foreground">Características</dt><dd>{selecionada.caracteristicas.join(', ')}</dd></div>
                  )}
                </dl>
              </section>

              <section>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Rastreabilidade</p>
                <dl className="space-y-2">
                  <div><dt className="text-muted-foreground">Lote</dt><dd>{codigoLote}</dd></div>
                  <div><dt className="text-muted-foreground">NF-e</dt><dd>{selecionada.nfNumero ?? '—'}</dd></div>
                  <div><dt className="text-muted-foreground">Frigorífico</dt><dd>{selecionada.frigorifico}</dd></div>
                  <div><dt className="text-muted-foreground">Romaneio</dt><dd>{selecionada.romaneio ?? '—'}</dd></div>
                  <div><dt className="text-muted-foreground">Placa</dt><dd>{selecionada.placaVeiculo ?? '—'}</dd></div>
                  <div><dt className="text-muted-foreground">Motorista</dt><dd>{selecionada.motorista ?? '—'}</dd></div>
                  <div><dt className="text-muted-foreground">Pesagem</dt><dd>{new Date(selecionada.createdAt).toLocaleString('pt-BR')}</dd></div>
                  <div><dt className="text-muted-foreground">Operador</dt><dd>{selecionada.operadorNome}</dd></div>
                </dl>
              </section>

              {tituloDestino && (
                <section>
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{tituloDestino}</p>
                  {tituloDestino === 'Pedido vinculado' && (
                    <dl className="space-y-2">
                      <div>
                        <dt className="text-muted-foreground">Cliente/Pedido</dt>
                        <dd>
                          {selecionada.clienteNome ?? '—'}
                          {selecionada.pedidoVendaId ? ` · Pedido ${selecionada.pedidoVendaId.slice(0, 8)}…` : ''}
                        </dd>
                      </div>
                      <div><dt className="text-muted-foreground">Representante</dt><dd>{selecionada.representanteNome ?? '—'}</dd></div>
                      <div><dt className="text-muted-foreground">Rota</dt><dd>{selecionada.rotaPrevista ?? '—'}</dd></div>
                    </dl>
                  )}
                  {tituloDestino === 'Estoque' && (
                    <dl className="space-y-2">
                      <div className="flex items-center gap-2">
                        <dt className="text-muted-foreground">Local previsto</dt>
                        {selecionada.localEstoquePrevisto?.provisorio && <Badge variant="outline">Provisório</Badge>}
                        <dd>{selecionada.localEstoquePrevisto?.valor ?? '—'}</dd>
                      </div>
                      <div><dt className="text-muted-foreground">Tipo</dt><dd>Estoque físico</dd></div>
                      <div><dt className="text-muted-foreground">Data entrada</dt><dd>{new Date(selecionada.createdAt).toLocaleString('pt-BR')}</dd></div>
                    </dl>
                  )}
                  {tituloDestino === 'Desossa' && (
                    <dl className="space-y-2">
                      <div>
                        <dt className="text-muted-foreground">Status na desossa</dt>
                        <dd className={rotuloStatusDesossa(selecionada.statusPeca).classe}>
                          {rotuloStatusDesossa(selecionada.statusPeca).texto}
                        </dd>
                      </div>
                      <div><dt className="text-muted-foreground">Peça mãe</dt><dd className="font-mono text-xs">{selecionada.pecaId}</dd></div>
                    </dl>
                  )}
                </section>
              )}

              <section>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Histórico</p>
                <ul className="space-y-2 border-l-2 border-border pl-3">
                  <li className="text-xs">
                    <span className="font-semibold">{selecionada.estado}</span>
                    {' · '}{new Date(selecionada.createdAt).toLocaleString('pt-BR')}
                  </li>
                  {selecionada.historico.map((h) => (
                    <li key={h.id} className="text-xs text-muted-foreground">
                      {h.estado} · {new Date(h.createdAt).toLocaleString('pt-BR')}
                      {h.motivoCancelamento ? ` · ${h.motivoCancelamento}` : ''}
                    </li>
                  ))}
                </ul>
              </section>

              <div className="flex flex-col gap-2 pt-2">
                {podeGerenciar && reimprimivel(selecionada) && (
                  <Button onClick={() => setModalReimprimir(true)}>
                    <Printer /> Reimprimir
                  </Button>
                )}
                {podeGerenciar && cancelavel(selecionada) && (
                  <Button variant="destructive" onClick={() => setModalCancelar(true)}>
                    <XCircle /> Cancelar etiqueta
                  </Button>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={modalReimprimir && Boolean(selecionada)} onOpenChange={setModalReimprimir}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reimprimir etiqueta</DialogTitle>
          </DialogHeader>
          {selecionada && (
            <p className="text-[13px] text-fg-secondary">
              Inclui etiquetas pendentes de impressão. Confirma reimpressão de {selecionada.codigo ?? selecionada.pecaId.slice(0, 8)}?
            </p>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setModalReimprimir(false)}>Cancelar</Button>
            <Button onClick={() => selecionada && void reimprimir(selecionada.pecaId)}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={modalCancelar && Boolean(selecionada)} onOpenChange={setModalCancelar}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar etiqueta e estornar ação</DialogTitle>
          </DialogHeader>
          <p className="text-[13px] text-[var(--color-status-divergencia)]">
            Esta ação irá invalidá-la e estornar a ação operacional vinculada.
          </p>
          <FormField label="Motivo" required htmlFor="motivo-cancelar-etiqueta">
            <SelectNative
              id="motivo-cancelar-etiqueta"
              value={motivoCancel}
              onChange={(e) => setMotivoCancel(e.target.value)}
            >
              {MOTIVOS_CANCEL.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </SelectNative>
          </FormField>
          {motivoCancel === 'outro' && (
            <Input placeholder="Observações" value={obsCancel} onChange={(e) => setObsCancel(e.target.value)} />
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setModalCancelar(false)}>Voltar</Button>
            <Button variant="destructive" onClick={() => void cancelar()}>Confirmar cancelamento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
