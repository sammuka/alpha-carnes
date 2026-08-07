'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowLeftRight, Scale, Search } from 'lucide-react';
import { conectarRealtime, type RealtimeMensagem } from '@/lib/realtime';
import {
  MOTIVOS_CAPTURA_MANUAL,
  ROTULOS_MOTIVO_ESTORNO,
  type AcaoLote,
  type FaltaDesossa,
  type MotivoCapturaManual,
  type MotivoEstorno,
  type PaginadoRecebimento,
  type Peca,
  type RecebimentoDetalhe,
  type RecebimentoItem,
  type RecebimentoResumoEnriquecido,
  type ResultadoSugestao,
  type StatusDispositivos,
  type StatusRecebimento,
  type SugestaoScored,
} from '@/lib/operacao';
import {
  TrocaPecaFluxo,
  type PecaTrocaOpcao,
  type PedidoTrocaOpcao,
} from '@/components/ui/troca-peca-modal';
import {
  rotuloDestinoPeca,
  statusPecaVariant,
  statusRecebimentoVariant,
} from '@/lib/status-ui';
import { ProgressoBalancaBar } from '@/components/recebimento/progresso-balanca-bar';
import { BadgeCount } from '@/components/ui/badge-count';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DeviceBadge } from '@/components/ui/device-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { FilterChip } from '@/components/ui/filter-chip';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { SelectNative } from '@/components/ui/select-native';
import { StatusPill } from '@/components/ui/status-pill';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableCellCode,
  TableCellNum,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/cn';

