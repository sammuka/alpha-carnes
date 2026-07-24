'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  ArrowLeftRight,
  Package,
  Scale,
  Search,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { conectarRealtime, type RealtimeMensagem } from '@/lib/realtime';
import {
  MOTIVOS_CAPTURA_MANUAL,
  type AcaoLote,
  type FaltaDesossa,
  type MotivoCapturaManual,
  type PaginadoRecebimento,
  type Peca,
  type RecebimentoDetalhe,
  type RecebimentoItem,
  type RecebimentoResumoEnriquecido,
  type ResultadoSugestao,
  type StatusDispositivo,
  type StatusDispositivos,
  type StatusRecebimento,
  type SugestaoScored,
} from '@/lib/operacao';
import {
  rotuloDestinoPeca,
  statusPecaVariant,
  statusRecebimentoVariant,
} from '@/lib/status-ui';
import { ProgressoBalancaBar } from '@/components/recebimento/progresso-balanca-bar';
import { StatusPill } from '@/components/ui/status-pill';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/cn';

const STATUS_RECEB_LABEL: Record<StatusRecebimento, string> = {
  aguardando_conferencia: 'Aguardando conferência',
  em_conferencia: 'Em conferência',
  finalizado: 'Finalizado',
  cancelado: 'Cancelado',
};

const COR_DISPOSITIVO: Record<StatusDispositivo, string> = {
  disponivel: 'border-[var(--color-status-expedido)]/30 bg-[var(--color-status-expedido-bg)] text-[var(--color-status-expedido)]',
  instavel: 'border-[var(--color-status-divergencia)]/30 bg-[var(--color-status-divergencia-bg)] text-[var(--color-status-divergencia)]',
  indisponivel: 'border-[var(--color-status-bloqueado)]/30 bg-[var(--color-status-bloqueado-bg)] text-[var(--color-status-bloqueado)]',
};

function BadgeDispositivo({ rotulo, status }: { rotulo: string; status?: StatusDispositivo }) {
  const cls = status ? COR_DISPOSITIVO[status] : 'border-border bg-muted text-muted-foreground';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium',
        cls,
      )}
    >
      {status === 'disponivel' ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
      {rotulo}: {status ?? '—'}
    </span>
  );
}

