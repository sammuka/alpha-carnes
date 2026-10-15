'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { BadgeProvisorio } from '@/components/ui/badge-provisorio';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Kpi, KpiStrip } from '@/components/ui/kpi-strip';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { conectarRealtime } from '@/lib/realtime';
import {
  CHAVE_LISTA,
  FILTROS_LISTA,
  TEXTO_VAZIO,
  ErroSimulacao,
  mensagemDeSimulacao,
  opcoesDe,
  simulacoesApi,
  type Contagens,
  type CorpoSimulacao,
  type DetalheSimulacao,
  type Diferenca,
  type EventoHistorico,
  type Explicacao,
  type FiltrosLista,
  type LinhaSimulacao,
  type OpcaoCombo,
  type PreCondicao,
} from '@/lib/fiscal-simulacoes';
import { AbasDetalhe } from './abas-detalhe';
import { CompararDialog } from './comparar-dialog';
import { SimulacaoDrawer } from './simulacao-drawer';
import { VersaoDialog } from './versao-dialog';

function lerFiltros(): FiltrosLista {
  if (typeof window === 'undefined') return FILTROS_LISTA;
  try {
    const bruto = window.sessionStorage.getItem(CHAVE_LISTA);
    return bruto ? { ...FILTROS_LISTA, ...JSON.parse(bruto) as Partial<FiltrosLista> } : FILTROS_LISTA;
  } catch {
    return FILTROS_LISTA;
  }
}

