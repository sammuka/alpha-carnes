'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, Clock3, Plus, Search, ShieldCheck, ShoppingCart } from 'lucide-react';
import type {
  AdendoPedido,
  CompraProgramada,
  Paginado,
  PedidoVenda,
  PedidoVendaDetalhe,
} from '@/lib/comercial';
import { conectarRealtime, type RealtimeMensagem } from '@/lib/realtime';
import { rotuloStatusPedido } from '@/lib/status-pedido';
import { ActivityItem } from '@/components/ui/activity-item';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { KpiCard } from '@/components/ui/kpi-card';
import { StatusPill, type StatusPillVariant } from '@/components/ui/status-pill';
import { ModalLiberarReserva } from './modal-liberar-reserva';
import {
  PedidoEditor,
  type ClientePedido,
  type ProdutoPedido,
} from './pedido-editor';

interface PedidosClientProps {
  permissoes: string[];
}

interface AuditoriaPedido {
  id: string;
  operacao: string;
  justificativa?: string | null;
  createdAt: string;
  usuarioNome?: string | null;
}

function varianteStatus(status: string): StatusPillVariant {
  if (status === 'cancelado') return 'bloqueado';
  if (status.includes('overbooking')) return 'divergencia';
  if (status === 'finalizado' || status === 'atendido' || status === 'faturado') return 'expedido';
  if (status === 'rascunho') return 'pendente';
  return 'recebido';
}

async function lerJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.text();
    try {
      throw new Error((JSON.parse(body) as { message?: string }).message ?? body);
    } catch (error) {
      if (error instanceof SyntaxError) throw new Error(body || `Falha HTTP ${response.status}`);
      throw error;
    }
  }
  return response.json() as Promise<T>;
}

function HistoricoEntry({
  titulo,
  detalhe,
  data,
}: {
  titulo: string;
  detalhe: string;
  data: string;
}) {
  return (
    <ActivityItem
      userName={titulo}
      initials="AC"
      activity={detalhe}
      time={new Date(data).toLocaleString('pt-BR')}
    />
  );
}

