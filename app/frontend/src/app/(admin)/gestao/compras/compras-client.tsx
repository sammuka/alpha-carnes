'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus, Search } from 'lucide-react';
import { BadgeCount } from '@/components/ui/badge-count';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Kpi, KpiStrip } from '@/components/ui/kpi-strip';
import { PageHeader } from '@/components/ui/page-header';
import { SelectNative } from '@/components/ui/select-native';
import { StatusPill } from '@/components/ui/status-pill';
import {
  Table,
  TableBody,
  TableCell,
  TableCellCode,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { extrairMensagemErro } from '@/lib/error-message';
import { conectarRealtime } from '@/lib/realtime';
import type {
  CompraProgramada,
  CompraProgramadaDetalhe,
  DisponibilidadeDia,
  Paginado,
} from '@/lib/comercial';
import { CompraEditor } from './compra-editor';
import {
  type CadastroItem,
  formatarDataOperacao,
  hojeISO,
  nomeFornecedor,
  ROTULO_COMPRA,
  rotuloLote,
  STATUS_COMPRA,
  statusCompraVariant,
} from './compras-shared';

const EVENTOS_COMPRA = new Set([
  'compra_programada_criada',
  'compra_programada_atualizada',
  'compra_programada_cancelada',
  'compra_programada_confirmada',
  'disponibilidade_virtual_gerada',
  'compra_programada_alterada_impacto',
]);

async function lerJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.text();
    try {
      throw new Error(extrairMensagemErro(JSON.parse(body), body));
    } catch (error) {
      if (error instanceof SyntaxError) throw new Error(body || `Falha HTTP ${response.status}`);
      throw error;
    }
  }
  return response.json() as Promise<T>;
}

function lotesDoDia(compras: CompraProgramada[], data: string): CompraProgramada[] {
  return compras
    .filter((compra) => compra.dataOperacao === data)
    .sort((a, b) => a.numeroSequencial - b.numeroSequencial);
}