export function SimulacoesClient({ podeGerenciar }: { podeGerenciar: boolean }) {
  const [filtros, setFiltros] = useState<FiltrosLista>(lerFiltros);
  const [linhas, setLinhas] = useState<LinhaSimulacao[]>([]);
  const [contagens, setContagens] = useState<Contagens | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroLista, setErroLista] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<DetalheSimulacao | null>(null);
  const [historico, setHistorico] = useState<EventoHistorico[]>([]);
  const [preCondicoes, setPreCondicoes] = useState<PreCondicao[]>([]);
  const [explicacao, setExplicacao] = useState<Explicacao | null>(null);
  const [alerta, setAlerta] = useState<string | null>(null);
  const [falta, setFalta] = useState<string | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [estabelecimentos, setEstabelecimentos] = useState<OpcaoCombo[]>([]);
  const [operacoes, setOperacoes] = useState<OpcaoCombo[]>([]);
  const [clientes, setClientes] = useState<OpcaoCombo[]>([]);
  const [produtos, setProdutos] = useState<OpcaoCombo[]>([]);
  const [ncms, setNcms] = useState<OpcaoCombo[]>([]);
  const [enquadramentos, setEnquadramentos] = useState<OpcaoCombo[]>([]);
  const [versaoAberta, setVersaoAberta] = useState(false);
  const [erroVersao, setErroVersao] = useState<string | null>(null);
  const [compararAberto, setCompararAberto] = useState(false);
  const [diferencas, setDiferencas] = useState<Diferenca[]>([]);
  const [recarga, setRecarga] = useState(0);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErroLista(null);
    try {
      const [lista, totais] = await Promise.all([
        simulacoesApi.listar(filtros),
        simulacoesApi.contagens(filtros),
      ]);
      setLinhas(lista.data);
      setContagens(totais);
    } catch (erro) {
      setErroLista(erro instanceof Error ? erro.message : 'Serviço indisponível no momento. Tente novamente.');
    } finally {
      setCarregando(false);
    }
  }, [filtros]);

  useEffect(() => { void carregar(); }, [carregar, recarga]);
  useEffect(() => { window.sessionStorage.setItem(CHAVE_LISTA, JSON.stringify(filtros)); }, [filtros]);
  useEffect(() => {
    void Promise.all([
      opcoesDe('/api/erp/fiscal/estabelecimentos?pageSize=100', (linha) => String(linha.nome ?? '')),
      opcoesDe('/api/operacoes?limite=100', (linha) => String(linha.rotulo ?? '')),
      opcoesDe('/api/cadastros/clientes?limite=100', (linha) => String(linha.nomeFantasia ?? linha.razaoSocial ?? '')),
      opcoesDe('/api/cadastros/produtos?limite=100', (linha) => String(linha.nome ?? '')),
      opcoesDe('/api/erp/fiscal/ncms?pageSize=100', (linha) => `${linha.codigo ?? ''} — ${linha.descricao ?? ''}`),
      opcoesDe('/api/erp/fiscal/enquadramentos?pageSize=100', (linha) => String(linha.codigo ?? '')),
    ]).then(([ests, ops, clis, prods, fiscais, enqs]) => {
      setEstabelecimentos(ests);
      setOperacoes(ops);
      setClientes(clis);
      setProdutos(prods);
      setNcms(fiscais);
      setEnquadramentos(enqs);
    }).catch(() => undefined);
  }, [recarga]);
  useEffect(() => conectarRealtime({
    rooms: ['fiscal-simulacoes'],
    onMessage: () => setRecarga((n) => n + 1),
    onReconnect: () => setRecarga((n) => n + 1),
  }), []);

  function registrar(erro: unknown): string {
    if (!(erro instanceof ErroSimulacao)) return 'Falha na operação.';
    const texto = mensagemDeSimulacao(erro);
    if (erro.codigo === 'FALTA_REFERENCIA_LEGAL') setFalta(texto);
    setAlerta(texto);
    return texto;
  }

  async function selecionar(id: string) {
    setAlerta(null);
    setExplicacao(null);
    try {
      const [ficha, eventos] = await Promise.all([simulacoesApi.obter(id), simulacoesApi.historico(id)]);
      setDetalhe(ficha);
      setHistorico(eventos);
    } catch (erro) {
      setErroLista(erro instanceof Error ? erro.message : 'Falha na operação.');
    }
  }

  async function salvar(corpo: CorpoSimulacao): Promise<string | null> {
    try {
      await simulacoesApi.criar(corpo);
      toast.success('Simulação calculada.');
      setDrawer(false);
      setRecarga((n) => n + 1);
      return null;
    } catch (erro) {
      return registrar(erro);
    }
  }

  return (
    <div className="grid gap-4">
      <PageHeader
        title="Simulador fiscal e memória de cálculo"
        subtitle="Simular, explicar, exportar e comparar versões da memória."
        badge={<BadgeProvisorio codigo="H-E01-12" />}
      >
        <Button type="button" variant="secondary" onClick={() => { window.location.href = '/api/erp/fiscal/simulacoes/exportacao'; }}>Exportar</Button>
        {podeGerenciar && <Button type="button" onClick={() => setDrawer(true)}>+ Novo registro</Button>}
        <details>
          <summary className="cursor-pointer text-sm">Ações do processo</summary>
          <div className="mt-2 grid gap-1">
            {podeGerenciar && <Button type="button" variant="secondary" onClick={() => setDrawer(true)}>Simular</Button>}
            <Button type="button" variant="secondary" disabled={!detalhe} onClick={() => { if (detalhe) void simulacoesApi.explicar(detalhe.id).then(setExplicacao).catch(registrar); }}>Explicar tributos</Button>
            <Button type="button" variant="secondary" disabled={!detalhe} onClick={() => { setDiferencas([]); setCompararAberto(true); }}>Comparar versões</Button>
            {podeGerenciar && <Button type="button" variant="secondary" disabled={!detalhe} onClick={() => { setErroVersao(null); setVersaoAberta(true); }}>Nova versão</Button>}
          </div>
        </details>
      </PageHeader>
      <KpiStrip>
        <Kpi label="Simulações" value={contagens?.simulacoes ?? 0} />
        <Kpi label="Versões" value={contagens?.versoes ?? 0} />
        <Kpi label="Base tributável difere de valor bruto" value={contagens?.baseDiferente ?? 0} />
      </KpiStrip>
      <div className="flex flex-wrap gap-2">
        <input aria-label="Buscar cliente" className="h-8 rounded-md border px-2" value={filtros.search} onChange={(e) => setFiltros((atual) => ({ ...atual, search: e.target.value, page: 1 }))} />
        <Button type="button" variant="secondary" onClick={() => { window.location.href = '/api/erp/fiscal/simulacoes/exportacao'; }}>Exportar visão</Button>
      </div>
      {erroLista && (
        <p role="alert" className="text-sm text-destructive">
          {erroLista} <Button type="button" variant="secondary" onClick={() => setRecarga((n) => n + 1)}>Tentar novamente</Button>
        </p>
      )}
      {carregando ? <Skeleton className="h-40 w-full" /> : linhas.length === 0 ? (
        <EmptyState title={TEXTO_VAZIO} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Produto</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Valor líquido (calculado)</TableHead>
              <TableHead>Estabelecimento</TableHead>
              <TableHead>Operação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {linhas.map((linha) => (
              <TableRow key={linha.id} tabIndex={0} onClick={() => void selecionar(linha.id)} onKeyDown={(e) => { if (e.key === 'Enter') void selecionar(linha.id); }}>
                <TableCell>{linha.cliente}</TableCell>
                <TableCell>{linha.produto}</TableCell>
                <TableCell>{linha.valor}</TableCell>
                <TableCell>{linha.valorLiquido}</TableCell>
                <TableCell>{linha.estabelecimento}</TableCell>
                <TableCell>{linha.operacao}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {alerta && <p role="alert" className="text-sm text-destructive">{alerta}</p>}
      {detalhe && (
        <AbasDetalhe
          detalhe={detalhe}
          historico={historico}
          preCondicoes={preCondicoes}
          explicacao={explicacao}
          falta={falta}
          onValidar={() => { void simulacoesApi.preCondicoes(detalhe.id).then(setPreCondicoes).catch(registrar); }}
          onExplicar={() => { void simulacoesApi.explicar(detalhe.id).then(setExplicacao).catch(registrar); }}
        />
      )}
      <SimulacaoDrawer
        aberto={drawer}
        estabelecimentos={estabelecimentos}
        operacoes={operacoes}
        clientes={clientes}
        produtos={produtos}
        ncms={ncms}
        enquadramentos={enquadramentos}
        onFechar={() => setDrawer(false)}
        onSalvar={salvar}
      />
      <VersaoDialog
        aberto={versaoAberta}
        origem={detalhe}
        erro={erroVersao}
        onFechar={() => setVersaoAberta(false)}
        onSalvar={async (corpo) => {
          if (!detalhe) return;
          try {
            await simulacoesApi.versao(detalhe.id, corpo);
            setVersaoAberta(false);
            setRecarga((n) => n + 1);
            toast.success('Simulação calculada.');
          } catch (erro) {
            setErroVersao(registrar(erro));
          }
        }}
      />
      <CompararDialog
        aberto={compararAberto}
        versoes={linhas.filter((linha) => detalhe && linha.id !== detalhe.id)}
        diferencas={diferencas}
        onFechar={() => setCompararAberto(false)}
        onComparar={(com) => {
          if (!detalhe) return;
          void simulacoesApi.comparar(detalhe.id, com).then((res) => setDiferencas(res.diferencas)).catch(registrar);
        }}
      />
    </div>
  );
}
