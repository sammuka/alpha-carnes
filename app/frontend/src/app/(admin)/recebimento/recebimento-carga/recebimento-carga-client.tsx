'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Package,
  PauseCircle,
  Plus,
  RefreshCw,
  Scale,
  Search,
  XCircle,
} from 'lucide-react';
import { conectarRealtime, type RealtimeMensagem } from '@/lib/realtime';
import {
  TIPOS_DIVERGENCIA,
  type IniciarRecebimentoPayload,
  type PedidoFornecedorResumoRecebivel,
  type PaginadoRecebimento,
  type PrevisaoRecebimento,
  type QuadroConferenciaItem,
  type RecebimentoDetalhe,
  type RecebimentoItem,
  type RecebimentoResumoEnriquecido,
  type StatusRecebimento,
  type TipoDivergencia,
} from '@/lib/operacao';
import { statusApuracaoVariant, statusRecebimentoVariant } from '@/lib/status-ui';
import { ProgressoBalancaBar } from '@/components/recebimento/progresso-balanca-bar';
import { QuadroComparativo } from '@/components/gestao/quadro-comparativo';
import { Badge } from '@/components/ui/badge';
import { BadgeCount } from '@/components/ui/badge-count';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ComboboxField } from '@/components/ui/combobox-field';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { SelectNative } from '@/components/ui/select-native';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { StatusPill } from '@/components/ui/status-pill';
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
import { Textarea } from '@/components/ui/textarea';
import type { Paginado } from '@/lib/comercial';

/** 7 rótulos do protótipo (RecebimentoCarga.tsx StatusLote) + aguardando_conclusao_pesagem. */
export const STATUS_RECEB_LABEL: Record<StatusRecebimento, string> = {
  pesagem_em_andamento: 'Pesagem em andamento',
  aguardando_conclusao_pesagem: 'Pesagem em andamento',
  aguardando_conferencia_final: 'Aguardando conferência final',
  conferido_sem_divergencia: 'Conferido sem divergência',
  conferido_com_divergencia: 'Conferido com divergência',
  ocorrencia_administrativa_aberta: 'Ocorrência administrativa aberta',
  tratativa_administrativa_concluida: 'Tratativa concluída',
  cancelado: 'Cancelado',
};

const STATUS_ABERTOS: StatusRecebimento[] = [
  'pesagem_em_andamento',
  'aguardando_conclusao_pesagem',
  'aguardando_conferencia_final',
];

const STATUS_ENCERRADOS: StatusRecebimento[] = [
  'conferido_sem_divergencia',
  'conferido_com_divergencia',
  'tratativa_administrativa_concluida',
  'cancelado',
];

const STATUS_ITEM_LABEL: Record<string, string> = {
  aguardando: 'Aguardando',
  em_conferencia: 'Em conferência',
  conferido: 'Conferido',
  divergente: 'Divergente',
  entrada_direta: 'Entrada direta',
};

const LABEL_TIPO_DIVERGENCIA: Record<TipoDivergencia, string> = {
  quantidade_menor: 'Quantidade menor',
  quantidade_maior: 'Quantidade maior',
  item_divergente: 'Item divergente',
  qualidade_divergente: 'Qualidade divergente',
  peso_incompativel: 'Peso incompatível',
  item_ausente: 'Item ausente',
  item_excedente: 'Item excedente',
  inconsistencia_nf_fisico: 'Inconsistência NF x físico',
};

interface FormNfe {
  nfeNumero: string;
  nfeSerie: string;
  nfeChave: string;
  nfeDataEmissao: string;
  romaneio: string;
  nfePesoBruto: string;
  nfePesoLiquido: string;
  nfeVolumes: string;
  observacoes: string;
  placaVeiculo: string;
  motorista: string;
  doca: string;
}

interface FormMetadados {
  placaVeiculo: string;
  motorista: string;
  doca: string;
  observacoes: string;
}

interface FormDivergencia {
  tipo: TipoDivergencia | '';
  descricao: string;
  acaoImediata: string;
}

const formNfeVazio = (): FormNfe => ({
  nfeNumero: '',
  nfeSerie: '',
  nfeChave: '',
  nfeDataEmissao: '',
  romaneio: '',
  nfePesoBruto: '',
  nfePesoLiquido: '',
  nfeVolumes: '',
  observacoes: '',
  placaVeiculo: '',
  motorista: '',
  doca: '',
});

const formMetadadosVazio = (): FormMetadados => ({
  placaVeiculo: '',
  motorista: '',
  doca: '',
  observacoes: '',
});

const formDivergenciaVazio = (): FormDivergencia => ({
  tipo: '',
  descricao: '',
  acaoImediata: '',
});

