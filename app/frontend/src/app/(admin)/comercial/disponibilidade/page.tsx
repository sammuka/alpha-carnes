'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Filter,
  LayoutGrid,
  PackageCheck,
  PackageSearch,
  Scale,
  Table2,
  TrendingUp,
} from 'lucide-react';
import type { DisponibilidadeDia } from '@/lib/comercial';
import type { DetalheMapa, EstadoMapa, MapaProduto } from '@/lib/mapa-disponibilidade';
import { conectarRealtime, type RealtimeMensagem } from '@/lib/realtime';
import { AlertItem } from '@/components/ui/alert-item';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { KpiCard } from '@/components/ui/kpi-card';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { StatusPill } from '@/components/ui/status-pill';
import {
  Table,
  TableBody,
  TableCell,
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
  const cards = [
    { label: 'Total gerado', value: resumo.total.toFixed(0), sub: 'Previsto do dia', variant: 'primary' as const, Icon: PackageCheck },
    { label: 'Reservado', value: resumo.reservado.toFixed(0), sub: 'Pedidos confirmados', variant: 'violet' as const, Icon: Scale },
    { label: 'Disponível (livre)', value: resumo.disponivel.toFixed(0), sub: 'Pronto para venda', variant: 'success' as const, Icon: TrendingUp },
    { label: 'Recebido', value: resumo.recebido.toFixed(0), sub: 'Em planta', variant: 'warning' as const, Icon: PackageSearch },
    { label: 'Esgotados', value: `${esgotados.length} itens`, sub: 'Sem cobertura', variant: 'warning' as const, Icon: AlertTriangle },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Disponibilidade</h1>
          <p className="text-sm text-muted-foreground">
            Leitura do saldo físico, virtual e comprometido por produto.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill
            variant={status === 'conectado' ? 'expedido' : 'pendente'}
            label={status === 'conectado' ? 'tempo real' : 'reconectando'}
          />
          <div className="inline-flex rounded-lg bg-muted p-1">
            <Button
              type="button"
              size="sm"
              variant={abaAtiva === 'mapa' ? 'default' : 'ghost'}
              onClick={() => setAbaAtiva('mapa')}
            >
              <LayoutGrid className="mr-2 h-4 w-4" />
              Mapa de Disponibilidade
            </Button>
            <Button
              type="button"
              size="sm"
              variant={abaAtiva === 'grade' ? 'default' : 'ghost'}
              onClick={() => setAbaAtiva('grade')}
            >
              <Table2 className="mr-2 h-4 w-4" />
              Grade
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-3">
        <Label htmlFor="data">Data operacional</Label>
        <Input
          id="data"
          type="date"
          value={dataOperacao}
          onChange={(event) => setDataOperacao(event.target.value)}
          className="w-auto"
        />
        <Button type="button" variant="outline" size="sm" onClick={() => setBusca('')}>
          <Filter className="mr-1 h-4 w-4" />
          Limpar filtros
        </Button>
      </div>

      {erro && (
        <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {erro}
        </div>
      )}

      {abaAtiva === 'mapa' ? (
        <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
          <div>
            {carregando ? (
              <p className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">Carregando mapa...</p>
            ) : (
              <MapaTeatro produtos={mapa} onSelecionar={(produto, estado) => void selecionarEstado(produto, estado)} />
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
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            {cards.map((card) => (
              <KpiCard
                key={card.label}
                label={card.label}
                value={carregando ? '…' : card.value}
                sub={card.sub}
                variant={card.variant}
                Icon={card.Icon}
              />
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-12">
            <Card className="lg:col-span-8">
              <div className="flex items-center justify-between border-b p-4">
                <div className="flex items-center gap-2">
                  <PackageSearch className="h-5 w-5 text-primary" />
                  <h2 className="font-semibold">Grade de produtos</h2>
                </div>
                <Input
                  placeholder="Buscar item..."
                  className="max-w-xs"
                  value={busca}
                  onChange={(event) => setBusca(event.target.value)}
                />
              </div>
              {carregando ? (
                <p className="p-6 text-sm text-muted-foreground">Carregando...</p>
              ) : filtradas.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">Nenhuma disponibilidade para esta data.</p>
              ) : (
                <div className="overflow-x-auto p-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
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
                              <p className="font-medium">{produto?.descricao ?? linha.itemComercialId}</p>
                              {produto && <p className="text-xs font-mono text-muted-foreground">{produto.codigo}</p>}
                            </TableCell>
                            <TableCell className="text-right">{linha.quantidadeTotalGerada}</TableCell>
                            <TableCell className="text-right">{linha.quantidadeReservada}</TableCell>
                            <TableCell
                              className={`text-right font-semibold ${disponivel <= 0 ? 'text-destructive' : 'text-status-expedido'}`}
                              data-testid={`disp-${linha.id}-disponivel`}
                            >
                              {linha.quantidadeDisponivel}
                            </TableCell>
                            <TableCell className="text-right" data-testid={`disp-${linha.id}-recebido`}>
                              {linha.quantidadeRecebida}
                            </TableCell>
                            <TableCell className="min-w-36">
                              <div className="space-y-1">
                                <div className="flex justify-between text-xs text-muted-foreground">
                                  <span>{percentual}% reservado</span>
                                  {disponivel <= 0 && <StatusPill variant="divergencia" label="ESGOTADO" />}
                                </div>
                                <Progress value={percentual} className="h-2" />
                              </div>
                            </TableCell>
                            <TableCell>{linha.status}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </Card>

            <Card className="border-t-4 border-t-status-divergencia lg:col-span-4">
              <div className="flex items-center gap-2 border-b p-4">
                <AlertCircle className="h-5 w-5 text-status-divergencia" />
                <h2 className="font-semibold">Alertas & impactos</h2>
              </div>
              <div className="space-y-3 p-4">
                {esgotados.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum item esgotado no momento.</p>
                ) : (
                  esgotados.map((linha) => (
                    <AlertItem
                      key={linha.id}
                      title="Item esgotado"
                      description={`Reservado: ${linha.quantidadeReservada} / Gerado: ${linha.quantidadeTotalGerada}`}
                      time=""
                      variant="divergencia"
                      Icon={AlertTriangle}
                    />
                  ))
                )}
                {linhas.some((linha) => Number(linha.quantidadeComDivergencia) > 0) && (
                  <div className="rounded-md border bg-muted/50 p-3 text-sm">
                    <p className="font-semibold">Divergências no recebimento</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {linhas.filter((linha) => Number(linha.quantidadeComDivergencia) > 0).length} item(ns) com quantidade divergente registrada.
                    </p>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
