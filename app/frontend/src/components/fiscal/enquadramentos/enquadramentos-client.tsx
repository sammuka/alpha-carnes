'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { BadgeProvisorio } from '@/components/ui/badge-provisorio';
import { Button } from '@/components/ui/button';
import { ComboboxField } from '@/components/ui/combobox-field';
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
  TEXTO_VAZIO_COMBO,
  ErroEnquadramento,
  enquadramentosApi,
  mensagemSobreposicao,
  textoConsulta,
  type ContagensEnquadramento,
  type CorpoEnquadramento,
  type DetalheEnquadramento,
  type EventoHistoricoEnquadramento,
  type FiltrosLista,
  type LinhaEnquadramento,
  type OpcaoCombo,
  type PreCondicao,
} from '@/lib/fiscal-enquadramentos';
import { AbasDetalhe } from './abas-detalhe';
import { CodigoFiscalDialog } from './codigo-fiscal-dialog';
import { DuplicarDialog } from './duplicar-dialog';
import { EnquadramentoDrawer, type Catalogos } from './enquadramento-drawer';

const CATALOGOS_VAZIOS: Catalogos = {
  estabelecimentos: [], operacoes: [], produtos: [], clientes: [], cfops: [], ncms: [],
};

function lerFiltros(): FiltrosLista {
  if (typeof window === 'undefined') return FILTROS_LISTA;
  try {
    const bruto = window.sessionStorage.getItem(CHAVE_LISTA);
    return bruto ? { ...FILTROS_LISTA, ...JSON.parse(bruto) as Partial<FiltrosLista> } : FILTROS_LISTA;
  } catch {
    return FILTROS_LISTA;
  }
}