function formatDataHora(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

function qtdApuradaItem(item: RecebimentoItem): number {
  if (item.statusApuracao === 'entrada_direta') return Number(item.quantidadeRecebida);
  return Number(item.quantidadeApurada ?? item.quantidadeRecebida ?? 0);
}

function calcDifQtd(item: RecebimentoItem): string {
  if (item.statusApuracao === 'entrada_direta') return '—';
  const esperada = Number(item.quantidadeEsperada);
  const apurada = qtdApuradaItem(item);
  if (Number.isNaN(esperada) || Number.isNaN(apurada)) return '—';
  const diff = apurada - esperada;
  if (diff === 0) return '0';
  const fmt = diff.toLocaleString('pt-BR', { maximumFractionDigits: 3 });
  return diff > 0 ? `+${fmt}` : fmt;
}

function calcDifPeso(_item: RecebimentoItem): string {
  // Peso previsto por item não está no modelo atual — diferença indisponível.
  return '—';
}

function labelProdutoItem(item: RecebimentoItem): string {
  if (item.itemComercial) {
    return `${item.itemComercial.codigo}${item.itemComercial.descricao ? ` — ${item.itemComercial.descricao}` : ''}`;
  }
  return item.itemComercialId.slice(0, 8);
}

export function RecebimentoCargaClient({ permissoes }: { permissoes: string[] }) {
  const router = useRouter();
  const podeLer = permissoes.includes('RECEBIMENTO_LER');
  const podeGerenciar = permissoes.includes('RECEBIMENTO_GERENCIAR');

  const [lista, setLista] = useState<RecebimentoResumoEnriquecido[]>([]);
  const [pedidosRecebiveis, setPedidosRecebiveis] = useState<PedidoFornecedorResumoRecebivel[]>([]);
  const [carregandoPedidos, setCarregandoPedidos] = useState(false);
  const [busca, setBusca] = useState('');
  const [sheetAberto, setSheetAberto] = useState(false);
  const [sheetNfeAberto, setSheetNfeAberto] = useState(false);
  const [pedidoFornecedorId, setPedidoFornecedorId] = useState('');
  const [previsao, setPrevisao] = useState<PrevisaoRecebimento | null>(null);
  const [formNfe, setFormNfe] = useState<FormNfe>(formNfeVazio);
  const [formMetadados, setFormMetadados] = useState<FormMetadados>(formMetadadosVazio);
  const [salvando, setSalvando] = useState(false);

  const [recebimentoId, setRecebimentoId] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<RecebimentoDetalhe | null>(null);
  const [itemSelecionadoId, setItemSelecionadoId] = useState<string | null>(null);
  const [dialogDivergenciaAberto, setDialogDivergenciaAberto] = useState(false);
  const [dialogConferenciaAberto, setDialogConferenciaAberto] = useState(false);
  const [formDivergencia, setFormDivergencia] = useState<FormDivergencia>(formDivergenciaVazio);
  const [quadro, setQuadro] = useState<QuadroConferenciaItem[]>([]);
  const [obsConferencia, setObsConferencia] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [status, setStatus] = useState<'conectado' | 'desconectado'>('desconectado');

  const itemSelecionado = useMemo(
    () => detalhe?.itens.find((i) => i.id === itemSelecionadoId) ?? null,
    [detalhe, itemSelecionadoId],
  );

  const resumoFinalizarDivergencias = useMemo(() => {
    if (!detalhe) return [];
    const abertas = detalhe.divergencias.filter((d) => d.status !== 'resolvida');
    return detalhe.itens
      .filter((item) => item.statusApuracao === 'divergente')
      .map((item) => {
        const divs = abertas.filter((d) => d.recebimentoItemId === item.id);
        return divs.length > 0 ? { item, divergencias: divs } : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [detalhe]);

  const carregarLista = useCallback(async () => {
    if (!podeLer) return;
    const res = await fetch('/api/operacao/recebimentos?pageSize=50', { cache: 'no-store' });
    if (res.ok) {
      const pag = (await res.json()) as PaginadoRecebimento;
      setLista(pag.data);
    }
  }, [podeLer]);

  const carregarPedidosRecebiveis = useCallback(async () => {
    setCarregandoPedidos(true);
    const res = await fetch(
      '/api/operacao/pedidos-fornecedor?elegiveisRecebimento=true&pagina=1&limite=100',
      { cache: 'no-store' },
    );
    const body = await res.json().catch(() => ({}));
    setCarregandoPedidos(false);
    if (!res.ok) {
      setPedidosRecebiveis([]);
      setErro((body as { message?: string }).message ?? 'Erro ao carregar Pedidos ao Fornecedor');
      return;
    }
    setPedidosRecebiveis((body as Paginado<PedidoFornecedorResumoRecebivel>).data);
  }, []);

  const carregarPrevisao = useCallback(async (id: string) => {
    setErro(null);
    setPrevisao(null);
    const res = await fetch(`/api/operacao/recebimentos/previsao/${id}`, { cache: 'no-store' });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErro((body as { message?: string }).message ?? 'Erro ao carregar previsão');
      return;
    }
    setPrevisao(body as PrevisaoRecebimento);
  }, []);

  const carregarQuadro = useCallback(async (id: string) => {
    const res = await fetch(`/api/operacao/recebimentos/${id}/conferencia`, { cache: 'no-store' });
    if (!res.ok) {
      setQuadro([]);
      return;
    }
    setQuadro((await res.json()) as QuadroConferenciaItem[]);
  }, []);

  const carregarDetalhe = useCallback(async (id: string) => {
    setErro(null);
    const res = await fetch(`/api/operacao/recebimentos/${id}`, { cache: 'no-store' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErro((body as { message?: string }).message ?? 'Erro ao carregar recebimento');
      return;
    }
    const d = (await res.json()) as RecebimentoDetalhe;
    setDetalhe(d);
    setRecebimentoId(id);
    setItemSelecionadoId(null);
    setFormNfe({
      nfeNumero: d.nfeNumero ?? '',
      nfeSerie: d.nfeSerie ?? '',
      nfeChave: d.nfeChave ?? '',
      nfeDataEmissao: d.nfeDataEmissao ?? '',
      romaneio: d.romaneio ?? '',
      nfePesoBruto: d.nfePesoBruto ?? '',
      nfePesoLiquido: d.nfePesoLiquido ?? '',
      nfeVolumes: String(d.nfeVolumes ?? ''),
      observacoes: d.observacoes ?? '',
      placaVeiculo: d.placaVeiculo ?? '',
      motorista: d.motorista ?? '',
      doca: d.doca ?? '',
    });
    setFormMetadados({
      placaVeiculo: d.placaVeiculo ?? '',
      motorista: d.motorista ?? '',
      doca: d.doca ?? '',
      observacoes: d.observacoes ?? '',
    });
    void carregarQuadro(id);
  }, [carregarQuadro]);

  useEffect(() => {
    void carregarLista();
    void carregarPedidosRecebiveis();
  }, [carregarLista, carregarPedidosRecebiveis]);

  // Deep-link E2E / atalhos: ?recebimentoId=<uuid> abre o detalhe direto.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('recebimentoId');
    if (id) void carregarDetalhe(id);
  }, [carregarDetalhe]);

  useEffect(() => {
    if (pedidoFornecedorId) void carregarPrevisao(pedidoFornecedorId);
    else setPrevisao(null);
  }, [pedidoFornecedorId, carregarPrevisao]);

  useEffect(() => {
    if (!detalhe) return;
    const onMessage = (msg: RealtimeMensagem) => {
      if (
        msg.type === 'recebimento_iniciado' ||
        msg.type === 'recebimento_registrado' ||
        msg.type === 'divergencia_recebimento_aberta' ||
        msg.type === 'divergencia_recebimento_atualizada'
      ) {
        if (recebimentoId) void carregarDetalhe(recebimentoId);
        void carregarLista();
      }
    };
    const dataOperacao = detalhe.dataOperacao ?? detalhe.operacao?.data;
    const desconectar = conectarRealtime({
      rooms: dataOperacao
        ? ['dashboard', `operacao:${dataOperacao}`]
        : ['dashboard'],
      onMessage,
      onReconnect: () => {
        if (recebimentoId) void carregarDetalhe(recebimentoId);
        void carregarLista();
      },
      onStatus: setStatus,
    });
    return desconectar;
  }, [detalhe, recebimentoId, carregarDetalhe, carregarLista]);

  const listaFiltrada = lista.filter((r) => {
    if (!busca) return true;
    const q = busca.toLowerCase();
    return (
      r.codigoLote.toLowerCase().includes(q) ||
      (r.numeroInternoCompra?.toLowerCase().includes(q) ?? false) ||
      r.fornecedorNome.toLowerCase().includes(q) ||
      (r.nfeNumero?.toLowerCase().includes(q) ?? false) ||
      (r.romaneio?.toLowerCase().includes(q) ?? false)
    );
  });

  const montarPayload = (): IniciarRecebimentoPayload | null => {
    if (!pedidoFornecedorId || !formNfe.nfeNumero.trim()) return null;
    const payload: IniciarRecebimentoPayload = {
      pedidoFornecedorId,
      nfeNumero: formNfe.nfeNumero.trim(),
    };
    if (formNfe.nfeSerie) payload.nfeSerie = formNfe.nfeSerie.trim();
    if (formNfe.nfeChave) payload.nfeChave = formNfe.nfeChave.trim();
    if (formNfe.nfeDataEmissao) payload.nfeDataEmissao = formNfe.nfeDataEmissao;
    if (formNfe.romaneio) payload.romaneio = formNfe.romaneio.trim();
    if (formNfe.nfePesoBruto) payload.nfePesoBruto = Number(formNfe.nfePesoBruto);
    if (formNfe.nfePesoLiquido) payload.nfePesoLiquido = Number(formNfe.nfePesoLiquido);
    if (formNfe.nfeVolumes) payload.nfeVolumes = Number(formNfe.nfeVolumes);
    if (formNfe.observacoes) payload.observacoes = formNfe.observacoes.trim();
    if (formNfe.placaVeiculo) payload.placaVeiculo = formNfe.placaVeiculo.trim();
    if (formNfe.motorista) payload.motorista = formNfe.motorista.trim();
    if (formNfe.doca) payload.doca = formNfe.doca.trim();
    return payload;
  };

  const criarLote = async (irParaBalanca: boolean) => {
    if (!podeGerenciar) return;
    const payload = montarPayload();
    if (!payload || !previsao || previsao.itensOperacionais.length === 0) {
      setErro('Informe o Pedido ao Fornecedor, NF-e e confirme que há itens previstos.');
      return;
    }
    setSalvando(true);
    setErro(null);
    const res = await fetch('/api/operacao/recebimentos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    setSalvando(false);
    if (!res.ok) {
      setErro((body as { message?: string }).message ?? 'Erro ao criar lote');
      return;
    }
    const rec = (body as { recebimento: { id: string } }).recebimento;
    setSheetAberto(false);
    setPedidoFornecedorId('');
    setPrevisao(null);
    setFormNfe(formNfeVazio());
    await carregarLista();
    if (irParaBalanca) {
      router.push(`/recebimento/pesagem-destinacao?recebimentoId=${rec.id}`);
    } else {
      await carregarDetalhe(rec.id);
    }
  };

  const salvarNfe = async () => {
    if (!recebimentoId || !podeGerenciar) return;
    setSalvando(true);
    setErro(null);
    const res = await fetch(`/api/operacao/recebimentos/${recebimentoId}/nfe`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nfeNumero: formNfe.nfeNumero.trim(),
        nfeSerie: formNfe.nfeSerie || undefined,
        nfeChave: formNfe.nfeChave || undefined,
        nfeDataEmissao: formNfe.nfeDataEmissao || undefined,
        romaneio: formNfe.romaneio || undefined,
        nfePesoBruto: formNfe.nfePesoBruto ? Number(formNfe.nfePesoBruto) : undefined,
        nfePesoLiquido: formNfe.nfePesoLiquido ? Number(formNfe.nfePesoLiquido) : undefined,
        nfeVolumes: formNfe.nfeVolumes ? Number(formNfe.nfeVolumes) : undefined,
        observacoes: formNfe.observacoes || undefined,
      }),
    });
    const body = await res.json().catch(() => ({}));
    setSalvando(false);
    if (!res.ok) {
      setErro((body as { message?: string }).message ?? 'Erro ao atualizar NF');
      return;
    }
    setSheetNfeAberto(false);
    await carregarDetalhe(recebimentoId);
    await carregarLista();
  };

  const salvarMetadados = async () => {
    if (!recebimentoId || !podeGerenciar) return;
    setSalvando(true);
    setErro(null);
    const res = await fetch(`/api/operacao/recebimentos/${recebimentoId}/metadados`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        placaVeiculo: formMetadados.placaVeiculo.trim() || undefined,
        motorista: formMetadados.motorista.trim() || undefined,
        doca: formMetadados.doca.trim() || undefined,
        observacoes: formMetadados.observacoes.trim() || undefined,
      }),
    });
    const body = await res.json().catch(() => ({}));
    setSalvando(false);
    if (!res.ok) {
      setErro((body as { message?: string }).message ?? 'Erro ao salvar metadados');
      return;
    }
    await carregarDetalhe(recebimentoId);
    await carregarLista();
  };

  const abrirDialogDivergencia = () => {
    if (!itemSelecionado) return;
    setFormDivergencia(formDivergenciaVazio());
    setDialogDivergenciaAberto(true);
  };

  const registrarDivergencia = async () => {
    if (!recebimentoId || !podeGerenciar || !itemSelecionado || !formDivergencia.tipo) return;
    if (!formDivergencia.descricao.trim() || !formDivergencia.acaoImediata.trim()) {
      setErro('Preencha descrição e ação imediata da divergência.');
      return;
    }
    setSalvando(true);
    setErro(null);
    const res = await fetch(`/api/operacao/recebimentos/${recebimentoId}/itens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        itemComercialId: itemSelecionado.itemComercialId,
        quantidadeRecebida: qtdApuradaItem(itemSelecionado),
        divergencia: {
          tipo: formDivergencia.tipo,
          descricao: formDivergencia.descricao.trim(),
          acaoImediata: formDivergencia.acaoImediata.trim(),
        },
      }),
    });
    const body = await res.json().catch(() => ({}));
    setSalvando(false);
    if (!res.ok) {
      setErro((body as { message?: string }).message ?? 'Erro ao registrar divergência');
      return;
    }
    setDialogDivergenciaAberto(false);
    setFormDivergencia(formDivergenciaVazio());
    await carregarDetalhe(recebimentoId);
    await carregarLista();
  };

  const capturarItensNf = async () => {
    if (!detalhe?.pedidoFornecedorId || !podeGerenciar) return;
    if (!detalhe.nfeNumero) {
      setErro('Informe o número da NF-e antes de capturar os itens.');
      return;
    }
    setSalvando(true);
    setErro(null);
    const itens = detalhe.itens.map((item) => ({
      itemComercialId: item.itemComercialId,
      quantidadeDeclarada: Number(item.quantidadeEsperada),
      ...(item.pesoTotalApurado ? { pesoDeclarado: Number(item.pesoTotalApurado) } : {}),
    }));
    const res = await fetch(`/api/operacao/pedidos-fornecedor/${detalhe.pedidoFornecedorId}/nf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        numero: detalhe.nfeNumero,
        serie: detalhe.nfeSerie ?? undefined,
        chave: detalhe.nfeChave ?? undefined,
        dataEmissao: detalhe.nfeDataEmissao ?? undefined,
        pesoTotalDeclarado: detalhe.nfePesoBruto ? Number(detalhe.nfePesoBruto) : undefined,
        recebimentoId: detalhe.id,
        confirmarSubstituicaoCabecalho: true,
        itens,
      }),
    });
    const body = await res.json().catch(() => ({}));
    setSalvando(false);
    if (!res.ok) {
      setErro((body as { message?: string }).message ?? 'Erro ao capturar itens da NF');
      return;
    }
    await carregarDetalhe(detalhe.id);
    await carregarLista();
  };

  const executarConcluirConferencia = async () => {
    if (!recebimentoId || !podeGerenciar) return;
    setSalvando(true);
    setErro(null);
    const temDivergencia = quadro.some((q) => q.situacao === 'divergente');
    const res = await fetch(`/api/operacao/recebimentos/${recebimentoId}/conferencia/concluir`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resultado: temDivergencia ? 'com_divergencia' : 'sem_divergencia',
        ...(obsConferencia.trim() ? { observacao: obsConferencia.trim() } : {}),
      }),
    });
    const body = await res.json().catch(() => ({}));
    setSalvando(false);
    if (!res.ok) {
      setErro((body as { message?: string }).message ?? 'Erro ao concluir a conferência');
      return;
    }
    setDialogConferenciaAberto(false);
    await carregarDetalhe(recebimentoId);
    await carregarLista();
  };

  const solicitarFinalizar = () => {
    if (!podeGerenciar || !detalhe) return;
    setObsConferencia('');
    void carregarQuadro(detalhe.id).then(() => setDialogConferenciaAberto(true));
  };

  const suspenderRecebimento = async () => {
    if (!recebimentoId || !podeGerenciar) return;
    setSalvando(true);
    setErro(null);
    const res = await fetch(`/api/operacao/recebimentos/${recebimentoId}/suspender`, { method: 'POST' });
    const body = await res.json().catch(() => ({}));
    setSalvando(false);
    if (!res.ok) {
      setErro((body as { message?: string }).message ?? 'Erro ao suspender recebimento');
      return;
    }
    await carregarDetalhe(recebimentoId);
    await carregarLista();
  };

  const cancelarLote = async () => {
    if (!recebimentoId || !podeGerenciar || !detalhe) return;
    if (detalhe.progressoBalanca > 0) {
      setErro('Não é possível cancelar lote com pesagem registrada.');
      return;
    }
    if (!window.confirm('Confirma o cancelamento deste lote?')) return;
    setErro(null);
    const res = await fetch(`/api/operacao/recebimentos/${recebimentoId}/cancelar`, { method: 'POST' });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErro((body as { message?: string }).message ?? 'Erro ao cancelar lote');
      return;
    }
    setDetalhe(null);
    setRecebimentoId(null);
    await carregarLista();
  };

  const irParaBalanca = (id: string) => {
    router.push(`/recebimento/pesagem-destinacao?recebimentoId=${id}`);
  };

  const abrirNovo = () => {
    setPedidoFornecedorId('');
    setPrevisao(null);
    setFormNfe(formNfeVazio());
    setErro(null);
    setSheetAberto(true);
    void carregarPedidosRecebiveis();
  };

  if (!podeLer) {
    return <p className="text-sm text-destructive">Você não tem permissão para visualizar recebimentos.</p>;
  }

  const podeCancelar =
    detalhe &&
    STATUS_ABERTOS.includes(detalhe.status) &&
    detalhe.progressoBalanca === 0;

  const podeFinalizar =
    detalhe && podeGerenciar && detalhe.status === 'aguardando_conferencia_final';

  const podeSuspender =
    detalhe && podeGerenciar && detalhe.status === 'aguardando_conferencia_final';

  const podeCapturarItensNf =
    podeGerenciar &&
    detalhe &&
    STATUS_ABERTOS.includes(detalhe.status);

  const podeRegistrarDivergencia =
    podeGerenciar &&
    detalhe &&
    !STATUS_ENCERRADOS.includes(detalhe.status) &&
    Boolean(itemSelecionado);

  return (
    <div className="space-y-3">
      <PageHeader
        title="Recebimento de carga"
        subtitle="Abertura de lotes a partir do Pedido ao Fornecedor — conferência na balança"
        live={status === 'conectado'}
      >
        <Button variant="secondary" size="sm" onClick={() => void carregarLista()}>
          <RefreshCw />
          Atualizar
        </Button>
        {podeGerenciar && (
          <Button size="sm" onClick={abrirNovo} data-testid="btn-novo-recebimento">
            <Plus />
            Novo recebimento
          </Button>
        )}
      </PageHeader>

      {erro && (
        <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {erro}
        </div>
      )}

      {!detalhe ? (
        <Card>
          <CardHeader>
            <CardTitle>Lotes de recebimento</CardTitle>
            <BadgeCount>{listaFiltrada.length}</BadgeCount>
            <CardAction>
              <div className="w-[240px]">
                <Input
                  adornLeft={<Search />}
                  placeholder="Buscar lote, PC, fornecedor, NF…"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="h-7 text-xs"
                />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Lote</TableHead>
                  <TableHead>Pedido de Compra</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead>NF-e</TableHead>
                  <TableHead>Romaneio</TableHead>
                  <TableHead>Tipo de carga</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Progresso</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {listaFiltrada.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-24 text-center text-xs text-muted-foreground">
                      Nenhum recebimento registrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  listaFiltrada.map((r) => (
                    <TableRow key={r.id} className="group">
                      <TableCellCode>#{r.codigoLote}</TableCellCode>
                      <TableCellCode>{r.numeroInternoCompra ?? '—'}</TableCellCode>
                      <TableCell className="text-[13px] font-semibold text-foreground">{r.fornecedorNome}</TableCell>
                      <TableCellCode>{r.nfeNumero ?? '—'}</TableCellCode>
                      <TableCellCode>{r.romaneio ?? '—'}</TableCellCode>
                      <TableCell className="text-muted-foreground">{r.tipoCarga ?? '—'}</TableCell>
                      <TableCell>
                        <StatusPill
                          variant={statusRecebimentoVariant(r.status)}
                          label={STATUS_RECEB_LABEL[r.status as StatusRecebimento] ?? r.status}
                        />
                      </TableCell>
                      <TableCell className="w-[120px]">
                        <ProgressoBalancaBar valor={r.progressoBalanca} />
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                          <Button variant="ghost" size="sm" onClick={() => void carregarDetalhe(r.id)}>
                            Abrir
                          </Button>
                          {!STATUS_ENCERRADOS.includes(r.status) && (
                            <Button variant="ghost" size="sm" onClick={() => irParaBalanca(r.id)}>
                              <Scale />
                              Ir para Balança
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => { setDetalhe(null); setRecebimentoId(null); }}>
              ← Voltar à lista
            </Button>
            <Button variant="secondary" size="sm" asChild>
              <a
                href={`/gestao/compras?compraId=${
                  detalhe.compraProgramadaId
                  ?? detalhe.pedidoFornecedor?.compraProgramadaId
                  ?? ''
                }`}
              >
                <ExternalLink />
                Ver Pedido de Compra
              </a>
            </Button>
            {podeGerenciar && !STATUS_ENCERRADOS.includes(detalhe.status) && (
              <Button variant="secondary" size="sm" onClick={() => setSheetNfeAberto(true)}>
                Editar dados da NF
              </Button>
            )}
            {podeCapturarItensNf && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void capturarItensNf()}
                disabled={salvando}
                data-testid="btn-capturar-itens-nf"
              >
                <Package />
                Capturar itens da NF
              </Button>
            )}
            {podeGerenciar && podeCancelar && (
              <Button variant="destructive" size="sm" onClick={() => void cancelarLote()}>
                <XCircle />
                Cancelar lote
              </Button>
            )}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Ações do recebimento</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2 p-3">
              {!STATUS_ENCERRADOS.includes(detalhe.status) && (
                <Button onClick={() => irParaBalanca(detalhe.id)}>
                  <Scale />
                  Ir para pesagem
                </Button>
              )}
              {podeRegistrarDivergencia && (
                <Button variant="secondary" onClick={abrirDialogDivergencia} data-testid="btn-registrar-divergencia">
                  <AlertTriangle />
                  Registrar divergência
                </Button>
              )}
              {podeFinalizar && (
                <Button onClick={solicitarFinalizar} disabled={salvando} data-testid="btn-concluir">
                  <CheckCircle2 />
                  Concluir conferência
                </Button>
              )}
              {podeSuspender && (
                <Button
                  variant="destructiveOutline"
                  onClick={() => void suspenderRecebimento()}
                  disabled={salvando}
                >
                  <PauseCircle />
                  Suspender
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="grid grid-cols-2 gap-x-6 gap-y-1.5 p-3 text-xs sm:grid-cols-3">
              <div>
                <p className="text-muted-foreground">Lote</p>
                <p className="font-medium" data-testid="receb-codigo">#{detalhe.codigoLote}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Pedido de Compra</p>
                <p className="font-medium">
                  {detalhe.compra?.numeroInterno
                    ?? (detalhe.compraProgramadaId
                      ?? detalhe.pedidoFornecedor?.compraProgramadaId
                      ?? '—'
                    ).toString().slice(0, 8)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Fornecedor</p>
                <p className="font-medium">{detalhe.fornecedor?.razaoSocial ?? '—'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Tipo de carga</p>
                <p className="font-medium">{detalhe.tipoCarga ?? '—'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">NF-e</p>
                <p className="font-medium font-data">{detalhe.nfeNumero ?? '—'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Romaneio</p>
                <p className="font-medium font-data">{detalhe.romaneio ?? '—'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Peso bruto NF</p>
                <p className="font-medium">{detalhe.nfePesoBruto ? `${detalhe.nfePesoBruto} kg` : '—'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Peso líquido NF</p>
                <p className="font-medium">{detalhe.nfePesoLiquido ? `${detalhe.nfePesoLiquido} kg` : '—'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Volumes NF</p>
                <p className="font-medium">{detalhe.nfeVolumes ?? '—'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Data/hora chegada</p>
                <p className="font-medium">{formatDataHora(detalhe.dataHoraChegada)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Status</p>
                <span data-testid="receb-status">
                  <StatusPill
                    variant={statusRecebimentoVariant(detalhe.status)}
                    label={STATUS_RECEB_LABEL[detalhe.status]}
                  />
                </span>
              </div>
              <div>
                <p className="text-muted-foreground">Progresso balança</p>
                <ProgressoBalancaBar valor={detalhe.progressoBalanca} />
              </div>
            </CardContent>
          </Card>

          {quadro.length > 0 && (
            <QuadroComparativo
              itens={quadro.map((q) => ({
                itemComercialId: q.itemComercialId,
                codigo: null,
                descricao: q.itemComercialId.slice(0, 8),
                qtdPedido: q.qtdPedido ?? '—',
                qtdNf: q.qtdNf,
                qtdApurada: q.qtdApurada,
                pesoNf: q.pesoNf,
                pesoApurado: q.pesoApurado,
                difQtd: String(Number(q.qtdApurada) - Number(q.qtdNf)),
                difPeso:
                  q.pesoNf != null && q.pesoApurado != null
                    ? String(Number(q.pesoApurado) - Number(q.pesoNf))
                    : null,
                situacao: q.situacao,
              }))}
            />
          )}

          {podeGerenciar && !STATUS_ENCERRADOS.includes(detalhe.status) && (
            <Card>
              <CardHeader>
                <CardTitle>Metadados operacionais</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-x-3.5 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-4">
                <FormField label="Placa" htmlFor="meta-placa">
                  <Input
                    id="meta-placa"
                    value={formMetadados.placaVeiculo}
                    onChange={(e) => setFormMetadados((p) => ({ ...p, placaVeiculo: e.target.value }))}
                  />
                </FormField>
                <FormField label="Motorista" htmlFor="meta-motorista">
                  <Input
                    id="meta-motorista"
                    value={formMetadados.motorista}
                    onChange={(e) => setFormMetadados((p) => ({ ...p, motorista: e.target.value }))}
                  />
                </FormField>
                <FormField label="Doca" htmlFor="meta-doca">
                  <Input
                    id="meta-doca"
                    value={formMetadados.doca}
                    onChange={(e) => setFormMetadados((p) => ({ ...p, doca: e.target.value }))}
                  />
                </FormField>
                <FormField label="Observações" htmlFor="meta-obs" className="sm:col-span-2 lg:col-span-4">
                  <Textarea
                    id="meta-obs"
                    rows={2}
                    value={formMetadados.observacoes}
                    onChange={(e) => setFormMetadados((p) => ({ ...p, observacoes: e.target.value }))}
                  />
                </FormField>
                <div>
                  <Button disabled={salvando} onClick={() => void salvarMetadados()} data-testid="btn-salvar-metadados">
                    Salvar metadados
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {detalhe.observacoes && STATUS_ENCERRADOS.includes(detalhe.status) && detalhe.status !== 'cancelado' && (
            <Card>
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground">Observações</p>
                <p className="mt-1 text-sm">{detalhe.observacoes}</p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Itens previstos importados</CardTitle>
              <BadgeCount>{detalhe.itens.length}</BadgeCount>
              <CardAction>
                <p className="text-xs text-muted-foreground">
                  Os dados previstos vêm do Pedido de Compra. Selecione um item para registrar divergência.
                </p>
              </CardAction>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Produto operacional</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead className="text-right">Previsto</TableHead>
                    <TableHead>Unidade</TableHead>
                    <TableHead>Passa balança?</TableHead>
                    <TableHead className="text-right">Apurado</TableHead>
                    <TableHead className="text-right">Peso apurado</TableHead>
                    <TableHead className="text-right">Dif. qtd</TableHead>
                    <TableHead className="text-right">Dif. peso</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detalhe.itens.map((item) => (
                    <TableRow
                      key={item.id}
                      data-testid={`item-${item.itemComercialId}`}
                      className="group cursor-pointer"
                      data-state={itemSelecionadoId === item.id ? 'selected' : undefined}
                      onClick={() => setItemSelecionadoId(item.id)}
                    >
                      <TableCell className="text-[13px] font-semibold text-foreground">
                        {item.itemComercial?.codigo ?? item.itemComercialId.slice(0, 8)}
                        {item.itemComercial?.descricao ? ` — ${item.itemComercial.descricao}` : ''}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">{item.origemDescricao ?? '—'}</TableCell>
                      <TableCellNum>{item.quantidadeEsperada}</TableCellNum>
                      <TableCell>{item.unidadeEsperada ?? '—'}</TableCell>
                      <TableCell>{item.requerBalanca ? 'Sim' : 'Não'}</TableCell>
                      <TableCellNum>
                        {item.statusApuracao === 'entrada_direta'
                          ? 'Não se aplica'
                          : (item.quantidadeApurada ?? item.quantidadeRecebida)}
                      </TableCellNum>
                      <TableCellNum>
                        {item.statusApuracao === 'entrada_direta'
                          ? 'Não se aplica'
                          : (item.pesoApurado ?? item.pesoTotalApurado ?? '—')}
                      </TableCellNum>
                      <TableCellNum>{calcDifQtd(item)}</TableCellNum>
                      <TableCellNum>{calcDifPeso(item)}</TableCellNum>
                      <TableCell>
                        <StatusPill
                          variant={statusApuracaoVariant(item.statusApuracao)}
                          label={STATUS_ITEM_LABEL[item.statusApuracao] ?? item.statusApuracao}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      <Sheet open={sheetAberto} onOpenChange={setSheetAberto}>
        <SheetContent className="flex flex-col overflow-hidden p-0 sm:max-w-lg">
          <SheetHeader className="border-b px-6 py-4">
            <SheetTitle>Novo Recebimento de Carga</SheetTitle>
            <SheetDescription className="sr-only">
              Selecione o Pedido ao Fornecedor e informe os dados da chegada da carga.
            </SheetDescription>
          </SheetHeader>
          {erro && (
            <div role="alert" className="mx-6 mt-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {erro}
            </div>
          )}

          <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
            <section className="space-y-2.5" aria-labelledby="bloco-pedido-fornecedor">
              <p id="bloco-pedido-fornecedor" className="text-[11px] font-bold uppercase tracking-[0.05em] text-muted-foreground">
                A — Pedido ao Fornecedor
              </p>
              <FormField
                label="Pedido ao fornecedor"
                htmlFor="pedido-fornecedor"
                help={!carregandoPedidos && pedidosRecebiveis.length === 0
                  ? 'Nenhum Pedido ao Fornecedor aguardando recebimento.'
                  : undefined}
              >
                <ComboboxField
                  id="pedido-fornecedor"
                  items={pedidosRecebiveis.map((pedido) => ({
                    id: pedido.id,
                    label: `${pedido.numero} — ${pedido.fornecedorNome}`,
                    sublabel: pedido.numeroInternoCompra ?? undefined,
                  }))}
                  value={pedidoFornecedorId}
                  onChange={setPedidoFornecedorId}
                  placeholder="Selecione o pedido ao fornecedor"
                  searchPlaceholder="Buscar pedido..."
                  emptyText="Nenhum pedido encontrado."
                />
              </FormField>

              {previsao && (
                <div className="space-y-2.5 rounded-md border border-border bg-surface-2 p-3 text-sm">
                  <Badge variant="secondary">Itens carregados automaticamente</Badge>
                  <p>
                    <span className="text-muted-foreground">Pedido:</span> {previsao.numeroPedidoFornecedor}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Fornecedor:</span> {previsao.fornecedorNome}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Tipo de carga:</span> {previsao.tipoCarga ?? '—'}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Compra:</span> {previsao.resumoCompra || '—'}
                  </p>
                  {previsao.observacoesCompra && (
                    <p>
                      <span className="text-muted-foreground">Observações:</span> {previsao.observacoesCompra}
                    </p>
                  )}
                  <div>
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead>Produto</TableHead>
                          <TableHead>Qtd prevista</TableHead>
                          <TableHead>Unidade</TableHead>
                          <TableHead>Balança</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previsao.itensOperacionais.map((item) => (
                          <TableRow key={item.itemComercialId}>
                            <TableCell>{item.produtoCodigo} — {item.produtoDescricao}</TableCell>
                            <TableCellNum>{item.quantidadePrevista}</TableCellNum>
                            <TableCell>{item.unidade}</TableCell>
                            <TableCell>{item.passaBalanca ? 'Sim' : 'Não — Entrada direta'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Os itens esperados vêm do Pedido ao Fornecedor. Não é necessário redigitar a carga.
                  </p>
                </div>
              )}
              <FormField label="Doca / área" htmlFor="doca">
                <Input id="doca" value={formNfe.doca} onChange={(e) => setFormNfe((p) => ({ ...p, doca: e.target.value }))} />
              </FormField>
            </section>

            <section className="space-y-2.5" aria-labelledby="bloco-nota-fiscal">
              <p id="bloco-nota-fiscal" className="text-[11px] font-bold uppercase tracking-[0.05em] text-muted-foreground">
                B — Nota Fiscal recebida
              </p>
              <p className="text-xs text-muted-foreground">
                Informe apenas os dados complementares da NF/romaneio. A conferência real de peças, pesos e quantidades
                será feita na balança.
              </p>
              <div className="grid grid-cols-1 gap-x-3.5 gap-y-2.5 sm:grid-cols-2">
                <FormField label="Número da NF-e" required htmlFor="nfeNumero" className="sm:col-span-2">
                  <Input id="nfeNumero" value={formNfe.nfeNumero} onChange={(e) => setFormNfe((p) => ({ ...p, nfeNumero: e.target.value }))} />
                </FormField>
                <FormField label="Série" htmlFor="nfeSerie">
                  <Input id="nfeSerie" value={formNfe.nfeSerie} onChange={(e) => setFormNfe((p) => ({ ...p, nfeSerie: e.target.value }))} />
                </FormField>
                <FormField label="Data emissão" htmlFor="nfeDataEmissao">
                  <Input id="nfeDataEmissao" type="date" value={formNfe.nfeDataEmissao} onChange={(e) => setFormNfe((p) => ({ ...p, nfeDataEmissao: e.target.value }))} />
                </FormField>
                <FormField label="Chave NF-e" htmlFor="nfeChave" className="sm:col-span-2">
                  <Input id="nfeChave" value={formNfe.nfeChave} onChange={(e) => setFormNfe((p) => ({ ...p, nfeChave: e.target.value }))} placeholder="44 dígitos" />
                </FormField>
                <FormField label="Romaneio" htmlFor="romaneio" className="sm:col-span-2">
                  <Input id="romaneio" value={formNfe.romaneio} onChange={(e) => setFormNfe((p) => ({ ...p, romaneio: e.target.value }))} />
                </FormField>
                <FormField label="Peso bruto NF" htmlFor="nfePesoBruto">
                  <Input id="nfePesoBruto" type="number" step="0.001" adornRight="kg" value={formNfe.nfePesoBruto} onChange={(e) => setFormNfe((p) => ({ ...p, nfePesoBruto: e.target.value }))} />
                </FormField>
                <FormField label="Peso líquido NF" htmlFor="nfePesoLiquido">
                  <Input id="nfePesoLiquido" type="number" step="0.001" adornRight="kg" value={formNfe.nfePesoLiquido} onChange={(e) => setFormNfe((p) => ({ ...p, nfePesoLiquido: e.target.value }))} />
                </FormField>
                <FormField label="Volumes NF" htmlFor="nfeVolumes">
                  <Input id="nfeVolumes" type="number" step="1" value={formNfe.nfeVolumes} onChange={(e) => setFormNfe((p) => ({ ...p, nfeVolumes: e.target.value }))} />
                </FormField>
              </div>
            </section>

            <section className="space-y-2.5" aria-labelledby="bloco-transporte">
              <p id="bloco-transporte" className="text-[11px] font-bold uppercase tracking-[0.05em] text-muted-foreground">
                C — Transporte
              </p>
              <div className="grid grid-cols-1 gap-x-3.5 gap-y-2.5 sm:grid-cols-2">
                <FormField label="Placa" htmlFor="placa">
                  <Input id="placa" value={formNfe.placaVeiculo} onChange={(e) => setFormNfe((p) => ({ ...p, placaVeiculo: e.target.value }))} />
                </FormField>
                <FormField label="Motorista" htmlFor="motorista">
                  <Input id="motorista" value={formNfe.motorista} onChange={(e) => setFormNfe((p) => ({ ...p, motorista: e.target.value }))} />
                </FormField>
              </div>
            </section>

            <section className="space-y-2.5" aria-labelledby="bloco-observacoes">
              <p id="bloco-observacoes" className="text-[11px] font-bold uppercase tracking-[0.05em] text-muted-foreground">
                D — Observações internas
              </p>
              <FormField label="Observações internas" htmlFor="obs">
                <Textarea id="obs" rows={3} value={formNfe.observacoes} onChange={(e) => setFormNfe((p) => ({ ...p, observacoes: e.target.value }))} />
              </FormField>
            </section>
          </div>
          <div className="flex flex-col gap-2 border-t border-border bg-background px-6 py-4">
            <Button variant="ghost" onClick={() => setSheetAberto(false)}>
              Cancelar
            </Button>
            <Button
              variant="secondary"
              disabled={salvando || carregandoPedidos || !pedidoFornecedorId || !formNfe.nfeNumero || !previsao?.itensOperacionais.length}
              onClick={() => void criarLote(false)}
              data-testid="btn-criar-lote"
            >
              Criar Lote
            </Button>
            <Button
              disabled={salvando || carregandoPedidos || !pedidoFornecedorId || !formNfe.nfeNumero || !previsao?.itensOperacionais.length}
              onClick={() => void criarLote(true)}
              data-testid="btn-criar-ir-balanca"
            >
              <ArrowRight />
              Criar Lote e Ir para Balança
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={sheetNfeAberto} onOpenChange={setSheetNfeAberto}>
        <SheetContent className="sm:max-w-[520px]">
          <SheetHeader>
            <SheetTitle>Editar dados da NF</SheetTitle>
          </SheetHeader>
          <div className="space-y-3 p-4">
            <FormField label="Número da NF-e" htmlFor="nfe-editar-numero">
              <Input id="nfe-editar-numero" value={formNfe.nfeNumero} onChange={(e) => setFormNfe((p) => ({ ...p, nfeNumero: e.target.value }))} />
            </FormField>
            <FormField label="Romaneio" htmlFor="nfe-editar-romaneio">
              <Input id="nfe-editar-romaneio" value={formNfe.romaneio} onChange={(e) => setFormNfe((p) => ({ ...p, romaneio: e.target.value }))} />
            </FormField>
          </div>
          <div className="flex gap-2 border-t border-border p-4">
            <Button disabled={salvando || !formNfe.nfeNumero} onClick={() => void salvarNfe()}>
              Salvar
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={dialogDivergenciaAberto} onOpenChange={setDialogDivergenciaAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar divergência</DialogTitle>
            <DialogDescription>
              {itemSelecionado
                ? `Item: ${labelProdutoItem(itemSelecionado)} — previsto ${itemSelecionado.quantidadeEsperada}, apurado ${qtdApuradaItem(itemSelecionado)}`
                : 'Selecione um item na tabela.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 text-[13px] text-fg-secondary">
            <FormField label="Tipo de divergência" required htmlFor="div-tipo">
              <SelectNative
                id="div-tipo"
                value={formDivergencia.tipo}
                onChange={(e) => setFormDivergencia((p) => ({ ...p, tipo: e.target.value as TipoDivergencia }))}
              >
                <option value="" disabled>Selecione o tipo</option>
                {TIPOS_DIVERGENCIA.map((t) => (
                  <option key={t} value={t}>
                    {LABEL_TIPO_DIVERGENCIA[t]}
                  </option>
                ))}
              </SelectNative>
            </FormField>
            <FormField label="Descrição" required htmlFor="div-desc">
              <Textarea
                id="div-desc"
                rows={3}
                value={formDivergencia.descricao}
                onChange={(e) => setFormDivergencia((p) => ({ ...p, descricao: e.target.value }))}
              />
            </FormField>
            <FormField label="Ação imediata" required htmlFor="div-acao">
              <Textarea
                id="div-acao"
                rows={2}
                value={formDivergencia.acaoImediata}
                onChange={(e) => setFormDivergencia((p) => ({ ...p, acaoImediata: e.target.value }))}
              />
            </FormField>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogDivergenciaAberto(false)}>
              Cancelar
            </Button>
            <Button
              disabled={salvando || !formDivergencia.tipo || !formDivergencia.descricao.trim() || !formDivergencia.acaoImediata.trim()}
              onClick={() => void registrarDivergencia()}
            >
              Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogConferenciaAberto} onOpenChange={setDialogConferenciaAberto}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Conclusão da Conferência — Pedido × NF × Pesagem</DialogTitle>
            <DialogDescription>
              Revise o quadro comparativo e confirme o resultado da conferência.
            </DialogDescription>
          </DialogHeader>
          {quadro.length > 0 && (
            <QuadroComparativo
              itens={quadro.map((q) => ({
                itemComercialId: q.itemComercialId,
                codigo: null,
                descricao: q.itemComercialId.slice(0, 8),
                qtdPedido: q.qtdPedido ?? '—',
                qtdNf: q.qtdNf,
                qtdApurada: q.qtdApurada,
                pesoNf: q.pesoNf,
                pesoApurado: q.pesoApurado,
                difQtd: String(Number(q.qtdApurada) - Number(q.qtdNf)),
                difPeso:
                  q.pesoNf != null && q.pesoApurado != null
                    ? String(Number(q.pesoApurado) - Number(q.pesoNf))
                    : null,
                situacao: q.situacao,
              }))}
            />
          )}
          <FormField label="Observação da conferência" htmlFor="obs-conferencia">
            <Textarea
              id="obs-conferencia"
              rows={2}
              value={obsConferencia}
              onChange={(e) => setObsConferencia(e.target.value)}
            />
          </FormField>
          {resumoFinalizarDivergencias.length > 0 && (
            <p className="text-sm text-[var(--color-status-divergencia)]">
              Há {resumoFinalizarDivergencias.length} item(ns) com divergência em aberto.
            </p>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogConferenciaAberto(false)}>
              Cancelar
            </Button>
            <Button disabled={salvando} onClick={() => void executarConcluirConferencia()} data-testid="btn-confirmar-conferencia">
              Confirmar conclusão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
