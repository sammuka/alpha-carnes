'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowLeftRight, BarChart3, ClipboardList, Scale, Search, Tag } from 'lucide-react';
import { rotuloProduto } from '@/lib/dominios';
import { extrairMensagemErro, mensagemDeErro } from '@/lib/error-message';
import { mascararPesoKg, pesoKgParaNumero } from '@/lib/masks';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
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

/** Backend já envia `codigoLote` como `Lote NNN` (D11.2). */
function rotuloLote(codigoLote: string, fornecedorNome?: string): string {
  return fornecedorNome ? `${codigoLote} — ${fornecedorNome}` : codigoLote;
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

function formatQtd(val: string | number | null | undefined): string {
  const n = Number(val ?? 0);
  if (Number.isNaN(n)) return '—';
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 3 });
}

function labelProduto(item: RecebimentoItem): string {
  const rotulo = rotuloProduto(item.produto);
  if (rotulo !== '—') return rotulo;
  return item.origemDescricao ?? rotulo;
}

function formatDataOperacao(data: string): string {
  try {
    const [ano, mes, dia] = data.split('-');
    if (ano && mes && dia) return `${dia}/${mes}/${ano}`;
    return data;
  } catch {
    return data;
  }
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
  const [produtoBaseId, setprodutoBaseId] = useState('');
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
  const [destinoLocal, setDestinoLocal] = useState<'estoque' | 'desossa' | null>(null);
  const [pedidoSelecionadoId, setPedidoSelecionadoId] = useState<string | null>(null);
  const [acoesModalAberto, setAcoesModalAberto] = useState(false);
  const [acumuladoModalAberto, setAcumuladoModalAberto] = useState(false);

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
      setErro(extrairMensagemErro(data, 'Falha ao carregar sugestões'));
      return;
    }
    setSugestao(data as ResultadoSugestao);
  }, []);

  const carregarCompativeisLote = useCallback(async (recId: string, produtoId: string) => {
    const qs = new URLSearchParams({ produtoBaseId: produtoId });
    const res = await fetch(
      `/api/operacao/pesagem/recebimentos/${recId}/compativeis?${qs.toString()}`,
      { cache: 'no-store' },
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setSugestao(null);
      setErro(extrairMensagemErro(data, 'Falha ao carregar pedidos compatíveis'));
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
        codigo: p.etiquetaAtual ?? '—',
        peso: p.pesoOriginal,
        etiqueta: p.etiquetaAtual,
        produtoCodigo: detalhe?.itens.find((i) => i.produtoId === p.produtoBaseId)?.produto?.codigo,
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
          const itemDet = detalhe?.itens.find((i) => i.produtoId === p.produtoBaseId);
          const acao = acoes.find((a) => a.etiqueta && a.etiqueta === p.etiquetaAtual);
          const ic = itemDet?.produto;
          ped = {
            pedidoVendaId: p.pedidoVendaId,
            pedidoVendaItemId: key,
            clienteNome: acao?.clientePedido ?? 'Cliente do pedido',
            produtoLabel: ic ? rotuloProduto(ic) : '—',
            produtoCodigo: ic?.codigo ?? undefined,
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
    const atualValido = detalhe.itens.some((i) => i.produtoId === produtoBaseId);
    if (!produtoBaseId || !atualValido) {
      setprodutoBaseId(primeiroItem.produtoId);
    }
  }, [detalhe, produtoBaseId]);

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

  useEffect(() => {
    if (!recebimentoId || !produtoBaseId) return;
    if (peca?.id && peca.produtoBaseId === produtoBaseId) {
      void carregarSugestao(peca.id);
      return;
    }
    void carregarCompativeisLote(recebimentoId, produtoBaseId);
  }, [
    recebimentoId,
    produtoBaseId,
    peca?.id,
    peca?.produtoBaseId,
    carregarSugestao,
    carregarCompativeisLote,
  ]);

  // Nova peça pesada: começa sem nenhuma escolha de destino (radio de pedido ou toggle Estoque/Desossa).
  useEffect(() => {
    setDestinoLocal(null);
    setPedidoSelecionadoId(null);
  }, [peca?.id]);

  // Pré-seleciona a sugestão principal no radio quando a sugestão chega (mesma prioridade de hoje).
  useEffect(() => {
    if (sugestao?.sugestao?.pedidoVendaItemId) {
      setPedidoSelecionadoId(sugestao.sugestao.pedidoVendaItemId);
    }
  }, [sugestao]);

  const escolherDestinoLocal = (valor: 'estoque' | 'desossa') => {
    setDestinoLocal((atual) => (atual === valor ? null : valor));
    setPedidoSelecionadoId(null);
  };

  const escolherPedido = (id: string) => {
    setPedidoSelecionadoId(id);
    setDestinoLocal(null);
  };

  const compativeisFiltrados = useMemo(() => {
    if (!sugestao?.compativeis?.length) return [];
    const q = buscaPedido.trim().toLowerCase();
    if (!q) return sugestao.compativeis;
    return sugestao.compativeis.filter(
      (s) =>
        (s.clienteNome?.toLowerCase().includes(q) ?? false) ||
        s.clienteId.toLowerCase().includes(q) ||
        s.pedidoVendaId.toLowerCase().includes(q) ||
        s.justificativa.toLowerCase().includes(q) ||
        (s.rotaPrevista?.toLowerCase().includes(q) ?? false),
    );
  }, [sugestao, buscaPedido]);

  const pesoExibido = manualAberto
    ? (pesoManual ? String(pesoKgParaNumero(pesoManual)) : null)
    : peca?.pesoOriginal ?? null;
  const balancaIndisponivel = dispositivos?.balanca.status !== 'disponivel';
  const itemAtivo = detalhe?.itens.find((i) => i.produtoId === produtoBaseId);

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
        setErro(extrairMensagemErro(data, 'Falha na operação'));
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
    if (!recebimentoId || !produtoBaseId) return;

    const body =
      modo === 'automatico'
        ? { recebimentoId, produtoBaseId, modoCaptura: 'automatico' }
        : {
            recebimentoId,
            produtoBaseId,
            modoCaptura: 'manual_assistido',
            pesoManual: pesoKgParaNumero(pesoManual),
            motivo,
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

  const confirmarPedido = async (s: SugestaoScored): Promise<Peca | null> => {
    if (!peca) return null;
    const p = await chamar<Peca>(`/api/operacao/pesagem/pecas/${peca.id}/confirmar`, {
      pedidoVendaItemId: s.pedidoVendaItemId,
    });
    if (p) {
      setPeca(p);
      setSugestao(null);
      await refreshLote();
    }
    return p;
  };

  const destinarSemCobertura = async (destino: 'sobra' | 'corte'): Promise<Peca | null> => {
    if (!peca) return null;
    const body: Record<string, unknown> = { destino };
    if (destino === 'sobra') {
      body.motivo = motivoSobra || 'Destinação operacional para estoque';
    }
    const p = await chamar<Peca>(`/api/operacao/pesagem/pecas/${peca.id}/sem-cobertura`, body);
    if (p) {
      setPeca(p);
      setSugestao(null);
      setMotivoSobra('');
      await Promise.all([refreshLote(), carregarFaltas()]);
    }
    return p;
  };

  const emitirEtiqueta = async (pecaAtual?: Peca) => {
    const alvo = pecaAtual ?? peca;
    if (!alvo) return;
    const r = await chamar<{ peca: Peca }>(`/api/operacao/pesagem/pecas/${alvo.id}/etiqueta`);
    if (r) {
      setPeca(r.peca);
      await refreshLote();
    }
  };

  /**
   * Ação única do rodapé: resolve o destino escolhido (pedido via radio OU Estoque/Desossa via
   * toggle — mutuamente exclusivos, ver `escolherDestinoLocal`/`escolherPedido`) e, na sequência,
   * já emite a etiqueta. Reaproveita as mesmas chamadas de API que já existiam (confirmar/
   * sem-cobertura + etiqueta), só que disparadas em 1 clique.
   */
  const confirmarEGerarEtiqueta = async () => {
    if (!peca) return;

    if (peca.statusPeca === 'pesada') {
      let pecaDestinada: Peca | null = null;

      if (pedidoSelecionadoId) {
        const sugestaoEscolhida = sugestao?.compativeis.find(
          (s) => s.pedidoVendaItemId === pedidoSelecionadoId,
        );
        if (!sugestaoEscolhida) return;
        pecaDestinada = await confirmarPedido(sugestaoEscolhida);
      } else if (destinoLocal === 'estoque') {
        pecaDestinada = await destinarSemCobertura('sobra');
      } else if (destinoLocal === 'desossa') {
        pecaDestinada = await destinarSemCobertura('corte');
      } else {
        return;
      }

      if (!pecaDestinada) return;
      await emitirEtiqueta(pecaDestinada);
    } else {
      await emitirEtiqueta();
    }

    setPeca(null);
    setSugestao(null);
    setPesoManual('');
    setManualAberto(false);
    setPedidoSelecionadoId(null);
    setDestinoLocal(null);
  };

  const alternarDigitar = () => {
    setManualAberto((aberto) => {
      if (!aberto) setPesoManual('');
      return !aberto;
    });
  };

  const trocarLote = (id: string) => {
    setRecebimentoId(id);
    setPeca(null);
    setSugestao(null);
    setBuscaPedido('');
    setTrocarLoteAberto(false);
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
      setErro(await mensagemDeErro(res, 'Não foi possível estornar'));
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

  const podeConfirmar = Boolean(
    peca &&
      !peca.etiquetaAtual &&
      ((pecaProntaEtiqueta && podeEtiqueta) ||
        (pecaAguardandoDestino && podeAssociar && (pedidoSelecionadoId || destinoLocal))),
  );

  /**
   * Resumo do lote por destino, calculado no frontend a partir de `acoes` (1 linha por peça
   * pesada no lote — ver GET /operacao/recebimentos/:id/acoes). Buckets usam os mesmos rótulos
   * de `rotuloDestinoPeca` (lib/status-ui.ts); "Outros" agrupa status sem categoria de destino
   * dedicada (análise/divergência/transformação) — não inventa categorias como "Condenação" ou
   * "Ajustes", que não existem no domínio.
   */
  const acumuladoLote = useMemo(() => {
    type BucketKey = 'associada' | 'em_sobra' | 'para_corte' | 'pesada' | 'outros';
    const buckets: Record<BucketKey, { label: string; peso: number; qtd: number }> = {
      associada: { label: 'Pedido', peso: 0, qtd: 0 },
      em_sobra: { label: 'Estoque', peso: 0, qtd: 0 },
      para_corte: { label: 'Desossa', peso: 0, qtd: 0 },
      pesada: { label: 'Pendente', peso: 0, qtd: 0 },
      outros: { label: 'Outros', peso: 0, qtd: 0 },
    };
    const chaveDoStatus = (status: string | null): BucketKey =>
      status && status in buckets ? (status as BucketKey) : 'outros';
    let pesoTotal = 0;
    for (const a of acoes) {
      const peso = Number(a.peso ?? 0);
      const pesoValido = Number.isNaN(peso) ? 0 : peso;
      pesoTotal += pesoValido;
      const bucket = buckets[chaveDoStatus(a.statusPeca)];
      bucket.peso += pesoValido;
      bucket.qtd += 1;
    }
    const pecasTotais = acoes.length;
    const pendentes = buckets.pesada.qtd;
    const destinadas = pecasTotais - pendentes;
    return {
      pesoTotal,
      pecasTotais,
      destinadas,
      pendentes,
      percDestinadas: pecasTotais > 0 ? Math.round((destinadas / pecasTotais) * 100) : 0,
      percPendentes: pecasTotais > 0 ? Math.round((pendentes / pecasTotais) * 100) : 0,
      buckets: Object.values(buckets).filter((b) => b.qtd > 0),
    };
  }, [acoes]);

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
              <span className="font-data text-sm font-bold">{rotuloLote(detalhe.codigoLote)}</span>
              <StatusPill
                variant={statusRecebimentoVariant(detalhe.status)}
                label={STATUS_RECEB_LABEL[detalhe.status]}
              />
              {dataOperacao && (
                <span className="text-xs text-muted-foreground">
                  Operação{' '}
                  <b className="font-data font-medium text-foreground">
                    {formatDataOperacao(dataOperacao)}
                  </b>
                </span>
              )}
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
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setAcoesModalAberto(true)}>
              <ClipboardList />
              Ver ações realizadas
              <BadgeCount>{acoes.length}</BadgeCount>
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setAcumuladoModalAberto(true)}>
              <BarChart3 />
              Ver acumulado do lote
            </Button>
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
                      {rotuloLote(r.codigoLote, r.fornecedorNome)} ({STATUS_RECEB_LABEL[r.status as StatusRecebimento] ?? r.status})
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
        <Tabs value={produtoBaseId} onValueChange={setprodutoBaseId}>
          <TabsList>
            {detalhe.itens.map((item) => (
              <TabsTrigger key={item.id} value={item.produtoId}>
                {labelProduto(item)}
                <BadgeCount>
                  {acoes.filter((a) => a.produtoCodigo === item.produto?.codigo).length}
                </BadgeCount>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}

      {/* 2-column grid */}
      <div className="grid items-start gap-2.5 xl:grid-cols-[340px_1fr]">
        {/* Left column: Balança + Demandas desossa */}
        <div className="space-y-2.5">
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

            {podePesar && (
              <div className="flex flex-wrap gap-2">
                <Button
                  className="flex-1"
                  onClick={() => {
                    if (manualAberto) setManualAberto(false);
                    void pesar('automatico');
                  }}
                  disabled={!recebimentoId || !produtoBaseId || submitting}
                >
                  <Scale />
                  Capturar Peso
                </Button>
                {podeManual && (
                  <Button
                    variant={manualAberto ? 'default' : 'secondary'}
                    aria-pressed={manualAberto}
                    onClick={alternarDigitar}
                    disabled={submitting}
                  >
                    Digitar
                  </Button>
                )}
              </div>
            )}

            {podeAssociar && (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={destinoLocal === 'estoque' ? 'default' : 'secondary'}
                  size="sm"
                  className="flex-1"
                  aria-pressed={destinoLocal === 'estoque'}
                  data-testid="btn-destino-estoque"
                  onClick={() => escolherDestinoLocal('estoque')}
                  disabled={!pecaAguardandoDestino || submitting}
                >
                  → Estoque
                </Button>
                <Button
                  variant={destinoLocal === 'desossa' ? 'default' : 'secondary'}
                  size="sm"
                  className="flex-1"
                  aria-pressed={destinoLocal === 'desossa'}
                  data-testid="btn-destino-desossa"
                  onClick={() => escolherDestinoLocal('desossa')}
                  disabled={!pecaAguardandoDestino || submitting}
                >
                  → Desossa
                </Button>
              </div>
            )}

            {destinoLocal === 'estoque' && (
              <Input
                placeholder="Motivo (estoque)"
                value={motivoSobra}
                onChange={(e) => setMotivoSobra(e.target.value)}
              />
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
                    onChange={(e) => setPesoManual(mascararPesoKg(e.target.value))}
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
                      {peca.etiquetaAtual ?? '—'}
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
              </div>
            )}
          </CardContent>
        </Card>

        {/* Demandas desossa — abaixo da Balança, formato compacto */}
        <Card>
          <CardHeader>
            <CardTitle>Demandas desossa</CardTitle>
            <BadgeCount>{faltas.length}</BadgeCount>
          </CardHeader>
          <CardContent className="p-0">
            {faltas.length === 0 ? (
              <EmptyState title="Nenhuma demanda de desossa pendente." className="border-none" />
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Item</TableHead>
                      <TableHead className="text-right">Qtde solic.</TableHead>
                      <TableHead className="text-right">Qtde assoc.</TableHead>
                      <TableHead className="text-right">Faltante</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {faltas.map((f) => {
                      const solicitada = f.quantidadeFaltante + f.quantidadeEstoque;
                      return (
                        <TableRow key={f.produto.id}>
                          <TableCell className="max-w-[130px] truncate text-[13px] font-semibold text-foreground">
                            {f.produto.codigo}
                          </TableCell>
                          <TableCellNum>{solicitada} un</TableCellNum>
                          <TableCellNum>{f.quantidadeEstoque} un</TableCellNum>
                          <TableCellNum className="text-destructive">{f.quantidadeFaltante} un</TableCellNum>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                <p className="px-2.5 py-1.5 text-[11px] text-fg-faint">
                  Origem: {faltas[0]?.origem} · regras provisórias por unidade
                </p>
              </>
            )}
          </CardContent>
        </Card>
        </div>

        {/* b) Compatible orders — coluna principal */}
        <div className="space-y-2.5">
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
                  disabled={!sugestao}
                  className="h-7 text-xs"
                />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {!sugestao && (
              <EmptyState title="Carregando sugestões…" />
            )}

            {sugestao && compativeisFiltrados.length === 0 && (
              <EmptyState title="Nenhum pedido compatível encontrado." />
            )}

            {sugestao && compativeisFiltrados.length > 0 && (
              <>
                {destinoLocal && (
                  <p className="rounded-md border border-border bg-surface-2 px-2.5 py-1.5 text-xs text-muted-foreground">
                    Destino {destinoLocal === 'estoque' ? 'Estoque' : 'Desossa'} selecionado — desmarque para vincular a um pedido.
                  </p>
                )}
                <RadioGroup
                  className="contents"
                  value={pedidoSelecionadoId ?? undefined}
                  onValueChange={escolherPedido}
                  disabled={!podeAssociar || !pecaAguardandoDestino || destinoLocal !== null || submitting}
                >
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="w-8" />
                        <TableHead>Cliente</TableHead>
                        <TableHead>Pedido</TableHead>
                        <TableHead>Item</TableHead>
                        <TableHead className="text-right">Qtde solicitada</TableHead>
                        <TableHead className="text-right">Qtde associada</TableHead>
                        <TableHead className="text-right">Qtde faltante</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {compativeisFiltrados.map((s) => {
                        const principal = sugestao?.sugestao?.pedidoVendaItemId === s.pedidoVendaItemId;
                        const selecionado = pedidoSelecionadoId === s.pedidoVendaItemId;
                        return (
                          <TableRow
                            key={s.pedidoVendaItemId}
                            data-state={selecionado ? 'selected' : undefined}
                          >
                            <TableCell>
                              <RadioGroupItem
                                value={s.pedidoVendaItemId}
                                id={`pedido-${s.pedidoVendaItemId}`}
                              />
                            </TableCell>
                            <TableCell>
                              <label htmlFor={`pedido-${s.pedidoVendaItemId}`} className="flex cursor-pointer flex-wrap items-center gap-1.5">
                                <span className="font-medium">{s.clienteNome ?? '—'}</span>
                                {principal && (
                                  <BadgeCount className="bg-primary-soft text-primary-fg">
                                    Sugestão
                                  </BadgeCount>
                                )}
                                {s.prefCompativel && (
                                  <span className="inline-block rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-700">
                                    pref. compatível
                                  </span>
                                )}
                              </label>
                            </TableCell>
                            <TableCellCode>{s.pedidoVendaId.slice(0, 8)}</TableCellCode>
                            <TableCell className="max-w-[140px] truncate">
                              {itemAtivo ? labelProduto(itemAtivo) : '—'}
                            </TableCell>
                            <TableCellNum>{formatQtd(s.quantidadePedida)}</TableCellNum>
                            <TableCellNum>{formatQtd(s.quantidadeAtendida)}</TableCellNum>
                            <TableCellNum className="text-destructive">{formatQtd(s.saldoPendente)}</TableCellNum>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </RadioGroup>
              </>
            )}
          </CardContent>
        </Card>
        <div className="flex flex-wrap gap-2">
          <Button
            size="lg"
            className="h-auto min-w-0 flex-1 flex-col items-start justify-center gap-0.5 py-2.5 text-left"
            onClick={() => void confirmarEGerarEtiqueta()}
            disabled={!podeConfirmar || submitting}
          >
            <span className="flex items-center gap-1.5 text-[13px] font-semibold">
              <Tag className="size-4" />
              {peca?.etiquetaAtual ? `Etiqueta: ${peca.etiquetaAtual}` : 'Confirmar e gerar etiqueta'}
            </span>
            {!peca?.etiquetaAtual && (
              <span className="text-[11px] font-normal text-primary-foreground/80">
                Finaliza a pesagem e associa a peça
              </span>
            )}
          </Button>
          {podeAssociar && (
            <Button variant="secondary" size="lg" onClick={() => setTrocaAberta(true)}>
              <ArrowLeftRight />
              Trocar Peça
            </Button>
          )}
        </div>
        </div>
      </div>

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

      {acoesModalAberto && (
        <Dialog open onOpenChange={(open) => !open && setAcoesModalAberto(false)}>
          <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                Ações realizadas
                <BadgeCount>{acoes.length}</BadgeCount>
              </DialogTitle>
            </DialogHeader>
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
          </DialogContent>
        </Dialog>
      )}

      {acumuladoModalAberto && (
        <Dialog open onOpenChange={(open) => !open && setAcumuladoModalAberto(false)}>
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>Acumulado do lote</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                <div className="rounded-lg border border-border bg-surface-2 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Peso total</p>
                  <p className="font-data text-lg font-bold">{formatPeso(String(acumuladoLote.pesoTotal))} kg</p>
                </div>
                <div className="rounded-lg border border-border bg-surface-2 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Peças totais</p>
                  <p className="font-data text-lg font-bold">{acumuladoLote.pecasTotais} un</p>
                </div>
                <div className="rounded-lg border border-border bg-surface-2 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Destinadas</p>
                  <p className="font-data text-lg font-bold">
                    {acumuladoLote.destinadas} un
                    <span className="ml-1 text-xs font-normal text-muted-foreground">
                      ({acumuladoLote.percDestinadas}%)
                    </span>
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-surface-2 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Pendentes</p>
                  <p className="font-data text-lg font-bold text-[var(--color-status-divergencia)]">
                    {acumuladoLote.pendentes} un
                    <span className="ml-1 text-xs font-normal text-muted-foreground">
                      ({acumuladoLote.percPendentes}%)
                    </span>
                  </p>
                </div>
              </div>

              {acumuladoLote.buckets.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Destino</TableHead>
                      <TableHead className="text-right">Peso (kg)</TableHead>
                      <TableHead className="text-right">Qtd. peças</TableHead>
                      <TableHead>% do total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {acumuladoLote.buckets.map((b) => {
                      const pct = acumuladoLote.pesoTotal > 0
                        ? Math.round((b.peso / acumuladoLote.pesoTotal) * 100)
                        : 0;
                      return (
                        <TableRow key={b.label}>
                          <TableCell className="font-semibold">{b.label}</TableCell>
                          <TableCellNum>{formatPeso(String(b.peso))}</TableCellNum>
                          <TableCellNum>{b.qtd}</TableCellNum>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress value={pct} className="h-1.5 w-24" />
                              <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">{pct}%</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell>Total</TableCell>
                      <TableCellNum>{formatPeso(String(acumuladoLote.pesoTotal))}</TableCellNum>
                      <TableCellNum>{acumuladoLote.pecasTotais}</TableCellNum>
                      <TableCell>100%</TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              )}

              <div>
                <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">Por produto</p>
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
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
