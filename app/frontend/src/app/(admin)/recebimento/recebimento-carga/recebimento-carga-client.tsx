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
  Truck,
  XCircle,
} from 'lucide-react';
import { conectarRealtime, type RealtimeMensagem } from '@/lib/realtime';
import {
  TIPOS_DIVERGENCIA,
  type IniciarRecebimentoPayload,
  type PaginadoRecebimento,
  type PrevisaoRecebimento,
  type RecebimentoDetalhe,
  type RecebimentoItem,
  type RecebimentoResumoEnriquecido,
  type StatusRecebimento,
  type TipoDivergencia,
} from '@/lib/operacao';
import { statusApuracaoVariant, statusRecebimentoVariant } from '@/lib/status-ui';
import { ProgressoBalancaBar } from '@/components/recebimento/progresso-balanca-bar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { StatusPill } from '@/components/ui/status-pill';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/cn';
import type { CompraProgramada, Paginado } from '@/lib/comercial';

const STATUS_RECEB_LABEL: Record<StatusRecebimento, string> = {
  aguardando_conferencia: 'Aguardando conferência',
  em_conferencia: 'Em conferência',
  finalizado: 'Finalizado',
  cancelado: 'Cancelado',
};

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

function labelCompra(c: CompraProgramada, fornecedor?: string): string {
  const pc = c.numeroInterno ?? c.id.slice(0, 8);
  const forn = fornecedor ? ` — ${fornecedor}` : '';
  return `${pc}${forn}`;
}

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

