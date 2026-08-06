'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Filter, Search } from 'lucide-react';
import type { DisponibilidadeDia } from '@/lib/comercial';
import type { DetalheMapa, EstadoMapa, MapaProduto } from '@/lib/mapa-disponibilidade';
import { conectarRealtime, type RealtimeMensagem } from '@/lib/realtime';
import { AlertItem } from '@/components/ui/alert-item';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DatePickerField } from '@/components/ui/date-picker-field';
import { FilterChip } from '@/components/ui/filter-chip';
import { Input } from '@/components/ui/input';
import { Kpi, KpiStrip } from '@/components/ui/kpi-strip';
import { PageHeader } from '@/components/ui/page-header';
import { Progress } from '@/components/ui/progress';
import { StatusPill } from '@/components/ui/status-pill';
import {
  Table,
  TableBody,
  TableCell,
  TableCellNum,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { DetalheUnidade } from './detalhe-unidade';
import { MapaTeatro } from './mapa-teatro';

function hojeISO(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function soma(linhas: DisponibilidadeDia[], campo: keyof DisponibilidadeDia): number {
  return linhas.reduce((acc, linha) => acc + Number(linha[campo] ?? 0), 0);
}

async function lerResposta<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const texto = await response.text();
    try {
      throw new Error((JSON.parse(texto) as { message?: string }).message ?? texto);
    } catch (error) {
      if (error instanceof SyntaxError) throw new Error(texto || `Falha HTTP ${response.status}`);
      throw error;
    }
  }
  return response.json() as Promise<T>;
}