function formatPeso(val: string | null | undefined): string {
  if (!val) return '0,000';
  const n = Number(val);
  if (Number.isNaN(n)) return val;
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

function formatHora(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

function calcRestante(esperada: string, apurada: string | null | undefined): string {
  const e = Number(esperada);
  const a = Number(apurada ?? 0);
  if (Number.isNaN(e) || Number.isNaN(a)) return '—';
  const diff = Math.max(0, e - a);
  return diff.toLocaleString('pt-BR', { maximumFractionDigits: 3 });
}

function labelProduto(item: RecebimentoItem): string {
  if (item.itemComercial) {
    return `${item.itemComercial.codigo} — ${item.itemComercial.descricao}`;
  }
  return item.origemDescricao ?? item.itemComercialId.slice(0, 8);
}

function pesadoItem(item: RecebimentoItem): string {
  if (item.requerBalanca && item.pesoTotalApurado) return item.pesoTotalApurado;
  return item.quantidadeApurada ?? item.quantidadeRecebida ?? '0';
}

export function PesagemDestinacaoClient({ permissoes }: { permissoes: string[] }) {
  const searchParams = useSearchParams();
  const recebimentoIdQuery = searchParams.get('recebimentoId');

  const podePesar = permissoes.includes('PESAGEM_GERENCIAR');
  const podeAssociar = permissoes.includes('ASSOCIACAO_GERENCIAR');
  const podeManual = permissoes.includes('PESO_MANUAL');
  const podeEtiqueta = permissoes.includes('ETIQUETA_GERENCIAR');

  const [recebimentos, setRecebimentos] = useState<RecebimentoResumoEnriquecido[]>([]);
  const [recebimentoId, setRecebimentoId] = useState('');
  const [detalhe, setDetalhe] = useState<RecebimentoDetalhe | null>(null);
  const [acoes, setAcoes] = useState<AcaoLote[]>([]);
  const [faltas, setFaltas] = useState<FaltaDesossa[]>([]);
  const [itemComercialBaseId, setItemComercialBaseId] = useState('');
  const [dataOperacao, setDataOperacao] = useState('');

  const [dispositivos, setDispositivos] = useState<StatusDispositivos | null>(null);
  const [peca, setPeca] = useState<Peca | null>(null);
  const [sugestao, setSugestao] = useState<ResultadoSugestao | null>(null);
  const [buscaPedido, setBuscaPedido] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [statusRt, setStatusRt] = useState<'conectado' | 'desconectado'>('desconectado');
  const [submitting, setSubmitting] = useState(false);
  const [manualAberto, setManualAberto] = useState(false);
  const [pesoManual, setPesoManual] = useState('');
  const [motivo, setMotivo] = useState<MotivoCapturaManual>('dispositivo_indisponivel');
  const [motivoSobra, setMotivoSobra] = useState('');
  const [trocarLoteAberto, setTrocarLoteAberto] = useState(false);

  const [caracteristicas, setCaracteristicas] = useState({
    maisPesada: false,
    maisGorda: false,
    melhorAcabamento: false,
  });

  const carregarRecebimentos = useCallback(async () => {
    const res = await fetch('/api/operacao/recebimentos?pageSize=30', { cache: 'no-store' });
    if (!res.ok) return;
    const pag = (await res.json()) as PaginadoRecebimento;
    const ativos = pag.data.filter((r) => r.status !== 'finalizado' && r.status !== 'cancelado');
    setRecebimentos(ativos);
  }, []);

  const carregarDetalhe = useCallback(async (id: string) => {
    if (!id) {
      setDetalhe(null);
      return;
    }
    const res = await fetch(`/api/operacao/recebimentos/${id}`, { cache: 'no-store' });
    if (!res.ok) {
      setDetalhe(null);
      return;
    }
    const d = (await res.json()) as RecebimentoDetalhe;
    setDetalhe(d);
    setDataOperacao(d.dataOperacao);
  }, []);

  const carregarAcoes = useCallback(async (id: string) => {
    if (!id) {
      setAcoes([]);
      return;
    }
    const res = await fetch(`/api/operacao/recebimentos/${id}/acoes`, { cache: 'no-store' });
    if (!res.ok) {
      setAcoes([]);
      return;
    }
    const data = await res.json();
    setAcoes(Array.isArray(data) ? (data as AcaoLote[]) : []);
  }, []);

  const carregarFaltas = useCallback(async () => {
    const res = await fetch('/api/desossa/faltas', { cache: 'no-store' });
    if (!res.ok) {
      setFaltas([]);
      return;
    }
    const data = await res.json();
    setFaltas(Array.isArray(data) ? (data as FaltaDesossa[]) : []);
  }, []);

  const carregarStatus = useCallback(async () => {
    const res = await fetch('/api/operacao/pesagem/dispositivos/status', { cache: 'no-store' });
    if (res.ok) setDispositivos((await res.json()) as StatusDispositivos);
  }, []);

  const carregarSugestao = useCallback(async (pecaId: string) => {
    const res = await fetch(`/api/operacao/pesagem/pecas/${pecaId}/sugestao`, { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setSugestao(null);
      setErro((data as { message?: string }).message ?? 'Falha ao carregar sugestões');
      return;
    }
    setSugestao(data as ResultadoSugestao);
  }, []);

  const refreshLote = useCallback(async () => {
    if (!recebimentoId) return;
    await Promise.all([carregarDetalhe(recebimentoId), carregarAcoes(recebimentoId)]);
  }, [recebimentoId, carregarDetalhe, carregarAcoes]);

  useEffect(() => {
    void carregarRecebimentos();
    void carregarStatus();
    void carregarFaltas();
  }, [carregarRecebimentos, carregarStatus, carregarFaltas]);

  useEffect(() => {
    if (recebimentoIdQuery) setRecebimentoId(recebimentoIdQuery);
  }, [recebimentoIdQuery]);

  useEffect(() => {
    if (recebimentoId) {
      void carregarDetalhe(recebimentoId);
      void carregarAcoes(recebimentoId);
    }
  }, [recebimentoId, carregarDetalhe, carregarAcoes]);

  useEffect(() => {
    const primeiro = recebimentos[0];
    if (primeiro && !recebimentoId && !recebimentoIdQuery) {
      setRecebimentoId(primeiro.id);
    }
  }, [recebimentos, recebimentoId, recebimentoIdQuery]);

  useEffect(() => {
    if (!detalhe?.itens.length) return;
    const primeiroItem = detalhe.itens[0];
    if (!primeiroItem) return;
    const atualValido = detalhe.itens.some((i) => i.itemComercialId === itemComercialBaseId);
    if (!itemComercialBaseId || !atualValido) {
      setItemComercialBaseId(primeiroItem.itemComercialId);
    }
  }, [detalhe, itemComercialBaseId]);

  useEffect(() => {
    if (!dataOperacao) return;
    const onMessage = (msg: RealtimeMensagem) => {
      if (msg.type === 'dispositivo_status_alterado') {
        void carregarStatus();
        return;
      }
      if (
        msg.type === 'peca_pesada' ||
        msg.type === 'peca_associada' ||
        msg.type === 'peca_redirecionada'
      ) {
        const payload = msg.payload as { recebimentoId?: string } | undefined;
        if (payload?.recebimentoId && payload.recebimentoId !== recebimentoId) return;
        void refreshLote();
        void carregarFaltas();
      }
    };
    const desconectar = conectarRealtime({
      rooms: ['dashboard', `operacao:${dataOperacao}`],
      onMessage,
      onReconnect: () => {
        void carregarStatus();
        void refreshLote();
        void carregarFaltas();
      },
      onStatus: setStatusRt,
    });
    return desconectar;
  }, [dataOperacao, recebimentoId, carregarStatus, refreshLote, carregarFaltas]);

  const compativeisFiltrados = useMemo(() => {
    if (!sugestao?.compativeis.length) return [];
    const q = buscaPedido.trim().toLowerCase();
    if (!q) return sugestao.compativeis;
    return sugestao.compativeis.filter(
      (s) =>
        s.clienteId.toLowerCase().includes(q) ||
        s.pedidoVendaId.toLowerCase().includes(q) ||
        s.justificativa.toLowerCase().includes(q) ||
        (s.rotaPrevista?.toLowerCase().includes(q) ?? false),
    );
  }, [sugestao, buscaPedido]);

  const pesoExibido = peca?.pesoOriginal ?? null;
  const balancaIndisponivel = dispositivos?.balanca.status !== 'disponivel';
  const itemAtivo = detalhe?.itens.find((i) => i.itemComercialId === itemComercialBaseId);

  async function chamar<T>(url: string, body?: unknown): Promise<T | null> {
    setErro(null);
    setSubmitting(true);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro((data as { message?: string }).message ?? 'Falha na operação');
        return null;
      }
      return data as T;
    } catch {
      setErro('Erro de conexão');
      return null;
    } finally {
      setSubmitting(false);
    }
  }

  const pesar = async (modo: 'automatico' | 'manual_assistido') => {
    if (!recebimentoId || !itemComercialBaseId) return;
    const meta: Record<string, unknown> = {};
    if (caracteristicas.maisPesada) meta.maisPesada = true;
    if (caracteristicas.maisGorda) meta.maisGorda = true;
    if (caracteristicas.melhorAcabamento) meta.melhorAcabamento = true;

    const body =
      modo === 'automatico'
        ? { recebimentoId, itemComercialBaseId, modoCaptura: 'automatico', capturaMeta: meta }
        : {
            recebimentoId,
            itemComercialBaseId,
            modoCaptura: 'manual_assistido',
            pesoManual: Number(pesoManual),
            motivo,
            capturaMeta: meta,
          };

    const p = await chamar<Peca>('/api/operacao/pesagem/pecas', body);
    if (p) {
      setPeca(p);
      setManualAberto(false);
      setPesoManual('');
      await carregarSugestao(p.id);
      await refreshLote();
    }
  };

  const confirmarPedido = async (s: SugestaoScored) => {
    if (!peca) return;
    const p = await chamar<Peca>(`/api/operacao/pesagem/pecas/${peca.id}/confirmar`, {
      pedidoVendaItemId: s.pedidoVendaItemId,
    });
    if (p) {
      setPeca(p);
      setSugestao(null);
      await refreshLote();
    }
  };

  const destinarSemCobertura = async (destino: 'sobra' | 'corte') => {
    if (!peca) return;
    const body: Record<string, unknown> = { destino };
    if (destino === 'sobra') {
      body.motivo = motivoSobra || 'Destinação operacional para estoque';
    }
    const p = await chamar<Peca>(`/api/operacao/pesagem/pecas/${peca.id}/sem-cobertura`, body);
    if (p) {
      setPeca(p);
      setSugestao(null);
      await refreshLote();
    }
  };

  const emitirEtiqueta = async () => {
    if (!peca) return;
    const r = await chamar<{ peca: Peca }>(`/api/operacao/pesagem/pecas/${peca.id}/etiqueta`);
    if (r) {
      setPeca(r.peca);
      await refreshLote();
    }
  };

  const trocarLote = (id: string) => {
    setRecebimentoId(id);
    setPeca(null);
    setSugestao(null);
    setBuscaPedido('');
    setTrocarLoteAberto(false);
  };

  const toggleCaracteristica = (key: keyof typeof caracteristicas) => {
    setCaracteristicas((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const pecaAguardandoDestino = peca?.statusPeca === 'pesada';
  const pecaProntaEtiqueta =
    peca &&
    (peca.statusPeca === 'associada' ||
      peca.statusPeca === 'em_sobra' ||
      peca.statusPeca === 'para_corte');

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold text-foreground">Pesagem &amp; Destinação</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Captura de peso e destino da peça recebida
            {statusRt === 'conectado' && (
              <span className="ml-2 inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-status-expedido)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-status-expedido)]" aria-hidden />
                tempo real
              </span>
            )}
            {statusRt === 'desconectado' && (
              <span className="ml-2 text-xs text-muted-foreground">· reconectando…</span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2" data-testid="status-dispositivos">
          <BadgeDispositivo rotulo="Balança" status={dispositivos?.balanca.status} />
          <BadgeDispositivo rotulo="Impressora" status={dispositivos?.impressora.status} />
          <BadgeDispositivo rotulo="Leitor" status={dispositivos?.leitor.status} />
        </div>
      </div>

      {erro && (
        <div
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {erro}
        </div>
      )}

      {/* Lote bar */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-3 p-4">
          {detalhe ? (
            <>
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold">{detalhe.codigoLote}</span>
                <StatusPill
                  variant={statusRecebimentoVariant(detalhe.status)}
                  label={STATUS_RECEB_LABEL[detalhe.status]}
                />
              </div>
              <MetaLote label="Fornecedor" value={detalhe.fornecedor?.razaoSocial} />
              <MetaLote
                label="NF"
                value={
                  detalhe.nfeNumero
                    ? `${detalhe.nfeNumero}${detalhe.nfeSerie ? `/${detalhe.nfeSerie}` : ''}`
                    : null
                }
              />
              <MetaLote label="Romaneio" value={detalhe.romaneio} />
              <MetaLote label="Placa" value={detalhe.placaVeiculo} />
              <MetaLote label="Motorista" value={detalhe.motorista} />
              {detalhe.doca && <MetaLote label="Doca" value={detalhe.doca} />}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Balança</span>
                <ProgressoBalancaBar valor={detalhe.progressoBalanca} />
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum lote selecionado.</p>
          )}
          <div className="ml-auto">
            {trocarLoteAberto ? (
              <div className="flex items-center gap-2">
                <Select value={recebimentoId} onValueChange={trocarLote}>
                  <SelectTrigger className="w-[280px]">
                    <SelectValue placeholder="Selecione o lote" />
                  </SelectTrigger>
                  <SelectContent>
                    {recebimentos.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.codigoLote} — {r.fornecedorNome} ({STATUS_RECEB_LABEL[r.status as StatusRecebimento] ?? r.status})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="sm" onClick={() => setTrocarLoteAberto(false)}>
                  Cancelar
                </Button>
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setTrocarLoteAberto(true)}>
                <ArrowLeftRight className="mr-1.5 h-4 w-4" />
                Trocar Lote
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Product tabs */}
      {detalhe && detalhe.itens.length > 0 && (
        <div className="flex flex-wrap gap-2 border-b border-border pb-1">
          {detalhe.itens.map((item) => {
            const ativo = item.itemComercialId === itemComercialBaseId;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setItemComercialBaseId(item.itemComercialId)}
                className={cn(
                  'rounded-t-lg px-4 py-2 text-sm font-medium transition-colors',
                  ativo
                    ? 'border border-b-0 border-border bg-card text-foreground'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                )}
              >
                {labelProduto(item)}
              </button>
            );
          })}
        </div>
      )}

      {/* 3-column grid */}
      <div className="grid gap-4 xl:grid-cols-3">
        {/* a) Scale panel */}
        <Card className="xl:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Scale className="h-4 w-4" />
              Balança
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border border-border bg-muted/30 px-4 py-8 text-center">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Peso atual</p>
              <p className="mt-1 text-5xl font-bold tabular-nums tracking-tight">
                {formatPeso(pesoExibido)}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">kg</p>
            </div>

            {itemAtivo && (
              <p className="text-xs text-muted-foreground">
                Produto: <span className="font-medium text-foreground">{labelProduto(itemAtivo)}</span>
              </p>
            )}

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Características (opcional)</Label>
              <div className="flex flex-wrap gap-2">
                <ToggleChip
                  active={caracteristicas.maisPesada}
                  onClick={() => toggleCaracteristica('maisPesada')}
                  label="Mais pesada"
                />
                <ToggleChip
                  active={caracteristicas.maisGorda}
                  onClick={() => toggleCaracteristica('maisGorda')}
                  label="Mais gorda"
                />
                <ToggleChip
                  active={caracteristicas.melhorAcabamento}
                  onClick={() => toggleCaracteristica('melhorAcabamento')}
                  label="Melhor acabamento"
                />
              </div>
            </div>

            {podePesar && (
              <div className="flex flex-wrap gap-2">
                <Button
                  className="flex-1"
                  onClick={() => pesar('automatico')}
                  disabled={!recebimentoId || !itemComercialBaseId || submitting}
                >
                  Capturar Peso
                </Button>
                {podeManual && (
                  <Button
                    variant="outline"
                    onClick={() => setManualAberto((v) => !v)}
                    disabled={submitting}
                  >
                    Digitar
                  </Button>
                )}
              </div>
            )}

            {manualAberto && podeManual && (
              <div className="space-y-2 rounded-lg border border-border p-3">
                <Label htmlFor="peso-manual">Peso manual (kg)</Label>
                <Input
                  id="peso-manual"
                  type="number"
                  step="0.001"
                  placeholder="0,000"
                  value={pesoManual}
                  onChange={(e) => setPesoManual(e.target.value)}
                />
                <select
                  aria-label="Motivo da captura manual"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value as MotivoCapturaManual)}
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                >
                  {MOTIVOS_CAPTURA_MANUAL.map((m) => (
                    <option key={m} value={m}>
                      {m.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
                <Button
                  className="w-full"
                  onClick={() => pesar('manual_assistido')}
                  disabled={!pesoManual || submitting}
                >
                  Confirmar peso manual
                </Button>
              </div>
            )}

            {balancaIndisponivel && (
              <p className="text-xs text-[var(--color-status-divergencia)]">
                Balança indisponível — use peso manual assistido.
              </p>
            )}

            {peca && (
              <div
                className="rounded-lg border border-border p-3 text-sm"
                data-testid="peca-atual"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">Peça {peca.id.slice(0, 8)}…</span>
                  <StatusPill
                    variant={statusPecaVariant(peca.statusPeca)}
                    label={rotuloDestinoPeca(peca.statusPeca)}
                  />
                </div>
                <p className="mt-1 text-muted-foreground">
                  <span data-testid="peca-status">{peca.statusPeca}</span>
                  {' · '}
                  {formatPeso(peca.pesoOriginal)} kg
                </p>

                {pecaAguardandoDestino && podeAssociar && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => destinarSemCobertura('sobra')}
                      disabled={submitting}
                    >
                      Estoque
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => destinarSemCobertura('corte')}
                      disabled={submitting}
                    >
                      Desossa
                    </Button>
                  </div>
                )}

                {pecaAguardandoDestino && podeAssociar && (
                  <Input
                    className="mt-2"
                    placeholder="Motivo (estoque)"
                    value={motivoSobra}
                    onChange={(e) => setMotivoSobra(e.target.value)}
                  />
                )}

                {pecaProntaEtiqueta && podeEtiqueta && (
                  <Button
                    className="mt-3 w-full"
                    size="sm"
                    onClick={emitirEtiqueta}
                    disabled={submitting || Boolean(peca.etiquetaAtual)}
                  >
                    {peca.etiquetaAtual ? `Etiqueta: ${peca.etiquetaAtual}` : 'Confirmar e imprimir etiqueta'}
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* b) Compatible orders */}
        <Card className="xl:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Pedidos compatíveis</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Buscar cliente"
                value={buscaPedido}
                onChange={(event) => setBuscaPedido(event.target.value)}
                disabled={!peca || !sugestao}
              />
            </div>

            {!peca && (
              <EmptyState message="Capture o peso para ver pedidos compatíveis." />
            )}

            {peca && !sugestao && (
              <EmptyState message="Carregando sugestões…" />
            )}

            {peca && sugestao && compativeisFiltrados.length === 0 && (
              <EmptyState message="Nenhum pedido compatível encontrado." />
            )}

            <ul className="max-h-[420px] space-y-2 overflow-y-auto">
              {compativeisFiltrados.map((s) => {
                const principal = sugestao?.sugestao?.pedidoVendaItemId === s.pedidoVendaItemId;
                return (
                  <li
                    key={s.pedidoVendaItemId}
                    className={cn(
                      'rounded-lg border p-3 text-sm',
                      principal
                        ? 'border-[var(--color-primary)]/40 bg-[var(--color-primary)]/5'
                        : 'border-border',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        {principal && (
                          <span className="mb-1 inline-block text-xs font-semibold text-[var(--color-primary)]">
                            Sugestão principal
                          </span>
                        )}
                        <p className="font-medium truncate">
                          Pedido {s.pedidoVendaId.slice(0, 8)}…
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          Cliente {s.clienteId.slice(0, 8)}…
                          {s.rotaPrevista ? ` · Rota ${s.rotaPrevista}` : ''}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">{s.justificativa}</p>
                        <p className="mt-0.5 text-xs">
                          Saldo pendente: {s.saldoPendente}
                          {s.prioridade != null ? ` · Prioridade ${s.prioridade}` : ''}
                        </p>
                      </div>
                      {podeAssociar && pecaAguardandoDestino && (
                        <Button
                          size="sm"
                          variant={principal ? 'default' : 'outline'}
                          onClick={() => confirmarPedido(s)}
                          disabled={submitting}
                        >
                          Vincular
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>

        {/* c) Demandas desossa */}
        <Card className="xl:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Demandas desossa</CardTitle>
          </CardHeader>
          <CardContent>
            {faltas.length === 0 ? (
              <EmptyState message="Nenhuma demanda de desossa pendente." />
            ) : (
              <ul className="max-h-[480px] space-y-2 overflow-y-auto">
                {faltas.map((f) => (
                  <li key={f.produto.id} className="rounded-lg border border-border p-3 text-sm">
                    <p className="font-medium">
                      {f.produto.codigo} — {f.produto.nome}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Faltante: {f.quantidadeFaltante} · Estoque: {f.quantidadeEstoque}
                    </p>
                    <p className="text-xs text-muted-foreground">Origem: {f.origem}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom 2-col */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Acumulado do lote</CardTitle>
          </CardHeader>
          <CardContent>
            {!detalhe?.itens.length ? (
              <EmptyState message="Sem itens no lote." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-right">Previsto</TableHead>
                    <TableHead className="text-right">Pesado</TableHead>
                    <TableHead className="text-right">Restante</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detalhe.itens.map((item) => {
                    const apurado = pesadoItem(item);
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="max-w-[180px] truncate">{labelProduto(item)}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {item.quantidadeEsperada}
                          {item.unidadeEsperada ? ` ${item.unidadeEsperada}` : ''}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {apurado}
                          {item.requerBalanca ? ' kg' : item.unidadeEsperada ? ` ${item.unidadeEsperada}` : ''}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {calcRestante(item.quantidadeEsperada, apurado)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Ações realizadas</CardTitle>
          </CardHeader>
          <CardContent>
            {acoes.length === 0 ? (
              <EmptyState message="Nenhuma ação registrada neste lote." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Hora</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-right">Peso</TableHead>
                    <TableHead>Destino</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Etiqueta</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {acoes.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="whitespace-nowrap text-xs">{formatHora(a.hora)}</TableCell>
                      <TableCell className="max-w-[120px] truncate text-xs">
                        {a.produtoCodigo ?? '—'}
                        {a.produtoDescricao ? ` · ${a.produtoDescricao}` : ''}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-xs">
                        {a.peso ? `${formatPeso(a.peso)} kg` : '—'}
                      </TableCell>
                      <TableCell className="text-xs">
                        {a.statusPeca ? (
                          <StatusPill
                            variant={statusPecaVariant(a.statusPeca)}
                            label={a.destino}
                            className="text-[10px]"
                          />
                        ) : (
                          a.destino
                        )}
                      </TableCell>
                      <TableCell className="max-w-[100px] truncate text-xs">
                        {a.clientePedido ?? '—'}
                      </TableCell>
                      <TableCell className="max-w-[80px] truncate text-xs">
                        {a.etiqueta ?? '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetaLote({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <span className="text-sm">
      <span className="text-muted-foreground">{label}:</span>{' '}
      <span className="font-medium">{value}</span>
    </span>
  );
}

function ToggleChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
        active
          ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
          : 'border-border text-muted-foreground hover:bg-muted',
      )}
    >
      {label}
    </button>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
      {message}
    </p>
  );
}
