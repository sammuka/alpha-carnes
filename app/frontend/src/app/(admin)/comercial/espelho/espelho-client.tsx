'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, PackageCheck, Printer, RotateCcw, Scale, Search, Weight } from 'lucide-react';
import type { Paginado } from '@/lib/comercial';
import type {
  EspelhoResposta,
  StatusEspelho,
} from '@/lib/espelho';
import { BadgeProvisorio } from '@/components/ui/badge-provisorio';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { KpiCard } from '@/components/ui/kpi-card';
import { StatusPill, type StatusPillVariant } from '@/components/ui/status-pill';

type Agrupamento = 'cliente' | 'rota' | 'representante';

interface RepresentanteResumo {
  id: string;
  nome: string;
}

interface RotaResumo {
  id: string;
  nome: string;
}

interface EspelhoClientProps {
  dataInicial?: string;
}

function hojeISO(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

async function lerJson<T>(response: Response): Promise<T> {
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

function varianteStatus(status: StatusEspelho): StatusPillVariant {
  const variantes: Record<StatusEspelho, StatusPillVariant> = {
    Aberto: 'pendente',
    Parcial: 'divergencia',
    Atendido: 'recebido',
    Fechado: 'expedido',
    Faturado: 'pesado',
    Cancelado: 'bloqueado',
  };
  return variantes[status];
}

function formatarPeso(valor: string): string {
  return `${Number(valor).toLocaleString('pt-BR', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  })} kg`;
}

export function EspelhoClient({ dataInicial = hojeISO() }: EspelhoClientProps) {
  const [data, setData] = useState(dataInicial);
  const [representanteId, setRepresentanteId] = useState('');
  const [rotaId, setRotaId] = useState('');
  const [busca, setBusca] = useState('');
  const [agrupar, setAgrupar] = useState<Agrupamento>('cliente');
  const [espelho, setEspelho] = useState<EspelhoResposta | null>(null);
  const [representantes, setRepresentantes] = useState<RepresentanteResumo[]>([]);
  const [rotas, setRotas] = useState<RotaResumo[]>([]);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);

  const query = useMemo(() => {
    const params = new URLSearchParams({ dataOperacao: data, agrupar });
    if (representanteId) params.set('representanteId', representanteId);
    if (rotaId) params.set('rotaId', rotaId);
    if (busca.trim()) params.set('busca', busca.trim());
    return params;
  }, [agrupar, busca, data, representanteId, rotaId]);

  const carregarCatalogos = useCallback(async () => {
    try {
      const [representantesResponse, rotasResponse] = await Promise.all([
        fetch('/api/cadastros/representantes?pageSize=100', { cache: 'no-store' }),
        fetch('/api/cadastros/rotas?pageSize=100', { cache: 'no-store' }),
      ]);
      const [representantesPage, rotasPage] = await Promise.all([
        lerJson<Paginado<RepresentanteResumo>>(representantesResponse),
        lerJson<Paginado<RotaResumo>>(rotasResponse),
      ]);
      setRepresentantes(representantesPage.data);
      setRotas(rotasPage.data);
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Falha ao carregar filtros.');
    }
  }, []);

  useEffect(() => {
    void carregarCatalogos();
  }, [carregarCatalogos]);

  useEffect(() => {
    let ativo = true;
    const timer = setTimeout(async () => {
      setCarregando(true);
      setErro('');
      try {
        const response = await fetch(`/api/comercial/espelho?${query.toString()}`, {
          cache: 'no-store',
        });
        const dados = await lerJson<EspelhoResposta>(response);
        if (ativo) setEspelho(dados);
      } catch (error) {
        if (ativo) setErro(error instanceof Error ? error.message : 'Falha ao carregar o espelho.');
      } finally {
        if (ativo) setCarregando(false);
      }
    }, busca ? 250 : 0);
    return () => {
      ativo = false;
      clearTimeout(timer);
    };
  }, [busca, query]);

  function limpar() {
    setRepresentanteId('');
    setRotaId('');
    setBusca('');
  }

  const hrefExportacao = `/api/comercial/espelho?${new URLSearchParams([
    ...query.entries(),
    ['formato', 'csv'],
  ]).toString()}`;

  const totais = espelho?.totalGeral ?? {
    quantidadePedida: '0.000',
    quantidadeAtendida: '0.000',
    pesoAtendido: '0.000',
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-0.5 text-xs font-medium text-muted-foreground">Comercial / Espelho Comercial</p>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold">Espelho Comercial</h1>
            <BadgeProvisorio pendencia="P15" texto="Provisório · P15" />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Visão de pedidos para conferência, agrupada por cliente, rota ou representante.
          </p>
          <p className="mt-1 text-xs text-status-divergencia">
            Fechado hoje equivale a pedido finalizado; o marco exato permanece pendente em P15.
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />
            Imprimir
          </Button>
          <Button asChild variant="outline">
            <a href={hrefExportacao} download>
              <Download className="mr-2 h-4 w-4" />
              Exportar
            </a>
          </Button>
        </div>
      </div>

      <section className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3">
        <Input
          aria-label="Data operacional"
          type="date"
          value={data}
          onChange={(event) => setData(event.target.value)}
          className="w-40"
        />
        <select
          aria-label="Vendedor / representante"
          value={representanteId}
          onChange={(event) => setRepresentanteId(event.target.value)}
          className="h-9 rounded-md border bg-background px-3 text-sm"
        >
          <option value="">Vendedor/representante: Todos</option>
          {representantes.map((representante) => (
            <option key={representante.id} value={representante.id}>{representante.nome}</option>
          ))}
        </select>
        <select
          aria-label="Rota"
          value={rotaId}
          onChange={(event) => setRotaId(event.target.value)}
          className="h-9 rounded-md border bg-background px-3 text-sm"
        >
          <option value="">Rota: Todas</option>
          {rotas.map((rota) => <option key={rota.id} value={rota.id}>{rota.nome}</option>)}
        </select>
        <div className="relative min-w-52">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            placeholder="Buscar cliente"
            className="pl-8"
          />
        </div>
        <Button type="button" variant="outline" size="sm" onClick={limpar}>
          <RotateCcw className="mr-1 h-3 w-3" />
          Limpar
        </Button>
        <div className="flex-1" />
        <div className="inline-flex rounded-md bg-muted p-1">
          {(['cliente', 'rota', 'representante'] as const).map((opcao) => (
            <Button
              key={opcao}
              type="button"
              size="sm"
              variant={agrupar === opcao ? 'secondary' : 'ghost'}
              onClick={() => setAgrupar(opcao)}
            >
              Por {opcao}
            </Button>
          ))}
        </div>
      </section>

      {erro && (
        <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {erro}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="Quantidade pedida" value={totais.quantidadePedida} sub="Total filtrado" Icon={Scale} />
        <KpiCard label="Quantidade atendida" value={totais.quantidadeAtendida} sub="Total filtrado" variant="success" Icon={PackageCheck} />
        <KpiCard label="Peso atendido" value={formatarPeso(totais.pesoAtendido)} sub="Peso real associado" variant="primary" Icon={Weight} />
      </div>

      {carregando && <p className="text-sm text-muted-foreground">Carregando espelho...</p>}

      {!carregando && espelho?.grupos.length === 0 && (
        <div className="rounded-xl border bg-card py-16 text-center">
          <Search className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">Nenhum pedido encontrado com os filtros selecionados.</p>
        </div>
      )}

      <div className="space-y-4">
        {espelho?.grupos.map((grupo) => (
          <section key={grupo.chave} className="overflow-hidden rounded-xl border bg-card">
            <div className="flex items-center justify-between border-b bg-muted/40 px-4 py-2.5">
              <p className="font-bold">{grupo.chave}</p>
              <p className="text-xs text-muted-foreground">
                {grupo.itens.length} {grupo.itens.length === 1 ? 'item' : 'itens'}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-2">Cliente</th>
                    <th className="px-4 py-2">Produto</th>
                    <th className="px-4 py-2">Qtd. pedida</th>
                    <th className="px-4 py-2">Qtd. atendida</th>
                    <th className="px-4 py-2">Peso atendido</th>
                    <th className="px-4 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {grupo.itens.map((item) => (
                    <tr key={`${item.pedidoVendaId}-${item.itemComercialId}`} className="border-b last:border-0">
                      <td className="px-4 py-2 font-medium">{item.cliente}</td>
                      <td className="px-4 py-2">{item.produto}</td>
                      <td className="px-4 py-2">{item.quantidadePedida} {item.unidade}</td>
                      <td className="px-4 py-2">{item.quantidadeAtendida} {item.unidade}</td>
                      <td className="px-4 py-2 font-mono">{formatarPeso(item.pesoAtendido)}</td>
                      <td className="px-4 py-2">
                        <StatusPill variant={varianteStatus(item.status)} label={item.status} />
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-muted/40 font-semibold">
                    <td colSpan={2} className="px-4 py-2 text-xs text-muted-foreground">Subtotal do grupo</td>
                    <td className="px-4 py-2">{grupo.subtotal.quantidadePedida}</td>
                    <td className="px-4 py-2">{grupo.subtotal.quantidadeAtendida}</td>
                    <td className="px-4 py-2 font-mono">{formatarPeso(grupo.subtotal.pesoAtendido)}</td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
