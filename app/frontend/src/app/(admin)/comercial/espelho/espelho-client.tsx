'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Printer, Search } from 'lucide-react';
import type { Paginado } from '@/lib/comercial';
import type {
  EspelhoResposta,
  StatusEspelho,
} from '@/lib/espelho';
import { labelCodigoNome } from '@/lib/dominios';
import { extrairMensagemErro, mensagemDeErro } from '@/lib/error-message';
import { BadgeProvisorio } from '@/components/ui/badge-provisorio';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ComboboxField } from '@/components/ui/combobox-field';
import { DatePickerField } from '@/components/ui/date-picker-field';
import { EmptyState } from '@/components/ui/empty-state';
import { FilterChip } from '@/components/ui/filter-chip';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Kpi, KpiStrip } from '@/components/ui/kpi-strip';
import { PageHeader } from '@/components/ui/page-header';
import { StatusPill, type StatusPillVariant } from '@/components/ui/status-pill';
import {
  Table,
  TableBody,
  TableCell,
  TableCellNum,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type Agrupamento = 'cliente' | 'rota' | 'representante';

interface RepresentanteResumo {
  id: string;
  codigo: string;
  nome: string;
}

interface RotaResumo {
  id: string;
  codigo: string;
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
      throw new Error(extrairMensagemErro(JSON.parse(texto), texto));
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
        fetch('/api/cadastros/representantes?page=1&pageSize=100&status=ativo', { cache: 'no-store' }),
        fetch('/api/cadastros/rotas?page=1&pageSize=100&status=ativo', { cache: 'no-store' }),
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
        if (!response.ok) {
          if (ativo) setErro(await mensagemDeErro(response, 'Falha ao carregar o espelho.'));
          return;
        }
        const dados = (await response.json()) as EspelhoResposta;
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
    <div className="space-y-3">
      <PageHeader
        title="Espelho Comercial"
        subtitle="Visão de pedidos para conferência, agrupada por cliente, rota ou representante."
      >
        <BadgeProvisorio codigo="P15" />
        <Button type="button" variant="secondary" onClick={() => window.print()}>
          <Printer />
          Imprimir
        </Button>
        <Button asChild variant="secondary">
          <a href={hrefExportacao} download>
            <Download />
            Exportar
          </a>
        </Button>
      </PageHeader>

      <p className="text-xs text-status-divergencia">
        Fechado hoje equivale a pedido finalizado; o marco exato permanece pendente em P15.
      </p>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 px-3 py-2">
          <DatePickerField aria-label="Data operacional" value={data} onChange={setData} />
          <FormField label="Vendedor / representante" htmlFor="espelho-representante" className="w-[200px]">
            <ComboboxField
              id="espelho-representante"
              items={[
                { id: '', label: 'Todos' },
                ...representantes.map((representante) => ({
                  id: representante.id,
                  label: labelCodigoNome(representante.codigo, representante.nome),
                })),
              ]}
              value={representanteId}
              onChange={setRepresentanteId}
              placeholder="Todos"
              searchPlaceholder="Buscar representante..."
              emptyText="Nenhum representante encontrado."
              clearable
            />
          </FormField>
          <FormField label="Rota" htmlFor="espelho-rota" className="w-[150px]">
            <ComboboxField
              id="espelho-rota"
              items={[
                { id: '', label: 'Todos' },
                ...rotas.map((rota) => ({
                  id: rota.id,
                  label: labelCodigoNome(rota.codigo, rota.nome),
                })),
              ]}
              value={rotaId}
              onChange={setRotaId}
              placeholder="Todos"
              searchPlaceholder="Buscar rota..."
              emptyText="Nenhuma rota encontrada."
              clearable
            />
          </FormField>
          <div className="w-[240px]">
            <Input
              adornLeft={<Search />}
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
              placeholder="Buscar cliente"
              className="h-7 text-xs"
            />
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={limpar}>
            Limpar filtros
          </Button>
          <div className="flex-1" />
          <FilterChip active={agrupar === 'cliente'} onClick={() => setAgrupar('cliente')}>
            Por cliente
          </FilterChip>
          <FilterChip active={agrupar === 'rota'} onClick={() => setAgrupar('rota')}>
            Por rota
          </FilterChip>
          <FilterChip active={agrupar === 'representante'} onClick={() => setAgrupar('representante')}>
            Por representante
          </FilterChip>
        </CardContent>
      </Card>

      {erro && (
        <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {erro}
        </div>
      )}

      <KpiStrip>
        <Kpi label="Quantidade pedida" value={totais.quantidadePedida} hint="Total filtrado" />
        <Kpi label="Quantidade atendida" value={totais.quantidadeAtendida} hint="Total filtrado" />
        <Kpi label="Peso atendido" value={formatarPeso(totais.pesoAtendido)} hint="Peso real associado" />
      </KpiStrip>

      {carregando && <p className="text-sm text-muted-foreground">Carregando espelho...</p>}

      {!carregando && espelho?.grupos.length === 0 && (
        <EmptyState icon={<Search />} title="Nenhum pedido encontrado com os filtros selecionados." />
      )}

      {!carregando && espelho && espelho.grupos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pedidos agrupados</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Cliente</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-right">Qtd. pedida</TableHead>
                  <TableHead className="text-right">Qtd. atendida</TableHead>
                  <TableHead className="text-right">Peso atendido</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {espelho.grupos.map((grupo) => (
                  <Fragment key={grupo.chave}>
                    <TableRow className="bg-surface-2 hover:bg-surface-2">
                      <TableCell colSpan={6} className="h-7 text-[11px] font-bold uppercase tracking-[0.04em] text-muted-foreground">
                        {grupo.chave}
                      </TableCell>
                    </TableRow>
                    {grupo.itens.map((item) => (
                      <TableRow key={`${item.pedidoVendaId}-${item.produtoId}`}>
                        <TableCell className="text-[13px] font-semibold text-foreground">{item.cliente}</TableCell>
                        <TableCell>{item.produto}</TableCell>
                        <TableCellNum>{item.quantidadePedida} {item.unidade}</TableCellNum>
                        <TableCellNum>{item.quantidadeAtendida} {item.unidade}</TableCellNum>
                        <TableCellNum>{formatarPeso(item.pesoAtendido)}</TableCellNum>
                        <TableCell>
                          <StatusPill variant={varianteStatus(item.status)} label={item.status} />
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell colSpan={2} className="text-[11px] text-muted-foreground">Subtotal do grupo</TableCell>
                      <TableCellNum className="font-bold">{grupo.subtotal.quantidadePedida}</TableCellNum>
                      <TableCellNum className="font-bold">{grupo.subtotal.quantidadeAtendida}</TableCellNum>
                      <TableCellNum className="font-bold">{formatarPeso(grupo.subtotal.pesoAtendido)}</TableCellNum>
                      <TableCell />
                    </TableRow>
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