export function ComprasClient({ permissoes }: { permissoes: string[] }) {
  const podeLer = permissoes.includes('COMPRAS_PROGRAMADAS_LER');
  const podeGerenciar = permissoes.includes('COMPRAS_PROGRAMADAS_GERENCIAR');

  const router = useRouter();
  const searchParams = useSearchParams();
  const dataDaUrl = searchParams.get('dataOperacao') ?? searchParams.get('data');
  const compraIdUrl = searchParams.get('compraId');
  const novoUrl = searchParams.get('novo') === '1';

  const [modo, setModo] = useState<'lista' | 'criar' | 'visualizar'>(
    compraIdUrl ? 'visualizar' : novoUrl ? 'criar' : 'lista',
  );
  const [compras, setCompras] = useState<CompraProgramada[]>([]);
  const [compra, setCompra] = useState<CompraProgramadaDetalhe | null>(null);
  const [fornecedores, setFornecedores] = useState<CadastroItem[]>([]);
  const [itensCompra, setItensCompra] = useState<CadastroItem[]>([]);
  const [disponibilidade, setDisponibilidade] = useState<DisponibilidadeDia[]>([]);
  const [disponibilidadeTotal, setDisponibilidadeTotal] = useState<DisponibilidadeDia[]>([]);
  const [dataOperacao, setDataOperacao] = useState(
    dataDaUrl && /^\d{4}-\d{2}-\d{2}$/.test(dataDaUrl) ? dataDaUrl : hojeISO(),
  );
  const [busca, setBusca] = useState('');
  const [statusFiltro, setStatusFiltro] = useState('todos');
  const [dataOperacaoFiltro, setDataOperacaoFiltro] = useState(
    dataDaUrl && /^\d{4}-\d{2}-\d{2}$/.test(dataDaUrl) ? dataDaUrl : 'todas',
  );
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);

  const navegar = useCallback((data?: string, compraId?: string | null) => {
    const qs = new URLSearchParams();
    if (data) qs.set('dataOperacao', data);
    if (compraId) qs.set('compraId', compraId);
    const texto = qs.toString();
    router.replace(texto ? `/gestao/compras?${texto}` : '/gestao/compras');
  }, [router]);

  const carregarCadastros = useCallback(async () => {
    const [fRes, iRes] = await Promise.all([
      fetch('/api/cadastros/fornecedores?pageSize=100', { cache: 'no-store' }),
      fetch('/api/cadastros/produtos?page=1&pageSize=100&status=ativo&ativoCompra=true', { cache: 'no-store' }),
    ]);
    if (fRes.ok) {
      const f = (await fRes.json()) as Paginado<CadastroItem>;
      setFornecedores(f.data);
    }
    if (iRes.ok) {
      const i = (await iRes.json()) as Paginado<CadastroItem>;
      setItensCompra(i.data);
    }
  }, []);

  const carregarLista = useCallback(async () => {
    if (!podeLer) return;
    const res = await fetch('/api/comercial/compras-programadas?pageSize=100', { cache: 'no-store' });
    const pag = await lerJson<Paginado<CompraProgramada>>(res);
    setCompras(pag.data);
    return pag.data;
  }, [podeLer]);

  const carregarDisponibilidade = useCallback(async (detalhe: CompraProgramadaDetalhe | null) => {
    if (!detalhe) {
      setDisponibilidade([]);
      setDisponibilidadeTotal([]);
      return;
    }
    const [resLote, resTotal] = await Promise.all([
      fetch(`/api/comercial/disponibilidade?compraProgramadaId=${detalhe.id}`, { cache: 'no-store' }),
      fetch(`/api/comercial/disponibilidade?dataOperacao=${encodeURIComponent(detalhe.dataOperacao)}`, { cache: 'no-store' }),
    ]);
    setDisponibilidade(resLote.ok ? (await resLote.json()) as DisponibilidadeDia[] : []);
    setDisponibilidadeTotal(resTotal.ok ? (await resTotal.json()) as DisponibilidadeDia[] : []);
  }, []);

  const abrirCompra = useCallback(async (compraId: string, lista?: CompraProgramada[]) => {
    const res = await fetch(`/api/comercial/compras-programadas/${compraId}`, { cache: 'no-store' });
    const detalhe = await lerJson<CompraProgramadaDetalhe>(res);
    setCompra(detalhe);
    setDataOperacao(detalhe.dataOperacao);
    setModo('visualizar');
    navegar(detalhe.dataOperacao, detalhe.id);
    await carregarDisponibilidade(detalhe);
    return { detalhe, lista: lista ?? compras };
  }, [carregarDisponibilidade, compras, navegar]);

  const abrirPrimeiroLote = useCallback(async (data: string, lista?: CompraProgramada[]) => {
    const origem = lista ?? compras;
    const primeiro = lotesDoDia(origem, data)[0];
    if (!primeiro) {
      setCompra(null);
      setDataOperacao(data);
      setModo('visualizar');
      setDisponibilidade([]);
      setDisponibilidadeTotal([]);
      navegar(data);
      return;
    }
    await abrirCompra(primeiro.id, origem);
  }, [abrirCompra, compras, navegar]);

  const carregarTudo = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      const [, lista] = await Promise.all([carregarCadastros(), carregarLista()]);
      if (compraIdUrl && lista) {
        await abrirCompra(compraIdUrl, lista);
      }
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Falha ao carregar compras.');
    } finally {
      setCarregando(false);
    }
  }, [abrirCompra, carregarCadastros, carregarLista, compraIdUrl]);

  useEffect(() => {
    void carregarTudo();
    // Deep-link só na montagem; recargas posteriores passam por onChanged / realtime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const operacaoIdRealtime = compra?.operacaoId ?? compras[0]?.operacaoId;

  useEffect(() => {
    if (!operacaoIdRealtime) return;
    return conectarRealtime({
      rooms: [`operacao:${operacaoIdRealtime}`],
      onMessage: (msg) => {
        if (!EVENTOS_COMPRA.has(msg.type)) return;
        void carregarLista();
        if (compra) void abrirCompra(compra.id);
      },
      onReconnect: () => {
        void carregarLista();
        if (compra) void abrirCompra(compra.id);
      },
    });
  }, [abrirCompra, carregarLista, compra, operacaoIdRealtime]);

  const datasOperacaoDisponiveis = useMemo(() => {
    const datas = new Set(compras.map((item) => item.dataOperacao).filter(Boolean));
    if (dataDaUrl && /^\d{4}-\d{2}-\d{2}$/.test(dataDaUrl)) datas.add(dataDaUrl);
    return [...datas].sort((a, b) => b.localeCompare(a));
  }, [compras, dataDaUrl]);

  const comprasFiltradas = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase('pt-BR');
    return compras.filter((item) => {
      const fornecedor = nomeFornecedor(item).toLocaleLowerCase('pt-BR');
      const lote = rotuloLote(item.numeroSequencial).toLocaleLowerCase('pt-BR');
      const referencia = (item.referenciaExterna ?? '').toLocaleLowerCase('pt-BR');
      const correspondeBusca = !termo
        || item.id.toLocaleLowerCase('pt-BR').includes(termo)
        || fornecedor.includes(termo)
        || lote.includes(termo)
        || referencia.includes(termo);
      const correspondeStatus = statusFiltro === 'todos' || item.status === statusFiltro;
      const correspondeData = dataOperacaoFiltro === 'todas' || item.dataOperacao === dataOperacaoFiltro;
      return correspondeBusca && correspondeStatus && correspondeData;
    });
  }, [busca, compras, dataOperacaoFiltro, statusFiltro]);

  const blocosPorData = useMemo(() => {
    const mapa = new Map<string, CompraProgramada[]>();
    for (const item of comprasFiltradas) {
      const chave = item.dataOperacao ?? '';
      const lista = mapa.get(chave);
      if (lista) lista.push(item);
      else mapa.set(chave, [item]);
    }
    return [...mapa.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([data, itens]) => ({
        data,
        itens: [...itens].sort((a, b) => a.numeroSequencial - b.numeroSequencial),
      }));
  }, [comprasFiltradas]);

  const contadores = {
    total: compras.length,
    rascunhos: compras.filter((item) => item.status === 'rascunho').length,
    negociacao: compras.filter((item) => item.status === 'em_negociacao').length,
    confirmadas: compras.filter((item) => item.status === 'confirmada').length,
  };

  const lotes = useMemo(
    () => lotesDoDia(compras, compra?.dataOperacao ?? dataOperacao),
    [compra?.dataOperacao, compras, dataOperacao],
  );

  async function atualizar(compraId?: string) {
    const lista = await carregarLista();
    if (compraId) {
      await abrirCompra(compraId, lista);
      return;
    }
    if (modo === 'visualizar') {
      await abrirPrimeiroLote(dataOperacao, lista);
    }
  }

  if (!podeLer) {
    return <p className="text-sm text-destructive">Você não tem permissão para visualizar compras programadas.</p>;
  }

  if (modo !== 'lista') {
    return (
      <CompraEditor
        modo={modo === 'criar' ? 'criar' : 'visualizar'}
        compra={modo === 'criar' ? null : compra}
        lotes={lotes}
        fornecedores={fornecedores}
        itensCompra={itensCompra}
        dataOperacao={modo === 'criar' ? (dataOperacaoFiltro !== 'todas' ? dataOperacaoFiltro : hojeISO()) : dataOperacao}
        disponibilidade={disponibilidade}
        disponibilidadeTotal={disponibilidadeTotal}
        podeGerenciar={podeGerenciar}
        onBack={() => {
          setModo('lista');
          setCompra(null);
          setDisponibilidade([]);
          setDisponibilidadeTotal([]);
          navegar(dataOperacaoFiltro !== 'todas' ? dataOperacaoFiltro : undefined);
          void carregarLista();
        }}
        onChanged={atualizar}
        onSelectLote={(id) => void abrirCompra(id)}
        onMudarData={(proxima) => {
          setDataOperacao(proxima);
          void (async () => {
            const lista = await carregarLista();
            await abrirPrimeiroLote(proxima, lista);
          })();
        }}
        onNovo={() => {
          setCompra(null);
          setModo('criar');
          navegar(dataOperacao);
        }}
      />
    );
  }

  return (
    <div className="space-y-3">
      <PageHeader
        title="Pedidos de Compra"
        subtitle="Acompanhe rascunhos, lotes e disponibilidade virtual"
      >
        <SelectNative
          aria-label="Filtrar por data de operação"
          selectSize="sm"
          className="w-[190px]"
          value={dataOperacaoFiltro}
          onChange={(event) => setDataOperacaoFiltro(event.target.value)}
        >
          <option value="todas">Todas as datas</option>
          {datasOperacaoDisponiveis.map((data) => (
            <option key={data} value={data}>{formatarDataOperacao(data)}</option>
          ))}
        </SelectNative>
        {podeGerenciar && (
          <Button
            type="button"
            onClick={() => {
              setCompra(null);
              setModo('criar');
              navegar(dataOperacaoFiltro !== 'todas' ? dataOperacaoFiltro : hojeISO());
              void carregarCadastros();
            }}
          >
            <Plus />
            Novo pedido de compra
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
        <Kpi label="Rascunhos" value={contadores.rascunhos} hint="ainda não confirmados" tone="default" />
        <Kpi label="Em negociação" value={contadores.negociacao} hint="exige acompanhamento" tone="alert" />
        <Kpi label="Confirmados" value={contadores.confirmadas} hint="disponibilidade gerada" tone="ok" />
      </KpiStrip>

      <Card>
        <CardHeader>
          <CardTitle>Pedidos</CardTitle>
          <BadgeCount>{comprasFiltradas.length}</BadgeCount>
          <CardAction>
            <div className="w-[240px]">
              <Input
                value={busca}
                onChange={(event) => setBusca(event.target.value)}
                placeholder="Buscar pedido ou fornecedor..."
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
              {STATUS_COMPRA.map((status) => (
                <option key={status} value={status}>{ROTULO_COMPRA[status]}</option>
              ))}
            </SelectNative>
          </CardAction>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Fornecedor</TableHead>
                <TableHead>Lote</TableHead>
                <TableHead>Referência</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {carregando && (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-xs text-muted-foreground">
                    Carregando pedidos...
                  </TableCell>
                </TableRow>
              )}
              {!carregando && comprasFiltradas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-xs text-muted-foreground">
                    Nenhum pedido encontrado.
                  </TableCell>
                </TableRow>
              )}
              {blocosPorData.map((bloco) => (
                <Fragment key={bloco.data || 'sem-data'}>
                  <TableRow className="bg-surface-2 hover:bg-surface-2">
                    <TableCell colSpan={5} className="h-7 text-[11px] font-bold uppercase tracking-[0.04em] text-muted-foreground">
                      {formatarDataOperacao(bloco.data)}
                    </TableCell>
                  </TableRow>
                  {bloco.itens.map((item) => (
                    <TableRow
                      key={item.id}
                      className="group cursor-pointer"
                      onClick={() => void abrirCompra(item.id)}
                    >
                      <TableCell className="text-[13px] font-semibold text-foreground">
                        {nomeFornecedor(item)}
                      </TableCell>
                      <TableCellCode>{rotuloLote(item.numeroSequencial)}</TableCellCode>
                      <TableCell className="text-muted-foreground">
                        {item.referenciaExterna || '—'}
                      </TableCell>
                      <TableCell>
                        <StatusPill
                          variant={statusCompraVariant(item.status)}
                          label={ROTULO_COMPRA[item.status] ?? item.status}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            aria-label={`Abrir pedido ${item.id}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              void abrirCompra(item.id);
                            }}
                          >
                            Abrir
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