function pesoApuradoItem(item: RecebimentoItem): number | null {
  if (item.statusApuracao === 'entrada_direta' || !item.requerBalanca) return null;
  const val = item.pesoApurado ?? item.pesoTotalApurado;
  if (!val) return null;
  const n = Number(val);
  return Number.isNaN(n) ? null : n;
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
  const [compras, setCompras] = useState<CompraProgramada[]>([]);
  const [fornecedoresMap, setFornecedoresMap] = useState<Record<string, string>>({});
  const [busca, setBusca] = useState('');
  const [sheetAberto, setSheetAberto] = useState(false);
  const [sheetNfeAberto, setSheetNfeAberto] = useState(false);
  const [compraId, setCompraId] = useState('');
  const [previsao, setPrevisao] = useState<PrevisaoRecebimento | null>(null);
  const [formNfe, setFormNfe] = useState<FormNfe>(formNfeVazio);
  const [formMetadados, setFormMetadados] = useState<FormMetadados>(formMetadadosVazio);
  const [salvando, setSalvando] = useState(false);

  const [recebimentoId, setRecebimentoId] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<RecebimentoDetalhe | null>(null);
  const [itemSelecionadoId, setItemSelecionadoId] = useState<string | null>(null);
  const [dialogDivergenciaAberto, setDialogDivergenciaAberto] = useState(false);
  const [dialogFinalizarAberto, setDialogFinalizarAberto] = useState(false);
  const [formDivergencia, setFormDivergencia] = useState<FormDivergencia>(formDivergenciaVazio);
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

  const carregarCompras = useCallback(async () => {
    const [cRes, fRes] = await Promise.all([
      fetch('/api/comercial/compras-programadas?pageSize=50', { cache: 'no-store' }),
      fetch('/api/cadastros/fornecedores?pageSize=100', { cache: 'no-store' }),
    ]);
    if (fRes.ok) {
      const f = (await fRes.json()) as Paginado<{ id: string; razaoSocial: string }>;
      setFornecedoresMap(Object.fromEntries(f.data.map((x) => [x.id, x.razaoSocial])));
    }
    if (cRes.ok) {
      const pag = (await cRes.json()) as Paginado<CompraProgramada>;
      setCompras(pag.data.filter((c) => c.status === 'confirmada'));
    }
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
      nfeVolumes: d.nfeVolumes ?? '',
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
  }, []);

  useEffect(() => {
    void carregarLista();
    void carregarCompras();
  }, [carregarLista, carregarCompras]);

  useEffect(() => {
    if (compraId) void carregarPrevisao(compraId);
    else setPrevisao(null);
  }, [compraId, carregarPrevisao]);

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
    const desconectar = conectarRealtime({
      rooms: ['dashboard', `operacao:${detalhe.dataOperacao}`],
      onMessage,
      onReconnect: () => {
        if (recebimentoId) void carregarDetalhe(recebimentoId);
        void carregarLista();
      },
      onStatus: setStatus,
    });
    return desconectar;
  }, [detalhe, recebimentoId, carregarDetalhe, carregarLista]);

  const comprasDisponiveis = useMemo(() => {
    const comRecebimento = new Set(lista.filter((r) => r.status !== 'cancelado').map((r) => r.compraProgramadaId));
    return compras.filter((c) => !comRecebimento.has(c.id));
  }, [compras, lista]);

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
    if (!compraId || !formNfe.nfeNumero.trim()) return null;
    const payload: IniciarRecebimentoPayload = {
      compraProgramadaId: compraId,
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
      setErro('Informe o pedido de compra, NF-e e confirme que há itens previstos.');
      return;
    }
    if (previsao.jaPossuiRecebimento) {
      setErro('Esta compra já possui lote de recebimento aberto.');
      return;
    }
    setSalvando(true);
    setErro(null);
    const res = await fetch('/api/operacao/recebimentos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, iniciarConferencia: irParaBalanca }),
    });
    const body = await res.json().catch(() => ({}));
    setSalvando(false);
    if (!res.ok) {
      setErro((body as { message?: string }).message ?? 'Erro ao criar lote');
      return;
    }
    const rec = (body as { recebimento: { id: string } }).recebimento;
    setSheetAberto(false);
    setCompraId('');
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

  const executarConcluir = async () => {
    if (!recebimentoId || !podeGerenciar) return;
    setSalvando(true);
    setErro(null);
    const res = await fetch(`/api/operacao/recebimentos/${recebimentoId}/concluir`, { method: 'POST' });
    const body = await res.json().catch(() => ({}));
    setSalvando(false);
    if (!res.ok) {
      setErro((body as { message?: string }).message ?? 'Erro ao finalizar recebimento');
      return;
    }
    setDialogFinalizarAberto(false);
    await carregarDetalhe(recebimentoId);
    await carregarLista();
  };

  const solicitarFinalizar = () => {
    if (!podeGerenciar || !detalhe) return;
    if (resumoFinalizarDivergencias.length > 0) {
      setDialogFinalizarAberto(true);
      return;
    }
    void executarConcluir();
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
    setCompraId('');
    setPrevisao(null);
    setFormNfe(formNfeVazio());
    setErro(null);
    setSheetAberto(true);
  };

  if (!podeLer) {
    return <p className="text-sm text-destructive">Você não tem permissão para visualizar recebimentos.</p>;
  }

  const podeCancelar =
    detalhe &&
    ['aguardando_conferencia', 'em_conferencia'].includes(detalhe.status) &&
    detalhe.progressoBalanca === 0;

  const podeFinalizar =
    detalhe && podeGerenciar && ['aguardando_conferencia', 'em_conferencia'].includes(detalhe.status);

  const podeSuspender = detalhe && podeGerenciar && detalhe.status === 'em_conferencia';

  const podeRegistrarDivergencia =
    podeGerenciar &&
    detalhe &&
    detalhe.status !== 'finalizado' &&
    detalhe.status !== 'cancelado' &&
    Boolean(itemSelecionado);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Recebimento de carga</h1>
          <p className="text-sm text-muted-foreground">
            Abertura de lotes a partir do Pedido de Compra — conferência na balança
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={status === 'conectado' ? 'border-green-200 bg-green-50 text-green-700' : ''}>
            {status === 'conectado' ? '● tempo real' : '○ reconectando'}
          </Badge>
          <Button variant="outline" size="sm" onClick={() => void carregarLista()}>
            <RefreshCw className="mr-1 h-4 w-4" />
            Atualizar
          </Button>
          {podeGerenciar && (
            <Button size="sm" onClick={abrirNovo} data-testid="btn-novo-recebimento">
              <Plus className="mr-1 h-4 w-4" />
              Novo recebimento
            </Button>
          )}
        </div>
      </div>

      {erro && (
        <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {erro}
        </div>
      )}

      {!detalhe ? (
        <Card>
          <div className="flex items-center gap-2 border-b p-4">
            <Truck className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">Lotes de recebimento</h2>
          </div>
          <div className="border-b p-3">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Buscar lote, PC, fornecedor, NF…" value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lote</TableHead>
                  <TableHead>Pedido de Compra</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead>NF-e</TableHead>
                  <TableHead>Romaneio</TableHead>
                  <TableHead>Tipo de carga</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Progresso balança</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {listaFiltrada.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                      Nenhum recebimento registrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  listaFiltrada.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-sm">#{r.codigoLote}</TableCell>
                      <TableCell>{r.numeroInternoCompra ?? '—'}</TableCell>
                      <TableCell>{r.fornecedorNome}</TableCell>
                      <TableCell>{r.nfeNumero ?? '—'}</TableCell>
                      <TableCell>{r.romaneio ?? '—'}</TableCell>
                      <TableCell>{r.tipoCarga ?? '—'}</TableCell>
                      <TableCell>
                        <StatusPill
                          variant={statusRecebimentoVariant(r.status)}
                          label={STATUS_RECEB_LABEL[r.status as StatusRecebimento] ?? r.status}
                        />
                      </TableCell>
                      <TableCell>
                        <ProgressoBalancaBar valor={r.progressoBalanca} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => void carregarDetalhe(r.id)}>
                            Abrir
                          </Button>
                          {r.status !== 'cancelado' && r.status !== 'finalizado' && (
                            <Button variant="ghost" size="sm" onClick={() => irParaBalanca(r.id)}>
                              <Scale className="mr-1 h-3 w-3" />
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
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => { setDetalhe(null); setRecebimentoId(null); }}>
              ← Voltar à lista
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href={`/gestao/compras?compraId=${detalhe.compraProgramadaId}`}>
                <ExternalLink className="mr-1 h-4 w-4" />
                Ver Pedido de Compra
              </a>
            </Button>
            {podeGerenciar && detalhe.status !== 'finalizado' && detalhe.status !== 'cancelado' && (
              <Button variant="outline" size="sm" onClick={() => setSheetNfeAberto(true)}>
                Editar dados da NF
              </Button>
            )}
            {podeGerenciar && podeCancelar && (
              <Button variant="destructive" size="sm" onClick={() => void cancelarLote()}>
                <XCircle className="mr-1 h-4 w-4" />
                Cancelar lote
              </Button>
            )}
          </div>

          <Card>
            <div className="border-b p-4">
              <h2 className="text-sm font-semibold">Ações do recebimento</h2>
            </div>
            <CardContent className="flex flex-wrap gap-2 p-4">
              {detalhe.status !== 'cancelado' && detalhe.status !== 'finalizado' && (
                <Button variant="outline" size="sm" onClick={() => irParaBalanca(detalhe.id)}>
                  <Scale className="mr-1 h-4 w-4" />
                  Ir para pesagem
                </Button>
              )}
              {podeRegistrarDivergencia && (
                <Button variant="outline" size="sm" onClick={abrirDialogDivergencia} data-testid="btn-registrar-divergencia">
                  <AlertTriangle className="mr-1 h-4 w-4" />
                  Registrar divergência
                </Button>
              )}
              {podeFinalizar && (
                <Button size="sm" onClick={solicitarFinalizar} disabled={salvando} data-testid="btn-concluir">
                  <CheckCircle2 className="mr-1 h-4 w-4" />
                  Finalizar recebimento
                </Button>
              )}
              {podeSuspender && (
                <Button variant="secondary" size="sm" onClick={() => void suspenderRecebimento()} disabled={salvando}>
                  <PauseCircle className="mr-1 h-4 w-4" />
                  Suspender
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground">Lote</p>
                <p className="font-semibold" data-testid="receb-codigo">#{detalhe.codigoLote}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pedido de Compra</p>
                <p className="font-semibold">{detalhe.compra?.numeroInterno ?? detalhe.compraProgramadaId.slice(0, 8)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Fornecedor</p>
                <p className="font-semibold">{detalhe.fornecedor?.razaoSocial ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Tipo de carga</p>
                <p>{detalhe.tipoCarga ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">NF-e</p>
                <p>{detalhe.nfeNumero ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Romaneio</p>
                <p>{detalhe.romaneio ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Peso bruto NF</p>
                <p>{detalhe.nfePesoBruto ? `${detalhe.nfePesoBruto} kg` : '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Peso líquido NF</p>
                <p>{detalhe.nfePesoLiquido ? `${detalhe.nfePesoLiquido} kg` : '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Volumes NF</p>
                <p>{detalhe.nfeVolumes ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Data/hora chegada</p>
                <p>{formatDataHora(detalhe.dataHoraChegada)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <span data-testid="receb-status">
                  <StatusPill
                    variant={statusRecebimentoVariant(detalhe.status)}
                    label={STATUS_RECEB_LABEL[detalhe.status]}
                  />
                </span>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Progresso balança</p>
                <ProgressoBalancaBar valor={detalhe.progressoBalanca} />
              </div>
            </CardContent>
          </Card>

          {podeGerenciar && detalhe.status !== 'finalizado' && detalhe.status !== 'cancelado' && (
            <Card>
              <div className="border-b p-4">
                <h2 className="text-sm font-semibold">Metadados operacionais</h2>
              </div>
              <CardContent className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <Label htmlFor="meta-placa">Placa</Label>
                  <Input
                    id="meta-placa"
                    className="mt-1"
                    value={formMetadados.placaVeiculo}
                    onChange={(e) => setFormMetadados((p) => ({ ...p, placaVeiculo: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="meta-motorista">Motorista</Label>
                  <Input
                    id="meta-motorista"
                    className="mt-1"
                    value={formMetadados.motorista}
                    onChange={(e) => setFormMetadados((p) => ({ ...p, motorista: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="meta-doca">Doca</Label>
                  <Input
                    id="meta-doca"
                    className="mt-1"
                    value={formMetadados.doca}
                    onChange={(e) => setFormMetadados((p) => ({ ...p, doca: e.target.value }))}
                  />
                </div>
                <div className="sm:col-span-2 lg:col-span-4">
                  <Label htmlFor="meta-obs">Observações</Label>
                  <Textarea
                    id="meta-obs"
                    className="mt-1"
                    rows={2}
                    value={formMetadados.observacoes}
                    onChange={(e) => setFormMetadados((p) => ({ ...p, observacoes: e.target.value }))}
                  />
                </div>
                <div>
                  <Button disabled={salvando} onClick={() => void salvarMetadados()} data-testid="btn-salvar-metadados">
                    Salvar metadados
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {detalhe.observacoes && detalhe.status === 'finalizado' && (
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Observações</p>
                <p className="mt-1 text-sm">{detalhe.observacoes}</p>
              </CardContent>
            </Card>
          )}

          <Card>
            <div className="border-b p-4">
              <h2 className="flex items-center gap-2 font-semibold">
                <Package className="h-5 w-5" />
                Itens previstos importados
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Os dados previstos vêm do Pedido de Compra. Apuração real é feita na balança. Selecione um item para registrar divergência.
              </p>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
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
                    className={cn(
                      'cursor-pointer',
                      itemSelecionadoId === item.id && 'bg-muted/60',
                    )}
                    onClick={() => setItemSelecionadoId(item.id)}
                  >
                    <TableCell>
                      {item.itemComercial?.codigo ?? item.itemComercialId.slice(0, 8)}
                      {item.itemComercial?.descricao ? ` — ${item.itemComercial.descricao}` : ''}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-xs">{item.origemDescricao ?? '—'}</TableCell>
                    <TableCell className="text-right">{item.quantidadeEsperada}</TableCell>
                    <TableCell>{item.unidadeEsperada ?? '—'}</TableCell>
                    <TableCell>{item.requerBalanca ? 'Sim' : 'Não'}</TableCell>
                    <TableCell className="text-right">
                      {item.statusApuracao === 'entrada_direta'
                        ? 'Não se aplica'
                        : (item.quantidadeApurada ?? item.quantidadeRecebida)}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.statusApuracao === 'entrada_direta'
                        ? 'Não se aplica'
                        : (item.pesoApurado ?? item.pesoTotalApurado ?? '—')}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">{calcDifQtd(item)}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{calcDifPeso(item)}</TableCell>
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
          </Card>
        </div>
      )}

      <Sheet open={sheetAberto} onOpenChange={setSheetAberto}>
        <SheetContent className="overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Novo recebimento</SheetTitle>
          </SheetHeader>

          <div className="mt-6 space-y-8">
            <section className="space-y-3">
              <h3 className="text-sm font-semibold">1. Pedido de Compra</h3>
              <div>
                <Label>Pedido de Compra</Label>
                <Select value={compraId} onValueChange={setCompraId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione o pedido confirmado" />
                  </SelectTrigger>
                  <SelectContent>
                    {comprasDisponiveis.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {labelCompra(c, fornecedoresMap[c.fornecedorId])}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {previsao && (
                <div className="space-y-3 rounded-md border bg-muted/30 p-3 text-sm">
                  <Badge variant="secondary">Importado do Pedido de Compra</Badge>
                  <p>
                    <span className="text-muted-foreground">Pedido:</span> {previsao.numeroInterno ?? previsao.compraProgramadaId.slice(0, 8)}
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
                    <p className="mb-1 font-medium">Itens operacionais previstos</p>
                    <ul className="space-y-1 text-xs">
                      {previsao.itensOperacionais.map((i) => (
                        <li key={i.itemComercialId}>
                          {i.produtoCodigo || i.produtoDescricao} — {i.quantidadePrevista} {i.unidade} — passa pela
                          balança: {i.passaBalanca ? 'Sim' : 'Não'}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Os dados previstos vêm do Pedido de Compra. Para alterar, ajuste o pedido de compra ou registre a
                    diferença após a conferência na balança.
                  </p>
                </div>
              )}
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold">2. Dados da NF / Romaneio</h3>
              <p className="text-xs text-muted-foreground">
                Informe apenas os dados complementares da NF/romaneio. A conferência real de peças, pesos e quantidades
                será feita na balança.
              </p>
              <div className="grid gap-3">
                <div>
                  <Label htmlFor="nfeNumero">Número da NF-e *</Label>
                  <Input id="nfeNumero" value={formNfe.nfeNumero} onChange={(e) => setFormNfe((p) => ({ ...p, nfeNumero: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="nfeSerie">Série</Label>
                    <Input id="nfeSerie" value={formNfe.nfeSerie} onChange={(e) => setFormNfe((p) => ({ ...p, nfeSerie: e.target.value }))} />
                  </div>
                  <div>
                    <Label htmlFor="nfeDataEmissao">Data emissão</Label>
                    <Input id="nfeDataEmissao" type="date" value={formNfe.nfeDataEmissao} onChange={(e) => setFormNfe((p) => ({ ...p, nfeDataEmissao: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <Label htmlFor="nfeChave">Chave NF-e</Label>
                  <Input id="nfeChave" value={formNfe.nfeChave} onChange={(e) => setFormNfe((p) => ({ ...p, nfeChave: e.target.value }))} placeholder="44 dígitos" />
                </div>
                <div>
                  <Label htmlFor="romaneio">Romaneio</Label>
                  <Input id="romaneio" value={formNfe.romaneio} onChange={(e) => setFormNfe((p) => ({ ...p, romaneio: e.target.value }))} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label htmlFor="nfePesoBruto">Peso bruto NF (kg)</Label>
                    <Input id="nfePesoBruto" type="number" step="0.001" value={formNfe.nfePesoBruto} onChange={(e) => setFormNfe((p) => ({ ...p, nfePesoBruto: e.target.value }))} />
                  </div>
                  <div>
                    <Label htmlFor="nfePesoLiquido">Peso líquido NF (kg)</Label>
                    <Input id="nfePesoLiquido" type="number" step="0.001" value={formNfe.nfePesoLiquido} onChange={(e) => setFormNfe((p) => ({ ...p, nfePesoLiquido: e.target.value }))} />
                  </div>
                  <div>
                    <Label htmlFor="nfeVolumes">Volumes NF</Label>
                    <Input id="nfeVolumes" type="number" step="1" value={formNfe.nfeVolumes} onChange={(e) => setFormNfe((p) => ({ ...p, nfeVolumes: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <Label htmlFor="obs">Observação</Label>
                  <Textarea id="obs" rows={2} value={formNfe.observacoes} onChange={(e) => setFormNfe((p) => ({ ...p, observacoes: e.target.value }))} />
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold">3. Veículo e doca</h3>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <Label htmlFor="placa">Placa</Label>
                  <Input id="placa" value={formNfe.placaVeiculo} onChange={(e) => setFormNfe((p) => ({ ...p, placaVeiculo: e.target.value }))} />
                </div>
                <div>
                  <Label htmlFor="motorista">Motorista</Label>
                  <Input id="motorista" value={formNfe.motorista} onChange={(e) => setFormNfe((p) => ({ ...p, motorista: e.target.value }))} />
                </div>
                <div>
                  <Label htmlFor="doca">Doca</Label>
                  <Input id="doca" value={formNfe.doca} onChange={(e) => setFormNfe((p) => ({ ...p, doca: e.target.value }))} />
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold">4. Resumo e criação do lote</h3>
              {previsao && formNfe.nfeNumero && (
                <div className="rounded-md border p-3 text-sm">
                  <p>
                    <strong>PC:</strong> {previsao.numeroInterno ?? '—'} · <strong>Fornecedor:</strong> {previsao.fornecedorNome}
                  </p>
                  <p>
                    <strong>NF-e:</strong> {formNfe.nfeNumero}
                    {formNfe.romaneio ? ` · Romaneio: ${formNfe.romaneio}` : ''}
                  </p>
                  {(formNfe.placaVeiculo || formNfe.motorista || formNfe.doca) && (
                    <p>
                      {formNfe.placaVeiculo ? `Placa: ${formNfe.placaVeiculo}` : ''}
                      {formNfe.motorista ? ` · Motorista: ${formNfe.motorista}` : ''}
                      {formNfe.doca ? ` · Doca: ${formNfe.doca}` : ''}
                    </p>
                  )}
                  <p>
                    <strong>Itens previstos:</strong> {previsao.itensOperacionais.length}
                  </p>
                </div>
              )}
              <div className="flex flex-col gap-2">
                <Button variant="outline" onClick={() => setSheetAberto(false)}>
                  Cancelar
                </Button>
                <Button
                  disabled={salvando || !compraId || !formNfe.nfeNumero || !previsao?.itensOperacionais.length}
                  onClick={() => void criarLote(false)}
                  data-testid="btn-criar-lote"
                >
                  Criar Lote
                </Button>
                <Button
                  disabled={salvando || !compraId || !formNfe.nfeNumero || !previsao?.itensOperacionais.length}
                  onClick={() => void criarLote(true)}
                  data-testid="btn-criar-ir-balanca"
                >
                  <ArrowRight className="mr-1 h-4 w-4" />
                  Criar Lote e Ir para Balança
                </Button>
              </div>
            </section>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={sheetNfeAberto} onOpenChange={setSheetNfeAberto}>
        <SheetContent className="overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Editar dados da NF</SheetTitle>
          </SheetHeader>
          <div className="mt-6 grid gap-3">
            <div>
              <Label>Número da NF-e</Label>
              <Input value={formNfe.nfeNumero} onChange={(e) => setFormNfe((p) => ({ ...p, nfeNumero: e.target.value }))} />
            </div>
            <div>
              <Label>Romaneio</Label>
              <Input value={formNfe.romaneio} onChange={(e) => setFormNfe((p) => ({ ...p, romaneio: e.target.value }))} />
            </div>
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
          <div className="grid gap-3">
            <div>
              <Label>Tipo de divergência *</Label>
              <Select
                value={formDivergencia.tipo}
                onValueChange={(v) => setFormDivergencia((p) => ({ ...p, tipo: v as TipoDivergencia }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_DIVERGENCIA.map((t) => (
                    <SelectItem key={t} value={t}>
                      {LABEL_TIPO_DIVERGENCIA[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="div-desc">Descrição *</Label>
              <Textarea
                id="div-desc"
                rows={3}
                className="mt-1"
                value={formDivergencia.descricao}
                onChange={(e) => setFormDivergencia((p) => ({ ...p, descricao: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="div-acao">Ação imediata *</Label>
              <Textarea
                id="div-acao"
                rows={2}
                className="mt-1"
                value={formDivergencia.acaoImediata}
                onChange={(e) => setFormDivergencia((p) => ({ ...p, acaoImediata: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogDivergenciaAberto(false)}>
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

      <Dialog open={dialogFinalizarAberto} onOpenChange={setDialogFinalizarAberto}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Finalizar com divergências abertas</DialogTitle>
            <DialogDescription>
              Este lote possui itens divergentes com ocorrências ainda em aberto. Confirme que deseja prosseguir com a finalização.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-64 space-y-3 overflow-y-auto text-sm">
            {resumoFinalizarDivergencias.map(({ item, divergencias }) => (
              <div key={item.id} className="rounded-md border p-3">
                <p className="font-medium">{labelProdutoItem(item)}</p>
                <p className="text-muted-foreground">
                  Previsto: {item.quantidadeEsperada} · Apurado: {qtdApuradaItem(item)}
                  {pesoApuradoItem(item) !== null ? ` · Peso: ${pesoApuradoItem(item)?.toLocaleString('pt-BR', { minimumFractionDigits: 3 })} kg` : ''}
                </p>
                <ul className="mt-2 space-y-1 text-xs">
                  {divergencias.map((d) => (
                    <li key={d.id}>
                      <StatusPill variant="divergencia" label={LABEL_TIPO_DIVERGENCIA[d.tipo]} />
                      {' — '}
                      {d.descricao}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogFinalizarAberto(false)}>
              Cancelar
            </Button>
            <Button disabled={salvando} onClick={() => void executarConcluir()}>
              Confirmar finalização
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