export function EnquadramentosClient({ podeGerenciar }: { podeGerenciar: boolean }) {
  const [filtros, setFiltros] = useState<FiltrosLista>(lerFiltros);
  const [linhas, setLinhas] = useState<LinhaEnquadramento[]>([]);
  const [contagens, setContagens] = useState<ContagensEnquadramento | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroLista, setErroLista] = useState<string | null>(null);
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<DetalheEnquadramento | null>(null);
  const [historico, setHistorico] = useState<EventoHistoricoEnquadramento[]>([]);
  const [preCondicoes, setPreCondicoes] = useState<PreCondicao[]>([]);
  const [alerta, setAlerta] = useState<string | null>(null);
  const [catalogos, setCatalogos] = useState<Catalogos>(CATALOGOS_VAZIOS);
  const [drawer, setDrawer] = useState(false);
  const [erroDrawer, setErroDrawer] = useState<string | null>(null);
  const [duplicar, setDuplicar] = useState(false);
  const [erroDuplicar, setErroDuplicar] = useState<string | null>(null);
  const [codigoTipo, setCodigoTipo] = useState<'cfops' | 'ncms' | null>(null);
  const [recarga, setRecarga] = useState(0);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErroLista(null);
    try {
      const [lista, totais] = await Promise.all([
        enquadramentosApi.listar(filtros),
        enquadramentosApi.contagens(filtros),
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

  useEffect(() => {
    window.sessionStorage.setItem(CHAVE_LISTA, JSON.stringify(filtros));
  }, [filtros]);

  useEffect(() => {
    void Promise.all([
      enquadramentosApi.opcoesEstabelecimento(),
      enquadramentosApi.opcoesOperacao(),
      enquadramentosApi.opcoesProduto(),
      enquadramentosApi.opcoesCliente(),
      enquadramentosApi.opcoesCodigo('cfops'),
      enquadramentosApi.opcoesCodigo('ncms'),
    ]).then(([estabelecimentos, operacoes, produtos, clientes, cfops, ncms]) => {
      setCatalogos({ estabelecimentos, operacoes, produtos, clientes, cfops, ncms });
    }).catch(() => undefined);
  }, [recarga]);

  useEffect(() => {
    return conectarRealtime({
      rooms: ['fiscal-enquadramentos'],
      onMessage: () => setRecarga((n) => n + 1),
      onReconnect: () => setRecarga((n) => n + 1),
    });
  }, []);

  async function selecionar(id: string) {
    setSelecionadoId(id);
    setAlerta(null);
    setPreCondicoes([]);
    try {
      const [ficha, eventos] = await Promise.all([
        enquadramentosApi.obter(id),
        enquadramentosApi.historico(id),
      ]);
      setDetalhe(ficha);
      setHistorico(eventos);
    } catch (erro) {
      setDetalhe(null);
      setErroLista(erro instanceof Error ? erro.message : 'Falha na operação.');
    }
  }

  async function salvar(corpo: CorpoEnquadramento): Promise<string | null> {
    try {
      if (detalhe && drawer) {
        const { estabelecimentoId: _id, ...resto } = corpo;
        await enquadramentosApi.atualizar(detalhe.id, { ...resto, versao: detalhe.versao });
      } else {
        await enquadramentosApi.criar(corpo);
      }
      toast.success('Enquadramento salvo.');
      setDrawer(false);
      setErroDrawer(null);
      setRecarga((n) => n + 1);
      return null;
    } catch (erro) {
      if (erro instanceof ErroEnquadramento) return mensagemSobreposicao(erro) ?? erro.message;
      return 'Falha na operação.';
    }
  }

  async function situacao(acao: 'inativar' | 'reativar' | 'remover') {
    if (!detalhe) return;
    const justificativa = window.prompt('Motivo da alteração')?.trim() ?? '';
    if (justificativa.length < 3) return;
    if (acao === 'remover') await enquadramentosApi.remover(detalhe.id, justificativa);
    else await enquadramentosApi[acao](detalhe.id, { versao: detalhe.versao, justificativa });
    setRecarga((n) => n + 1);
  }

  async function consultar() {
    if (!detalhe) return;
    try {
      await enquadramentosApi.consultar({
        estabelecimentoId: detalhe.estabelecimentoId,
        data: detalhe.vigenciaInicio,
        operacaoId: detalhe.operacaoId,
        tpNf: detalhe.tpNf,
        finNfe: detalhe.finNfe,
        cfopId: detalhe.cfopId,
        abrangencia: detalhe.abrangencia,
        tipoProduto: detalhe.tipoProduto,
        produtoId: detalhe.produtoId,
        ncmId: detalhe.ncmId,
        cest: detalhe.cest,
        clienteId: detalhe.clienteId,
      });
    } catch (erro) {
      if (erro instanceof ErroEnquadramento) setAlerta(textoConsulta(erro));
      else setAlerta('Falha na operação.');
    }
  }

  async function validarPreCondicoes() {
    if (!detalhe) return;
    setPreCondicoes(await enquadramentosApi.preCondicoes(detalhe.id));
  }

  function combo(rotulo: string, id: string, opcoes: OpcaoCombo[], valor: string, chave: keyof FiltrosLista) {
    return (
      <label className="grid gap-1 text-xs" htmlFor={id}>
        {rotulo}
        <ComboboxField
          id={id}
          items={opcoes.map((opcao) => ({ id: opcao.id, label: opcao.rotulo }))}
          value={valor}
          onChange={(novo) => setFiltros((atual) => ({ ...atual, [chave]: novo, page: 1 }))}
          placeholder={rotulo}
          searchPlaceholder={`Buscar ${rotulo.toLowerCase()}`}
          emptyText={TEXTO_VAZIO_COMBO}
        />
      </label>
    );
  }

  return (
    <div className="grid gap-4">
      <PageHeader
        title="Operações fiscais e enquadramentos"
        subtitle="Cadastrar operação, duplicar perfil, relacionar produto e cliente, controlar prioridade. Acesso típico"
        badge={<BadgeProvisorio codigo="H-E01-12" />}
        live
      >
        <Button type="button" variant="secondary" onClick={() => void enquadramentosApi.exportar(filtros)}>Exportar</Button>
        {podeGerenciar && (
          <Button type="button" onClick={() => { setErroDrawer(null); setDrawer(true); }}>+ Novo registro</Button>
        )}
        <details>
          <summary className="cursor-pointer text-sm">Ações do processo</summary>
          <div className="mt-2 grid gap-1">
            <Button type="button" variant="secondary" onClick={() => { setErroDrawer(null); setDrawer(true); }}>Cadastrar operação</Button>
            <Button type="button" variant="secondary" onClick={() => detalhe && setDuplicar(true)}>Duplicar perfil</Button>
            <Button type="button" variant="secondary" onClick={() => { setErroDrawer(null); setDrawer(true); }}>Relacionar produto e cliente</Button>
            <Button type="button" variant="secondary" onClick={() => { setErroDrawer(null); setDrawer(true); }}>Controlar prioridade</Button>
          </div>
        </details>
      </PageHeader>
      <KpiStrip>
        <Kpi label="Enquadramentos" value={contagens?.total ?? '—'} />
        <Kpi label="Ativos" value={contagens?.ativas ?? '—'} />
        <Kpi label="Inativos" value={contagens?.inativas ?? '—'} />
      </KpiStrip>
      <section className="grid gap-3">
        <h2 className="text-sm font-semibold">Registros e consultas</h2>
        <input
          aria-label="Buscar"
          className="h-8 rounded-md border px-2 text-sm"
          value={filtros.search}
          onChange={(e) => setFiltros((atual) => ({ ...atual, search: e.target.value, page: 1 }))}
        />
        <div className="grid gap-2 md:grid-cols-4">
          {combo('Estabelecimento', 'filtro-estab', catalogos.estabelecimentos, filtros.estabelecimentoId, 'estabelecimentoId')}
          {combo('Operação fiscal (CFOP)', 'filtro-cfop', catalogos.cfops, filtros.cfopId, 'cfopId')}
          {combo('Produto', 'filtro-prod', catalogos.produtos, filtros.produtoId, 'produtoId')}
          {combo('Cliente', 'filtro-cli', catalogos.clientes, filtros.clienteId, 'clienteId')}
        </div>
        <Button type="button" variant="secondary" onClick={() => void enquadramentosApi.exportar(filtros)}>Exportar visão</Button>
        {carregando && <Skeleton className="h-24" />}
        {erroLista && (
          <div role="alert" className="grid gap-2">
            <p>{erroLista}</p>
            <Button type="button" onClick={() => setRecarga((n) => n + 1)}>Tentar novamente</Button>
          </div>
        )}
        {!carregando && !erroLista && linhas.length === 0 && <EmptyState title={TEXTO_VAZIO} />}
        {!carregando && linhas.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Operação</TableHead>
                <TableHead>Operação fiscal (CFOP)</TableHead>
                <TableHead>Início de vigência</TableHead>
                <TableHead>Estabelecimento</TableHead>
                <TableHead>Tipo da nota</TableHead>
                <TableHead>Finalidade</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.map((linha) => (
                <TableRow
                  key={linha.codigo}
                  tabIndex={0}
                  data-state={selecionadoId === linha.id ? 'selected' : undefined}
                  onClick={() => void selecionar(linha.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter') void selecionar(linha.id); }}
                >
                  <TableCell>{linha.operacao}</TableCell>
                  <TableCell>{linha.cfop}</TableCell>
                  <TableCell>{linha.vigenciaInicio}</TableCell>
                  <TableCell>{linha.estabelecimento}</TableCell>
                  <TableCell>{linha.tpNf}</TableCell>
                  <TableCell>{linha.finNfe}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
      <section className="grid gap-2">
        <h2 className="text-sm font-semibold">Detalhamento e execução</h2>
        {detalhe && (
          <AbasDetalhe
            detalhe={detalhe}
            podeGerenciar={podeGerenciar}
            alerta={alerta}
            historico={historico}
            preCondicoes={preCondicoes}
            onValidarPreCondicoes={() => void validarPreCondicoes()}
            onConsultar={() => void consultar()}
            onEditar={() => { setErroDrawer(null); setDrawer(true); }}
            onDuplicar={() => setDuplicar(true)}
            onInativar={() => void situacao('inativar')}
            onReativar={() => void situacao('reativar')}
            onRemover={() => void situacao('remover')}
          />
        )}
      </section>
      <EnquadramentoDrawer
        aberto={drawer}
        detalhe={selecionadoId ? detalhe : null}
        catalogos={catalogos}
        erro={erroDrawer}
        onFechar={() => setDrawer(false)}
        onSalvar={salvar}
        onErro={setErroDrawer}
        onNovoCodigo={setCodigoTipo}
      />
      <DuplicarDialog
        aberto={duplicar}
        prioridadeOrigem={detalhe?.prioridade ?? 1}
        erro={erroDuplicar}
        onFechar={() => setDuplicar(false)}
        onConfirmar={(corpo) => {
          if (!detalhe) return;
          void enquadramentosApi.duplicar(detalhe.id, { ...corpo, vigenciaFim: corpo.vigenciaFim || undefined, versao: detalhe.versao })
            .then(() => { setDuplicar(false); toast.success('Enquadramento salvo.'); setRecarga((n) => n + 1); })
            .catch((erro: unknown) => setErroDuplicar(erro instanceof ErroEnquadramento ? (mensagemSobreposicao(erro) ?? erro.message) : 'Falha na operação.'));
        }}
      />
      <CodigoFiscalDialog
        aberto={codigoTipo !== null}
        tipo={codigoTipo}
        onFechar={() => setCodigoTipo(null)}
        onConfirmar={(corpo) => {
          if (!codigoTipo) return;
          void enquadramentosApi.criarCodigo(codigoTipo, corpo).then(() => setCodigoTipo(null)).catch(() => undefined);
        }}
      />
    </div>
  );
}