export default function DisponibilidadePage() {
  const [dataOperacao, setDataOperacao] = useState(hojeISO());
  const [abaAtiva, setAbaAtiva] = useState<'mapa' | 'grade'>('mapa');
  const [linhas, setLinhas] = useState<DisponibilidadeDia[]>([]);
  const [mapa, setMapa] = useState<MapaProduto[]>([]);
  const [operacaoId, setOperacaoId] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [status, setStatus] = useState<'conectado' | 'desconectado'>('desconectado');
  const [produtoDetalhe, setProdutoDetalhe] = useState<MapaProduto | null>(null);
  const [estadoDetalhe, setEstadoDetalhe] = useState<EstadoMapa | null>(null);
  const [unidadesDetalhe, setUnidadesDetalhe] = useState<DetalheMapa[]>([]);
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false);

  const carregarMapa = useCallback(async (id: string) => {
    const response = await fetch(
      `/api/comercial/disponibilidade/mapa?operacaoId=${encodeURIComponent(id)}`,
      { cache: 'no-store' },
    );
    setMapa(await lerResposta<MapaProduto[]>(response));
  }, []);

  const refetch = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const response = await fetch(
        `/api/comercial/disponibilidade?dataOperacao=${encodeURIComponent(dataOperacao)}`,
        { cache: 'no-store' },
      );
      const grade = await lerResposta<DisponibilidadeDia[]>(response);
      setLinhas(grade);
      const id = grade[0]?.operacaoId ?? null;
      setOperacaoId(id);
      if (id) await carregarMapa(id);
      else setMapa([]);
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao carregar disponibilidade.');
    } finally {
      setCarregando(false);
    }
  }, [carregarMapa, dataOperacao]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  useEffect(() => {
    const onMessage = (msg: RealtimeMensagem) => {
      if (msg.type === 'reserva_disponibilidade_atualizada') {
        const payload = msg.payload as {
          disponibilidadeId: string;
          quantidadeReservada: string;
          quantidadeDisponivel: string;
        };
        setLinhas((atuais) => atuais.map((linha) =>
          linha.id === payload.disponibilidadeId
            ? {
                ...linha,
                quantidadeReservada: payload.quantidadeReservada,
                quantidadeDisponivel: payload.quantidadeDisponivel,
              }
            : linha));
        if (operacaoId) void carregarMapa(operacaoId);
        return;
      }
      if (
        msg.type === 'disponibilidade_virtual_gerada'
        || msg.type === 'recebimento_registrado'
        || msg.type === 'adendo_registrado'
      ) {
        void refetch();
      }
    };
    return conectarRealtime({
      rooms: ['dashboard', ...(operacaoId ? [`operacao:${dataOperacao}`] : [])],
      onMessage,
      onReconnect: () => void refetch(),
      onStatus: setStatus,
    });
  }, [carregarMapa, dataOperacao, operacaoId, refetch]);

  async function selecionarEstado(produto: MapaProduto, estado: EstadoMapa) {
    setProdutoDetalhe(produto);
    setEstadoDetalhe(estado);
    setUnidadesDetalhe([]);
    if (!operacaoId) return;
    setCarregandoDetalhe(true);
    setErro(null);
    try {
      const query = new URLSearchParams({ operacaoId, estado });
      const response = await fetch(
        `/api/comercial/disponibilidade/mapa/${produto.itemComercialId}/detalhe?${query.toString()}`,
        { cache: 'no-store' },
      );
      setUnidadesDetalhe(await lerResposta<DetalheMapa[]>(response));
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Falha ao carregar o detalhe do mapa.');
    } finally {
      setCarregandoDetalhe(false);
    }
  }

  const filtradas = useMemo(() => {
    if (!busca.trim()) return linhas;
    const termo = busca.toLocaleLowerCase('pt-BR');
    return linhas.filter((linha) => {
      const produto = mapa.find((item) => item.itemComercialId === linha.itemComercialId);
      return linha.itemComercialId.toLocaleLowerCase('pt-BR').includes(termo)
        || linha.status.toLocaleLowerCase('pt-BR').includes(termo)
        || produto?.descricao.toLocaleLowerCase('pt-BR').includes(termo)
        || produto?.codigo.toLocaleLowerCase('pt-BR').includes(termo);
    });
  }, [busca, linhas, mapa]);

  const esgotados = linhas.filter((linha) => Number(linha.quantidadeDisponivel) <= 0);
  const resumo = {
    total: soma(linhas, 'quantidadeTotalGerada'),
    reservado: soma(linhas, 'quantidadeReservada'),
    disponivel: soma(linhas, 'quantidadeDisponivel'),
    recebido: soma(linhas, 'quantidadeRecebida'),
  };

  return (
    <div className="space-y-3">
      <PageHeader
        title="Disponibilidade"
        subtitle="Leitura do saldo físico, virtual e comprometido por produto."
        live={status === 'conectado'}
      >
        <FilterChip active={abaAtiva === 'mapa'} onClick={() => setAbaAtiva('mapa')}>
          Mapa de Disponibilidade
        </FilterChip>
        <FilterChip active={abaAtiva === 'grade'} onClick={() => setAbaAtiva('grade')}>
          Grade
        </FilterChip>
      </PageHeader>

      <Card>
        <CardContent className="flex items-center gap-2 px-3 py-2">
          <span className="text-xs font-semibold">Data operacional</span>
          <DatePickerField value={dataOperacao} onChange={setDataOperacao} />
          <Button type="button" variant="secondary" size="sm" onClick={() => setBusca('')}>
            <Filter />
            Limpar filtros
          </Button>
        </CardContent>
      </Card>

      {erro && (
        <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {erro}
        </div>
      )}

      {abaAtiva === 'mapa' ? (
        <div className="grid gap-2.5 xl:grid-cols-[1fr_320px]">
          <div>
            {carregando ? (
              <p className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">Carregando mapa...</p>
            ) : (
              <MapaTeatro
                produtos={mapa}
                selecionado={produtoDetalhe && estadoDetalhe
                  ? { itemComercialId: produtoDetalhe.itemComercialId, estado: estadoDetalhe }
                  : null}
                onSelecionar={(produto, estado) => void selecionarEstado(produto, estado)}
              />
            )}
          </div>
          <DetalheUnidade
            produto={produtoDetalhe}
            estado={estadoDetalhe}
            unidades={unidadesDetalhe}
            carregando={carregandoDetalhe}
          />
        </div>
      ) : (
        <>
          <KpiStrip>
            <Kpi label="Total gerado" value={carregando ? '…' : resumo.total.toFixed(0)} hint="Previsto do dia" />
            <Kpi label="Reservado" value={carregando ? '…' : resumo.reservado.toFixed(0)} hint="Pedidos confirmados" />
            <Kpi label="Disponível (livre)" value={carregando ? '…' : resumo.disponivel.toFixed(0)} hint="Pronto para venda" />
            <Kpi label="Recebido" value={carregando ? '…' : resumo.recebido.toFixed(0)} hint="Em planta" />
            <Kpi label="Esgotados" value={carregando ? '…' : `${esgotados.length} itens`} hint="Sem cobertura" tone="alert" />
          </KpiStrip>

          <div className="grid gap-2.5 lg:grid-cols-12">
            <Card className="lg:col-span-8">
              <CardHeader>
                <CardTitle>Grade de produtos</CardTitle>
                <CardAction>
                  <Input
                    adornLeft={<Search />}
                    placeholder="Buscar item..."
                    className="h-7 w-[220px] text-xs"
                    value={busca}
                    onChange={(event) => setBusca(event.target.value)}
                  />
                </CardAction>
              </CardHeader>
              <CardContent className="p-0">
                {carregando ? (
                  <p className="p-6 text-sm text-muted-foreground">Carregando...</p>
                ) : filtradas.length === 0 ? (
                  <p className="p-6 text-sm text-muted-foreground">Nenhuma disponibilidade para esta data.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>Item comercial</TableHead>
                        <TableHead className="text-right">Gerado</TableHead>
                        <TableHead className="text-right">Reservado</TableHead>
                        <TableHead className="text-right">Disponível</TableHead>
                        <TableHead className="text-right">Recebido</TableHead>
                        <TableHead>Ocupação</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtradas.map((linha) => {
                        const total = Number(linha.quantidadeTotalGerada);
                        const reservado = Number(linha.quantidadeReservada);
                        const disponivel = Number(linha.quantidadeDisponivel);
                        const percentual = total > 0
                          ? Math.min(100, Math.round((reservado / total) * 100))
                          : 0;
                        const produto = mapa.find((item) => item.itemComercialId === linha.itemComercialId);
                        return (
                          <TableRow key={linha.id} data-testid={`disp-${linha.id}`}>
                            <TableCell>
                              <p className="text-[13px] font-semibold text-foreground">{produto?.descricao ?? linha.itemComercialId}</p>
                              {produto && <p className="font-data text-[11px] text-fg-secondary">{produto.codigo}</p>}
                            </TableCell>
                            <TableCellNum>{linha.quantidadeTotalGerada}</TableCellNum>
                            <TableCellNum>{linha.quantidadeReservada}</TableCellNum>
                            <TableCellNum
                              className={disponivel <= 0 ? 'text-danger-fg' : 'text-success-fg'}
                              data-testid={`disp-${linha.id}-disponivel`}
                            >
                              {linha.quantidadeDisponivel}
                            </TableCellNum>
                            <TableCellNum data-testid={`disp-${linha.id}-recebido`}>
                              {linha.quantidadeRecebida}
                            </TableCellNum>
                            <TableCell className="min-w-36">
                              <div className="space-y-1">
                                <div className="flex justify-between text-[11px] text-muted-foreground">
                                  <span>{percentual}% reservado</span>
                                  {disponivel <= 0 && <StatusPill variant="divergencia" label="ESGOTADO" />}
                                </div>
                                <Progress value={percentual} className="h-1.5" />
                              </div>
                            </TableCell>
                            <TableCell>{linha.status}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card className="border-t-4 border-t-status-divergencia lg:col-span-4">
              <CardHeader>
                <AlertCircle className="size-4 text-status-divergencia" />
                <CardTitle>Alertas & impactos</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {esgotados.length === 0 ? (
                  <p className="p-3 text-sm text-muted-foreground">Nenhum item esgotado no momento.</p>
                ) : (
                  esgotados.map((linha) => (
                    <AlertItem
                      key={linha.id}
                      title="Item esgotado"
                      description={`Reservado: ${linha.quantidadeReservada} / Gerado: ${linha.quantidadeTotalGerada}`}
                      time=""
                      variant="divergencia"
                    />
                  ))
                )}
                {linhas.some((linha) => Number(linha.quantidadeComDivergencia) > 0) && (
                  <div className="border-t border-border p-3 text-sm">
                    <p className="font-semibold">Divergências no recebimento</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {linhas.filter((linha) => Number(linha.quantidadeComDivergencia) > 0).length} item(ns) com quantidade divergente registrada.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