const STATUS_RECEB_LABEL: Record<StatusRecebimento, string> = {
  pesagem_em_andamento: 'Pesagem em andamento',
  aguardando_conclusao_pesagem: 'Pesagem em andamento',
  aguardando_conferencia_final: 'Aguardando conferência final',
  conferido_sem_divergencia: 'Conferido sem divergência',
  conferido_com_divergencia: 'Conferido com divergência',
  ocorrencia_administrativa_aberta: 'Ocorrência administrativa aberta',
  tratativa_administrativa_concluida: 'Tratativa concluída',
  cancelado: 'Cancelado',
};

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
  const podeEstornar = permissoes.includes('ASSOCIACAO_ESTORNAR');
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
  const [estornoAberto, setEstornoAberto] = useState(false);
  const [motivoEstorno, setMotivoEstorno] = useState<MotivoEstorno>('pedido_incorreto');
  const [obsEstorno, setObsEstorno] = useState('');
  const [trocaAberta, setTrocaAberta] = useState(false);
  const [pedidosTroca, setPedidosTroca] = useState<PedidoTrocaOpcao[]>([]);
  const [pecasDispTroca, setPecasDispTroca] = useState<PecaTrocaOpcao[]>([]);
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
    const ativos = pag.data.filter((r) =>
      !['cancelado', 'conferido_sem_divergencia', 'conferido_com_divergencia', 'tratativa_administrativa_concluida']
        .includes(r.status));
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
    setDataOperacao(d.dataOperacao ?? d.operacao?.data ?? '');
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

  // Troca de Peça: monta pedidos/peças a partir do lote aberto (não deixa o modal com listas vazias).
  useEffect(() => {
    if (!trocaAberta || !recebimentoId) return;
    let cancelado = false;
    void (async () => {
      const res = await fetch(
        `/api/operacao/pesagem/recebimentos/${recebimentoId}/pecas`,
        { cache: 'no-store' },
      );
      if (!res.ok || cancelado) {
        if (!cancelado) {
          setPedidosTroca([]);
          setPecasDispTroca([]);
        }
        return;
      }
      const pecasLote = (await res.json()) as Peca[];
      if (cancelado) return;

      const toOpcao = (p: Peca): PecaTrocaOpcao => ({
        id: p.id,
        codigo: p.etiquetaAtual ?? p.id.slice(0, 8),
        peso: p.pesoOriginal,
        etiqueta: p.etiquetaAtual,
      });

      setPecasDispTroca(
        pecasLote
          .filter((p) => p.statusPeca === 'pesada' || p.statusPeca === 'em_sobra')
          .map(toOpcao),
      );

      const porItem = new Map<string, PedidoTrocaOpcao>();
      for (const p of pecasLote) {
        if (p.statusPeca !== 'associada' || !p.pedidoVendaItemId || !p.pedidoVendaId) continue;
        const key = p.pedidoVendaItemId;
        let ped = porItem.get(key);
        if (!ped) {
          const itemDet = detalhe?.itens.find((i) => i.itemComercialId === p.itemComercialBaseId);
          const acao = acoes.find((a) => a.etiqueta && a.etiqueta === p.etiquetaAtual);
          const ic = itemDet?.itemComercial;
          ped = {
            pedidoVendaId: p.pedidoVendaId,
            pedidoVendaItemId: key,
            clienteNome: acao?.clientePedido ?? 'Cliente do pedido',
            produtoLabel: ic
              ? `${ic.codigo} — ${ic.descricao}`
              : p.itemComercialBaseId.slice(0, 8),
            pecasAssociadas: [],
          };
          porItem.set(key, ped);
        }
        ped.pecasAssociadas.push(toOpcao(p));
      }
      setPedidosTroca([...porItem.values()]);
    })();
    return () => {
      cancelado = true;
    };
  }, [trocaAberta, recebimentoId, detalhe, acoes]);

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

  const estornarAssociacao = async () => {
    if (!peca || !podeEstornar) return;
    setSubmitting(true);
    setErro(null);
    const res = await fetch(`/api/operacao/pesagem/pecas/${peca.id}/estornar`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        motivo: motivoEstorno,
        ...(motivoEstorno === 'outro' && obsEstorno.trim()
          ? { observacoes: obsEstorno.trim() }
          : {}),
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErro((body as { message?: string }).message ?? 'Não foi possível estornar');
      return;
    }
    setPeca((await res.json()) as Peca);
    setSugestao(null);
    setEstornoAberto(false);
  };

  const pecaAguardandoDestino = peca?.statusPeca === 'pesada';
  const pecaProntaEtiqueta =
    peca &&
    (peca.statusPeca === 'associada' ||
      peca.statusPeca === 'em_sobra' ||
      peca.statusPeca === 'para_corte');

  return (
    <div className="space-y-3">
      <PageHeader
        title="Pesagem & Destinação"
        subtitle="Captura de peso e destino da peça recebida"
        live={statusRt === 'conectado'}
      >
        <div className="flex flex-wrap gap-2" data-testid="status-dispositivos">
          <DeviceBadge label="Balança" online={dispositivos?.balanca.status === 'disponivel'} />
          <DeviceBadge label="Impressora" online={dispositivos?.impressora.status === 'disponivel'} />
          <DeviceBadge label="Leitor" online={dispositivos?.leitor.status === 'disponivel'} />
        </div>
      </PageHeader>

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
        <CardContent className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-3 py-2">
          {detalhe ? (
            <>
              <span className="font-data text-sm font-bold">{detalhe.codigoLote}</span>
              <StatusPill
                variant={statusRecebimentoVariant(detalhe.status)}
                label={STATUS_RECEB_LABEL[detalhe.status]}
              />
              {detalhe.fornecedor?.razaoSocial && (
                <span className="text-xs text-muted-foreground">
                  Fornecedor <b className="font-medium text-foreground">{detalhe.fornecedor.razaoSocial}</b>
                </span>
              )}
              {detalhe.nfeNumero && (
                <span className="text-xs text-muted-foreground">
                  NF{' '}
                  <b className="font-data font-medium text-foreground">
                    {detalhe.nfeNumero}
                    {detalhe.nfeSerie ? `/${detalhe.nfeSerie}` : ''}
                  </b>
                </span>
              )}
              {detalhe.romaneio && (
                <span className="text-xs text-muted-foreground">
                  Romaneio <b className="font-data font-medium text-foreground">{detalhe.romaneio}</b>
                </span>
              )}
              {detalhe.placaVeiculo && (
                <span className="text-xs text-muted-foreground">
                  Placa <b className="font-data font-medium text-foreground">{detalhe.placaVeiculo}</b>
                </span>
              )}
              {detalhe.motorista && (
                <span className="text-xs text-muted-foreground">
                  Motorista <b className="font-medium text-foreground">{detalhe.motorista}</b>
                </span>
              )}
              {detalhe.doca && (
                <span className="text-xs text-muted-foreground">
                  Doca <b className="font-medium text-foreground">{detalhe.doca}</b>
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <span className="text-[11px] text-muted-foreground">Balança</span>
                <ProgressoBalancaBar valor={detalhe.progressoBalanca} />
              </span>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum lote selecionado.</p>
          )}
          <div className="ml-auto">
            {trocarLoteAberto ? (
              <div className="flex items-center gap-2">
                <SelectNative
                  aria-label="Selecione o lote"
                  selectSize="sm"
                  className="w-[280px]"
                  value={recebimentoId}
                  onChange={(e) => trocarLote(e.target.value)}
                >
                  <option value="" disabled>
                    Selecione o lote
                  </option>
                  {recebimentos.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.codigoLote} — {r.fornecedorNome} ({STATUS_RECEB_LABEL[r.status as StatusRecebimento] ?? r.status})
                    </option>
                  ))}
                </SelectNative>
                <Button variant="ghost" size="sm" onClick={() => setTrocarLoteAberto(false)}>
                  Cancelar
                </Button>
              </div>
            ) : (
              <Button variant="secondary" size="sm" onClick={() => setTrocarLoteAberto(true)}>
                <ArrowLeftRight />
                Trocar lote
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Product tabs */}
      {detalhe && detalhe.itens.length > 0 && (
        <Tabs value={itemComercialBaseId} onValueChange={setItemComercialBaseId}>
          <TabsList>
            {detalhe.itens.map((item) => (
              <TabsTrigger key={item.id} value={item.itemComercialId}>
                {labelProduto(item)}
                <BadgeCount>
                  {acoes.filter((a) => a.produtoCodigo === item.itemComercial?.codigo).length}
                </BadgeCount>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}

      {/* 3-column grid */}
      <div className="grid items-start gap-2.5 xl:grid-cols-[340px_1fr_320px]">
        {/* a) Scale panel */}
        <Card>
          <CardHeader>
            <CardTitle>Balança</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            <div className="rounded-lg border border-border bg-surface-2 px-4 pb-3 pt-3.5 text-center">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                Peso atual
              </p>
              <p className="font-data text-[44px] font-bold leading-[1.1] tracking-[-0.03em]">
                {formatPeso(pesoExibido)}
                <span className="ml-1 text-sm font-semibold text-muted-foreground">kg</span>
              </p>
            </div>

            <FormField label="Produto" htmlFor="produto-atual">
              <Input id="produto-atual" readOnly value={itemAtivo ? labelProduto(itemAtivo) : ''} />
            </FormField>

            <FormField
              label={
                <>
                  Características <span className="font-normal normal-case text-fg-faint">(opcional)</span>
                </>
              }
            >
              <div className="flex flex-wrap gap-1.5">
                <FilterChip
                  active={caracteristicas.maisPesada}
                  onClick={() => toggleCaracteristica('maisPesada')}
                >
                  Mais pesada
                </FilterChip>
                <FilterChip
                  active={caracteristicas.maisGorda}
                  onClick={() => toggleCaracteristica('maisGorda')}
                >
                  Mais gorda
                </FilterChip>
                <FilterChip
                  active={caracteristicas.melhorAcabamento}
                  onClick={() => toggleCaracteristica('melhorAcabamento')}
                >
                  Melhor acabamento
                </FilterChip>
              </div>
            </FormField>

            {podePesar && (
              <div className="flex flex-wrap gap-2">
                <Button
                  className="flex-1"
                  onClick={() => pesar('automatico')}
                  disabled={!recebimentoId || !itemComercialBaseId || submitting}
                >
                  <Scale />
                  Capturar Peso
                </Button>
                {podeManual && (
                  <Button
                    variant="secondary"
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
                <FormField label="Peso manual" htmlFor="peso-manual">
                  <Input
                    id="peso-manual"
                    inputMode="decimal"
                    placeholder="0,000"
                    adornRight="kg"
                    value={pesoManual}
                    onChange={(e) => setPesoManual(e.target.value)}
                  />
                </FormField>
                <SelectNative
                  aria-label="Motivo da captura manual"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value as MotivoCapturaManual)}
                >
                  {MOTIVOS_CAPTURA_MANUAL.map((m) => (
                    <option key={m} value={m}>
                      {m.replace(/_/g, ' ')}
                    </option>
                  ))}
                </SelectNative>
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
                  <span className="text-[13px] font-semibold text-foreground">
                    Peça{' '}
                    <span className="font-data text-[11px] text-fg-secondary">
                      {peca.id.slice(0, 8)}…
                    </span>
                  </span>
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
                      variant="secondary"
                      size="sm"
                      onClick={() => destinarSemCobertura('sobra')}
                      disabled={submitting}
                    >
                      → Estoque
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => destinarSemCobertura('corte')}
                      disabled={submitting}
                    >
                      → Desossa
                    </Button>
                  </div>
                )}

                {peca.statusPeca === 'associada' && podeEstornar && (
                  <div className="mt-3">
                    <Button
                      variant="destructiveOutline"
                      size="sm"
                      onClick={() => setEstornoAberto(true)}
                      disabled={submitting}
                    >
                      Cancelar ação realizada
                    </Button>
                  </div>
                )}

                {estornoAberto && (
                  <div className="mt-3 space-y-2 rounded-lg border border-border p-3" role="dialog" aria-label="Cancelar ação realizada">
                    <p className="text-xs font-semibold">Cancelar ação realizada</p>
                    <SelectNative
                      aria-label="Motivo do estorno"
                      value={motivoEstorno}
                      onChange={(e) => setMotivoEstorno(e.target.value as MotivoEstorno)}
                    >
                      {(Object.entries(ROTULOS_MOTIVO_ESTORNO) as [MotivoEstorno, string][]).map(
                        ([slug, rotulo]) => (
                          <option key={slug} value={slug}>{rotulo}</option>
                        ),
                      )}
                    </SelectNative>
                    {motivoEstorno === 'outro' && (
                      <Input
                        placeholder="Observações"
                        value={obsEstorno}
                        onChange={(e) => setObsEstorno(e.target.value)}
                      />
                    )}
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setEstornoAberto(false)}>Voltar</Button>
                      <Button size="sm" onClick={() => void estornarAssociacao()} disabled={submitting}>
                        Confirmar estorno
                      </Button>
                    </div>
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
        <Card>
          <CardHeader>
            <CardTitle>Pedidos compatíveis</CardTitle>
            <CardAction>
              <div className="w-[220px]">
                <Input
                  adornLeft={<Search />}
                  placeholder="Buscar cliente"
                  value={buscaPedido}
                  onChange={(event) => setBuscaPedido(event.target.value)}
                  disabled={!peca || !sugestao}
                  className="h-7 text-xs"
                />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {!peca && (
              <EmptyState
                icon={<Scale />}
                title="Capture o peso para ver pedidos compatíveis"
                description="A lista considera produto, faixa de peso e prioridade do cliente."
                className="py-10"
              />
            )}

            {peca && !sugestao && (
              <EmptyState title="Carregando sugestões…" />
            )}

            {peca && sugestao && compativeisFiltrados.length === 0 && (
              <EmptyState title="Nenhum pedido compatível encontrado." />
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
                        ? 'border-primary-soft-border bg-primary-soft'
                        : 'border-border',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          {principal && (
                            <BadgeCount className="bg-primary-soft text-primary-fg">
                              Sugestão principal
                            </BadgeCount>
                          )}
                          {s.prefCompativel && (
                            <span className="inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                              pref. compatível
                            </span>
                          )}
                        </div>
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
                          variant={principal ? 'default' : 'secondary'}
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
        <Card>
          <CardHeader>
            <CardTitle>Demandas desossa</CardTitle>
            <BadgeCount>{faltas.length}</BadgeCount>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {faltas.length === 0 ? (
              <EmptyState title="Nenhuma demanda de desossa pendente." />
            ) : (
              <>
                <ul className="max-h-[420px] space-y-1.5 overflow-y-auto">
                  {faltas.map((f) => (
                    <li
                      key={f.produto.id}
                      className="flex items-center gap-2.5 rounded-md border border-border px-2.5 py-2 text-xs"
                    >
                      <span className="w-9 shrink-0 font-data text-[13px] font-bold">
                        {f.produto.codigo}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-semibold">{f.produto.nome}</span>
                      <span className="whitespace-nowrap font-data text-[11px] text-muted-foreground">
                        falt. {f.quantidadeFaltante} · est. {f.quantidadeEstoque}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="pt-0.5 text-[11px] text-fg-faint">
                  Origem: {faltas[0]?.origem} · regras provisórias por unidade
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom 2-col */}
      <div className="grid gap-2.5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Acumulado do lote</CardTitle>
            <BadgeCount>{detalhe?.itens.length ?? 0}</BadgeCount>
          </CardHeader>
          <CardContent className="p-0">
            {!detalhe?.itens.length ? (
              <EmptyState title="Sem itens no lote." className="border-none" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
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
                      <TableRow key={item.id} className="group">
                        <TableCell className="max-w-[180px] truncate text-[13px] font-semibold text-foreground">
                          {labelProduto(item)}
                        </TableCell>
                        <TableCellNum>
                          {item.quantidadeEsperada}
                          {item.unidadeEsperada ? ` ${item.unidadeEsperada}` : ''}
                        </TableCellNum>
                        <TableCellNum>
                          {apurado}
                          {item.requerBalanca ? ' kg' : item.unidadeEsperada ? ` ${item.unidadeEsperada}` : ''}
                        </TableCellNum>
                        <TableCellNum>
                          {calcRestante(item.quantidadeEsperada, apurado)}
                        </TableCellNum>
                      </TableRow>
                    );
                  })}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell>
                      {detalhe.itens.length} produto{detalhe.itens.length !== 1 ? 's' : ''}
                    </TableCell>
                    <TableCell colSpan={3} />
                  </TableRow>
                </TableFooter>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ações realizadas</CardTitle>
            <BadgeCount>{acoes.length}</BadgeCount>
          </CardHeader>
          <CardContent className="p-0">
            {acoes.length === 0 ? (
              <EmptyState title="Nenhuma ação registrada neste lote." className="border-none" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
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
                    <TableRow key={a.id} className="group">
                      <TableCellCode>{formatHora(a.hora)}</TableCellCode>
                      <TableCell className="max-w-[120px] truncate">
                        {a.produtoCodigo ?? '—'}
                        {a.produtoDescricao ? ` · ${a.produtoDescricao}` : ''}
                      </TableCell>
                      <TableCellNum>
                        {a.peso ? `${formatPeso(a.peso)} kg` : '—'}
                      </TableCellNum>
                      <TableCell>
                        {a.statusPeca ? (
                          <StatusPill
                            variant={statusPecaVariant(a.statusPeca)}
                            label={a.destino}
                          />
                        ) : (
                          a.destino
                        )}
                      </TableCell>
                      <TableCell className="max-w-[100px] truncate">
                        {a.clientePedido ?? '—'}
                      </TableCell>
                      <TableCellCode className="max-w-[80px] truncate">
                        {a.etiqueta ?? '—'}
                      </TableCellCode>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {podeAssociar && (
        <div className="flex justify-end">
          <Button variant="secondary" size="sm" onClick={() => setTrocaAberta(true)}>
            <ArrowLeftRight />
            Trocar Peça
          </Button>
        </div>
      )}

      <TrocaPecaFluxo
        open={trocaAberta}
        onFechar={() => setTrocaAberta(false)}
        onTrocaConcluida={() => {
          setTrocaAberta(false);
          if (recebimentoId) void refreshLote();
        }}
        pedidos={pedidosTroca}
        pecasDisponiveis={pecasDispTroca}
      />
    </div>
  );
}