export function PedidosClient({ permissoes }: PedidosClientProps) {
  const [pedidos, setPedidos] = useState<PedidoVenda[]>([]);
  const [clientes, setClientes] = useState<ClientePedido[]>([]);
  const [produtos, setProdutos] = useState<ProdutoPedido[]>([]);
  const [compras, setCompras] = useState<CompraProgramada[]>([]);
  const [pedidoSelecionado, setPedidoSelecionado] = useState<PedidoVendaDetalhe | null>(null);
  const [modoEditor, setModoEditor] = useState(false);
  const [busca, setBusca] = useState('');
  const [statusFiltro, setStatusFiltro] = useState('todos');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [adendos, setAdendos] = useState<AdendoPedido[]>([]);
  const [auditoria, setAuditoria] = useState<AuditoriaPedido[]>([]);
  const [liberarPedidoId, setLiberarPedidoId] = useState<string | null>(null);
  const [liberando, setLiberando] = useState(false);

  const podeGerenciar = permissoes.includes('PEDIDOS_GERENCIAR');
  const podeFinalizar = permissoes.includes('PEDIDO_FINALIZAR') || podeGerenciar;
  const podeLiberar = permissoes.includes('PEDIDO_RESERVA_LIBERAR');

  const carregarLista = useCallback(async () => {
    const response = await fetch('/api/comercial/pedidos?pageSize=100', { cache: 'no-store' });
    const page = await lerJson<Paginado<PedidoVenda>>(response);
    setPedidos(page.data);
  }, []);

  const carregarCatalogos = useCallback(async () => {
    const [clientesResponse, produtosResponse, comprasResponse] = await Promise.all([
      fetch('/api/cadastros/clientes?pageSize=100', { cache: 'no-store' }),
      fetch('/api/cadastros/itens-comerciais?pageSize=100', { cache: 'no-store' }),
      fetch('/api/comercial/compras-programadas?pageSize=100', { cache: 'no-store' }),
    ]);
    const [clientesPage, produtosPage, comprasPage] = await Promise.all([
      lerJson<Paginado<ClientePedido>>(clientesResponse),
      lerJson<Paginado<ProdutoPedido>>(produtosResponse),
      lerJson<Paginado<CompraProgramada>>(comprasResponse),
    ]);
    setClientes(clientesPage.data);
    setProdutos(produtosPage.data);
    setCompras(comprasPage.data.filter((compra) => compra.status !== 'cancelada'));
  }, []);

  const carregarHistorico = useCallback(async (pedidoId: string) => {
    const [adendosResponse, auditoriaResponse] = await Promise.all([
      fetch(`/api/comercial/pedidos/${pedidoId}/adendos`, { cache: 'no-store' }),
      fetch(`/api/admin/auditoria?registroId=${pedidoId}&pageSize=50`, { cache: 'no-store' }),
    ]);
    if (adendosResponse.ok) setAdendos(await adendosResponse.json() as AdendoPedido[]);
    if (auditoriaResponse.ok) {
      const page = await auditoriaResponse.json() as Paginado<AuditoriaPedido>;
      setAuditoria(page.data);
    }
  }, []);

  const carregarDetalhe = useCallback(async (pedidoId: string) => {
    const response = await fetch(`/api/comercial/pedidos/${pedidoId}`, { cache: 'no-store' });
    const detalhe = await lerJson<PedidoVendaDetalhe>(response);
    setPedidoSelecionado(detalhe);
    await carregarHistorico(pedidoId);
  }, [carregarHistorico]);

  const carregarTudo = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      await Promise.all([carregarLista(), carregarCatalogos()]);
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Falha ao carregar pedidos.');
    } finally {
      setCarregando(false);
    }
  }, [carregarCatalogos, carregarLista]);

  useEffect(() => {
    void carregarTudo();
  }, [carregarTudo]);

  useEffect(() => {
    const onMessage = (msg: RealtimeMensagem) => {
      if (msg.type !== 'adendo_registrado' && msg.type !== 'reserva_liberada_admin') return;
      void carregarLista();
      if (pedidoSelecionado) void carregarDetalhe(pedidoSelecionado.id);
    };
    return conectarRealtime({
      rooms: ['dashboard'],
      onMessage,
      onReconnect: () => {
        void carregarLista();
        if (pedidoSelecionado) void carregarDetalhe(pedidoSelecionado.id);
      },
    });
  }, [carregarDetalhe, carregarLista, pedidoSelecionado]);

  const pedidosFiltrados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase('pt-BR');
    return pedidos.filter((pedido) => {
      const cliente = clientes.find((item) => item.id === pedido.clienteId);
      const correspondeBusca = !termo
        || pedido.id.toLocaleLowerCase('pt-BR').includes(termo)
        || cliente?.razaoSocial.toLocaleLowerCase('pt-BR').includes(termo)
        || cliente?.nomeFantasia?.toLocaleLowerCase('pt-BR').includes(termo);
      return correspondeBusca && (statusFiltro === 'todos' || pedido.status === statusFiltro);
    });
  }, [busca, clientes, pedidos, statusFiltro]);

  const contadores = {
    total: pedidos.length,
    rascunhos: pedidos.filter((pedido) => pedido.status === 'rascunho').length,
    overbooking: pedidos.filter((pedido) => pedido.status.includes('overbooking')).length,
    finalizados: pedidos.filter((pedido) => pedido.status === 'finalizado').length,
  };

  async function abrirPedido(pedidoId: string) {
    setErro('');
    try {
      await carregarDetalhe(pedidoId);
      setModoEditor(true);
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Falha ao abrir pedido.');
    }
  }

  async function atualizar(pedidoId?: string) {
    await carregarLista();
    if (pedidoId) await carregarDetalhe(pedidoId);
  }

  async function liberarReserva(justificativa: string) {
    if (!liberarPedidoId) return;
    setLiberando(true);
    try {
      const response = await fetch(`/api/comercial/pedidos/${liberarPedidoId}/liberar-reserva`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ justificativa }),
      });
      if (!response.ok) {
        const body = await response.text();
        throw new Error(body || `Falha HTTP ${response.status}`);
      }
      setLiberarPedidoId(null);
      await carregarLista();
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Falha ao liberar reserva.');
    } finally {
      setLiberando(false);
    }
  }

  if (modoEditor) {
    return (
      <div className="space-y-6">
        <PedidoEditor
          pedido={pedidoSelecionado}
          clientes={clientes}
          produtos={produtos}
          compras={compras}
          podeGerenciar={podeGerenciar}
          podeFinalizar={podeFinalizar}
          onBack={() => {
            setModoEditor(false);
            setPedidoSelecionado(null);
          }}
          onChanged={atualizar}
        />
        {pedidoSelecionado && (adendos.length > 0 || auditoria.length > 0) && (
          <section className="rounded-xl border bg-card p-5">
            <div className="mb-2 flex items-center gap-2">
              <Clock3 className="h-4 w-4 text-muted-foreground" />
              <h2 className="font-semibold">Linha do tempo</h2>
            </div>
            <div className="divide-y">
              {adendos.map((adendo) => (
                <HistoricoEntry
                  key={`adendo-${adendo.id}`}
                  titulo="Adendo registrado"
                  detalhe={`${adendo.quantidadeAdicionada} adicionados — ${adendo.motivo}`}
                  data={adendo.criadoEm}
                />
              ))}
              {auditoria.map((entry) => (
                <HistoricoEntry
                  key={`audit-${entry.id}`}
                  titulo={entry.usuarioNome ?? 'Auditoria'}
                  detalhe={`${entry.operacao}${entry.justificativa ? ` — ${entry.justificativa}` : ''}`}
                  data={entry.createdAt}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Pedidos de Venda</h1>
          <p className="text-sm text-muted-foreground">Acompanhe reservas, overbooking e atendimento comercial.</p>
        </div>
        {podeGerenciar && (
          <Button
            type="button"
            onClick={() => {
              setPedidoSelecionado(null);
              setModoEditor(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Novo pedido
          </Button>
        )}
      </div>

      {erro && (
        <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {erro}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total de pedidos" value={String(contadores.total)} sub="Na visão atual" Icon={ShoppingCart} />
        <KpiCard label="Rascunhos" value={String(contadores.rascunhos)} sub="Com reserva ativa" Icon={Clock3} variant="warning" />
        <KpiCard label="Overbooking" value={String(contadores.overbooking)} sub="Exigem atenção" Icon={ShieldCheck} variant="violet" />
        <KpiCard label="Finalizados" value={String(contadores.finalizados)} sub="Pedidos concluídos" Icon={CalendarDays} variant="success" />
      </div>

      <section className="rounded-xl border bg-card">
        <div className="grid gap-3 border-b p-4 md:grid-cols-[1fr_240px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
              placeholder="Buscar pedido ou cliente..."
              className="pl-9"
            />
          </div>
          <select
            aria-label="Filtrar por status"
            className="h-10 rounded-md border bg-background px-3 text-sm"
            value={statusFiltro}
            onChange={(event) => setStatusFiltro(event.target.value)}
          >
            <option value="todos">Todos os status</option>
            {Object.keys({
              rascunho: true,
              em_elaboracao_reserva_ativa: true,
              aguardando_confirmacao_overbooking: true,
              finalizado: true,
              parcialmente_atendido: true,
              atendido: true,
              faturado: true,
              cancelado: true,
            }).map((status) => (
              <option key={status} value={status}>{rotuloStatusPedido(status, status === 'rascunho')}</option>
            ))}
          </select>
        </div>

        <div className="divide-y">
          {carregando && <p className="p-6 text-sm text-muted-foreground">Carregando pedidos...</p>}
          {!carregando && pedidosFiltrados.length === 0 && (
            <p className="p-6 text-sm text-muted-foreground">Nenhum pedido encontrado.</p>
          )}
          {pedidosFiltrados.map((pedido) => {
            const cliente = clientes.find((item) => item.id === pedido.clienteId);
            const temReservaAtiva = pedido.status === 'rascunho'
              || pedido.status === 'em_elaboracao_reserva_ativa';
            return (
              <article key={pedido.id} className="flex flex-wrap items-center gap-4 p-4">
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  aria-label={`Abrir pedido ${pedido.id}`}
                  onClick={() => void abrirPedido(pedido.id)}
                >
                  <p className="truncate font-semibold">{cliente?.nomeFantasia || cliente?.razaoSocial || pedido.clienteId}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {pedido.id} · {pedido.representanteNome || 'Sem representante'} · {pedido.rotaPrevista || pedido.rotaNome || 'Sem rota'}
                  </p>
                </button>
                <StatusPill
                  variant={varianteStatus(pedido.status)}
                  label={rotuloStatusPedido(pedido.status, temReservaAtiva)}
                />
                {podeLiberar && pedido.status === 'rascunho' && (
                  <Button type="button" variant="outline" size="sm" onClick={() => setLiberarPedidoId(pedido.id)}>
                    Liberar reserva
                  </Button>
                )}
              </article>
            );
          })}
        </div>
      </section>

      {liberarPedidoId && (
        <ModalLiberarReserva
          open
          pedidoId={liberarPedidoId}
          pending={liberando}
          onCancel={() => setLiberarPedidoId(null)}
          onConfirm={(justificativa) => void liberarReserva(justificativa)}
        />
      )}
    </div>
  );
}
