'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Clock3, Plus, Search } from 'lucide-react';
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
import { BadgeCount } from '@/components/ui/badge-count';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Kpi, KpiStrip } from '@/components/ui/kpi-strip';
import { PageHeader } from '@/components/ui/page-header';
import { SelectNative } from '@/components/ui/select-native';
import { StatusPill, type StatusPillVariant } from '@/components/ui/status-pill';
import {
  Table,
  TableBody,
  TableCell,
  TableCellCode,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
      <div className="space-y-3">
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
          <Card>
            <CardHeader>
              <Clock3 className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              <CardTitle>Linha do tempo</CardTitle>
              <BadgeCount>{adendos.length + auditoria.length}</BadgeCount>
            </CardHeader>
            <CardContent className="p-0">
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
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <PageHeader
        title="Pedidos de Venda"
        subtitle="Acompanhe reservas, overbooking e atendimento comercial"
      >
        {podeGerenciar && (
          <Button
            type="button"
            onClick={() => {
              setPedidoSelecionado(null);
              setModoEditor(true);
            }}
          >
            <Plus />
            Novo pedido
          </Button>
        )}
      </PageHeader>

      {erro && (
        <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {erro}
        </div>
      )}

      <KpiStrip>
        <Kpi label="Total de pedidos" value={contadores.total} hint="na visão atual" tone="default" />
        <Kpi label="Rascunhos" value={contadores.rascunhos} hint="com reserva ativa" tone="default" />
        <Kpi label="Overbooking" value={contadores.overbooking} hint="exige atenção" tone="alert" />
        <Kpi label="Finalizados" value={contadores.finalizados} hint="pedidos concluídos" tone="ok" />
      </KpiStrip>

      <Card>
        <CardHeader>
          <CardTitle>Pedidos</CardTitle>
          <BadgeCount>{pedidosFiltrados.length}</BadgeCount>
          <CardAction>
            <div className="w-[240px]">
              <Input
                value={busca}
                onChange={(event) => setBusca(event.target.value)}
                placeholder="Buscar pedido ou cliente..."
                adornLeft={<Search />}
                className="h-7 text-xs"
              />
            </div>
            <SelectNative
              aria-label="Filtrar por status"
              selectSize="sm"
              className="w-[170px]"
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
            </SelectNative>
          </CardAction>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Pedido</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Representante</TableHead>
                <TableHead>Rota</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {carregando && (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-xs text-muted-foreground">
                    Carregando pedidos...
                  </TableCell>
                </TableRow>
              )}
              {!carregando && pedidosFiltrados.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-xs text-muted-foreground">
                    Nenhum pedido encontrado.
                  </TableCell>
                </TableRow>
              )}
              {pedidosFiltrados.map((pedido) => {
                const cliente = clientes.find((item) => item.id === pedido.clienteId);
                const temReservaAtiva = pedido.status === 'rascunho'
                  || pedido.status === 'em_elaboracao_reserva_ativa';
                return (
                  <TableRow
                    key={pedido.id}
                    className="group cursor-pointer"
                    onClick={() => void abrirPedido(pedido.id)}
                  >
                    <TableCellCode>{pedido.id.slice(0, 8).toUpperCase()}</TableCellCode>
                    <TableCell className="text-[13px] font-semibold text-foreground">
                      {cliente?.nomeFantasia || cliente?.razaoSocial || pedido.clienteId}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {pedido.representanteNome || 'Sem representante'}
                    </TableCell>
                    <TableCellCode>{pedido.rotaPrevista || pedido.rotaNome || '—'}</TableCellCode>
                    <TableCell>
                      <StatusPill
                        variant={varianteStatus(pedido.status)}
                        label={rotuloStatusPedido(pedido.status, temReservaAtiva)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          aria-label={`Abrir pedido ${pedido.id}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            void abrirPedido(pedido.id);
                          }}
                        >
                          Abrir
                        </Button>
                        {podeLiberar && pedido.status === 'rascunho' && (
                          <Button
                            type="button"
                            variant="destructiveOutline"
                            size="sm"
                            onClick={(event) => {
                              event.stopPropagation();
                              setLiberarPedidoId(pedido.id);
                            }}
                          >
                            Liberar reserva
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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
