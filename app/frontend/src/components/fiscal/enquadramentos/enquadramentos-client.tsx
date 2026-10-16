'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { BadgeProvisorio } from '@/components/ui/badge-provisorio';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Kpi, KpiStrip } from '@/components/ui/kpi-strip';
import { PageHeader } from '@/components/ui/page-header';
import { conectarRealtime } from '@/lib/realtime';
import {
  CHAVE_LISTA,
  FILTROS_LISTA,
  ErroEnquadramento,
  enquadramentosApi,
  mascararCfop,
  mascararNcm,
  mensagemSobreposicao,
  textoConsulta,
  type ContagensEnquadramento,
  type CorpoEnquadramento,
  type DetalheEnquadramento,
  type EventoHistoricoEnquadramento,
  type FiltrosLista,
  type LinhaEnquadramento,
  type PreCondicao,
} from '@/lib/fiscal-enquadramentos';
import { DecisaoDialog, type DecisaoPendente } from '../empresas/decisao-dialog';
import { AbasDetalhe, type IdAba } from './abas-detalhe';
import { ComboboxBusca } from './combobox-busca';
import { CodigoFiscalDialog } from './codigo-fiscal-dialog';
import { DuplicarDialog } from './duplicar-dialog';
import { EnquadramentoDrawer, type SelecaoCodigo } from './enquadramento-drawer';
import { GradeEnquadramentos } from './grade-enquadramentos';

const CHAVE_ROTULOS = 'fiscal.enquadramentos.rotulos';
type AcaoSituacao = 'inativar' | 'reativar' | 'remover';

const TEXTOS_SITUACAO: Record<AcaoSituacao, { titulo: string; detalhe: string; rotulo: string; sucesso: string }> = {
  inativar: {
    titulo: 'Inativar enquadramento',
    detalhe: 'O enquadramento deixa de entrar na consulta. Informe a justificativa.',
    rotulo: 'Inativar',
    sucesso: 'Enquadramento inativado.',
  },
  reativar: {
    titulo: 'Reativar enquadramento',
    detalhe: 'O enquadramento volta a entrar na consulta, se não houver vigência sobreposta. Informe a justificativa.',
    rotulo: 'Reativar',
    sucesso: 'Enquadramento reativado.',
  },
  remover: {
    titulo: 'Remover enquadramento',
    detalhe: 'O enquadramento sai da lista e da consulta. Informe a justificativa.',
    rotulo: 'Remover',
    sucesso: 'Enquadramento removido.',
  },
};

type ChaveBuscaFiltro = 'estabelecimentoId' | 'cfopId' | 'produtoId' | 'clienteId';

function lerRotulos(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(window.sessionStorage.getItem(CHAVE_ROTULOS) ?? '{}') as Record<string, string>;
  } catch {
    return {};
  }
}

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
  const [paginacao, setPaginacao] = useState({ total: 0, pageSize: 20 });
  const [contagens, setContagens] = useState<ContagensEnquadramento | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroLista, setErroLista] = useState<string | null>(null);
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<DetalheEnquadramento | null>(null);
  const [erroFicha, setErroFicha] = useState<string | null>(null);
  const [historico, setHistorico] = useState<EventoHistoricoEnquadramento[]>([]);
  const [preCondicoes, setPreCondicoes] = useState<PreCondicao[]>([]);
  const [aba, setAba] = useState<IdAba>('ficha');
  const [alerta, setAlerta] = useState<string | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [editando, setEditando] = useState(false);
  const [versaoEdicao, setVersaoEdicao] = useState(0);
  const [erroDrawer, setErroDrawer] = useState<string | null>(null);
  const [fichaEdicao, setFichaEdicao] = useState<DetalheEnquadramento | null>(null);
  const [removidoEdicao, setRemovidoEdicao] = useState(false);
  const [conflitoDrawer, setConflitoDrawer] = useState(false);
  const [focoDrawer, setFocoDrawer] = useState<string | null>(null);
  const [alvoDuplicar, setAlvoDuplicar] = useState<{ id: string; versao: number; prioridade: number } | null>(null);
  const [erroDuplicar, setErroDuplicar] = useState<string | null>(null);
  const [decisao, setDecisao] = useState<DecisaoPendente | null>(null);
  const [codigoTipo, setCodigoTipo] = useState<'cfops' | 'ncms' | null>(null);
  const [selecaoCodigo, setSelecaoCodigo] = useState<SelecaoCodigo | null>(null);
  const [recarga, setRecarga] = useState(0);
  const [rotulosFiltro, setRotulosFiltro] = useState<Record<string, string>>(lerRotulos);
  const [busca, setBusca] = useState(() => lerFiltros().search);
  const pedidoFicha = useRef(0);
  const pedidoLista = useRef(0);
  const filtrosAtuais = useRef(filtros);
  filtrosAtuais.current = filtros;

  // Busca por texto: consulta o servidor só depois de uma pausa na digitação.
  useEffect(() => {
    if (busca === filtros.search) return;
    const espera = setTimeout(() => setFiltros((atual) => ({ ...atual, search: busca, page: 1 })), 250);
    return () => clearTimeout(espera);
  }, [busca, filtros.search]);

  /** Uma resposta antiga (pedido já superado por outro) não atualiza linhas, contagens, KPIs nem a página. */
  const carregar = useCallback(async () => {
    const pedido = ++pedidoLista.current;
    setCarregando(true);
    setErroLista(null);
    try {
      const [lista, totais] = await Promise.all([
        enquadramentosApi.listar(filtros),
        enquadramentosApi.contagens(filtros),
      ]);
      if (pedido !== pedidoLista.current) return;
      setLinhas(lista.data);
      setPaginacao({ total: lista.total, pageSize: lista.pageSize });
      setContagens(totais);
      // Removeu ou filtrou a última linha da página atual: volta para a última página existente.
      const ultima = Math.max(1, Math.ceil(lista.total / lista.pageSize));
      if (filtrosAtuais.current.page > ultima) setFiltros((atual) => ({ ...atual, page: ultima }));
    } catch (erro) {
      if (pedido !== pedidoLista.current) return;
      setErroLista(erro instanceof Error ? erro.message : 'Serviço indisponível no momento. Tente novamente.');
    } finally {
      if (pedido === pedidoLista.current) setCarregando(false);
    }
  }, [filtros]);

  /** Refaz a ficha e o histórico; a resposta de um pedido antigo não sobrescreve a do mais novo. */
  const carregarFicha = useCallback(async (id: string) => {
    const pedido = ++pedidoFicha.current;
    try {
      const [ficha, eventos] = await Promise.all([enquadramentosApi.obter(id), enquadramentosApi.historico(id)]);
      if (pedido !== pedidoFicha.current) return;
      setDetalhe(ficha);
      setHistorico(eventos);
      setErroFicha(null);
    } catch (erro) {
      if (pedido !== pedidoFicha.current) return;
      if (erro instanceof ErroEnquadramento && erro.status === 404) {
        setRemovidoEdicao(true);
        setDetalhe(null);
        setSelecionadoId(null);
        setErroFicha('O enquadramento selecionado não está mais disponível.');
        return;
      }
      setErroFicha(erro instanceof Error ? erro.message : 'Falha na operação.');
    }
  }, []);

  useEffect(() => { void carregar(); }, [carregar, recarga]);

  useEffect(() => {
    if (selecionadoId) void carregarFicha(selecionadoId);
  }, [selecionadoId, recarga, carregarFicha]);

  useEffect(() => {
    window.sessionStorage.setItem(CHAVE_LISTA, JSON.stringify(filtros));
  }, [filtros]);

  useEffect(() => {
    window.sessionStorage.setItem(CHAVE_ROTULOS, JSON.stringify(rotulosFiltro));
  }, [rotulosFiltro]);

  useEffect(() => {
    return conectarRealtime({
      rooms: ['fiscal-enquadramentos'],
      onMessage: () => setRecarga((n) => n + 1),
      onReconnect: () => setRecarga((n) => n + 1),
    });
  }, []);

  async function exportar() {
    try {
      const blob = await enquadramentosApi.exportar({ ...filtros, search: busca });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'enquadramentos-fiscais.csv';
      link.click();
      URL.revokeObjectURL(url);
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : 'Falha ao exportar.');
    }
  }

  function selecionar(id: string) {
    setAlerta(null);
    setPreCondicoes([]);
    setAba('ficha');
    if (id === selecionadoId) {
      void carregarFicha(id);
      return;
    }
    setDetalhe(null);
    setHistorico([]);
    setErroFicha(null);
    setSelecionadoId(id);
  }

  function ordenar(coluna: string) {
    setFiltros((atual) => ({
      ...atual,
      sort: coluna,
      dir: atual.sort === coluna && atual.dir === 'asc' ? 'desc' : 'asc',
      page: 1,
    }));
  }

  /** Lista e ficha abertas com o que está gravado; deve terminar antes de a tela aceitar a próxima edição. */
  async function atualizarApos(id: string) {
    await Promise.all([carregar(), carregarFicha(id)]);
  }

  async function salvar(corpo: CorpoEnquadramento): Promise<string | null> {
    try {
      if (editando) {
        if (!fichaEdicao || removidoEdicao) return 'Este registro foi removido por outro usuário.';
        const resto = Object.fromEntries(
          Object.entries(corpo).filter(([chave]) => chave !== 'estabelecimentoId'),
        ) as Omit<CorpoEnquadramento, 'estabelecimentoId'>;
        await enquadramentosApi.atualizar(fichaEdicao.id, { ...resto, versao: versaoEdicao });
        await atualizarApos(fichaEdicao.id);
      } else {
        await enquadramentosApi.criar(corpo);
        await carregar();
      }
      toast.success('Enquadramento salvo.');
      setDrawer(false);
      setErroDrawer(null);
      setConflitoDrawer(false);
      return null;
    } catch (erro) {
      if (erro instanceof ErroEnquadramento) {
        if (editando && erro.status === 404) setRemovidoEdicao(true);
        setConflitoDrawer(erro.codigo === 'CONFLITO_CONCORRENTE');
        if (erro.codigo === 'CONFLITO_CONCORRENTE' && fichaEdicao) void carregarFicha(fichaEdicao.id);
        return mensagemSobreposicao(erro) ?? erro.message;
      }
      return 'Falha na operação.';
    }
  }

  function situacao(acao: AcaoSituacao) {
    if (!detalhe) return;
    const { id, versao } = detalhe;
    const textos = TEXTOS_SITUACAO[acao];
    setDecisao({
      titulo: textos.titulo,
      detalhe: textos.detalhe,
      rotuloConfirmar: textos.rotulo,
      perigosa: acao === 'remover',
      mensagemSucesso: textos.sucesso,
      executar: async (justificativa) => {
        try {
          if (acao === 'remover') await enquadramentosApi.remover(id, justificativa);
          else await enquadramentosApi[acao](id, { versao, justificativa });
        } catch (erro) {
          if (erro instanceof ErroEnquadramento && erro.codigo === 'CONFLITO_CONCORRENTE') void carregarFicha(id);
          throw erro;
        }
        if (acao === 'remover') {
          pedidoFicha.current += 1;
          setSelecionadoId(null);
          setDetalhe(null);
          await carregar();
        } else {
          await atualizarApos(id);
        }
      },
    });
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
    try {
      setPreCondicoes(await enquadramentosApi.preCondicoes(detalhe.id));
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : 'Falha na operação.');
    }
  }

  function abrirNovoRegistro(foco: string | null = null) {
    setErroDrawer(null);
    setConflitoDrawer(false);
    setSelecaoCodigo(null);
    setFocoDrawer(foco);
    setFichaEdicao(null);
    setRemovidoEdicao(false);
    setEditando(false);
    setDrawer(true);
  }

  function abrirEdicao() {
    if (!detalhe) return;
    setErroDrawer(null);
    setConflitoDrawer(false);
    setSelecaoCodigo(null);
    setFocoDrawer(null);
    setFichaEdicao(detalhe);
    setRemovidoEdicao(false);
    setVersaoEdicao(detalhe.versao);
    setEditando(true);
    setDrawer(true);
  }

  /** Busca a versão atual da ficha em edição; os campos digitados ficam no drawer e a versão enviada passa a ser a nova. */
  async function recarregarEdicao(): Promise<DetalheEnquadramento | null> {
    if (!fichaEdicao) return null;
    try {
      const atual = await enquadramentosApi.obter(fichaEdicao.id);
      setVersaoEdicao(atual.versao);
      setDetalhe((anterior) => (anterior?.id === atual.id ? atual : anterior));
      setErroDrawer(null);
      setConflitoDrawer(false);
      return atual;
    } catch (erro) {
      if (erro instanceof ErroEnquadramento && erro.status === 404) {
        setRemovidoEdicao(true);
        setErroDrawer(null);
        setConflitoDrawer(false);
      } else {
        setErroDrawer(erro instanceof Error ? erro.message : 'Falha na operação.');
      }
      return null;
    }
  }

  function abrirDuplicar() {
    if (detalhe) setAlvoDuplicar({ id: detalhe.id, versao: detalhe.versao, prioridade: detalhe.prioridade });
  }

  function comboBusca(rotulo: string, id: string, tipo: 'estabelecimentos' | 'cfops' | 'produtos' | 'clientes', chave: ChaveBuscaFiltro) {
    return (
      <label className="grid gap-1 text-xs" htmlFor={id}>
        {rotulo}
        <ComboboxBusca
          id={id}
          tipo={tipo}
          value={filtros[chave]}
          rotulo={rotulosFiltro[chave] ?? ''}
          clearable
          onChange={(opcao) => {
            setRotulosFiltro((atual) => ({ ...atual, [chave]: opcao?.rotulo ?? '' }));
            setFiltros((atual) => ({ ...atual, [chave]: opcao?.id ?? '', page: 1 }));
          }}
          placeholder={rotulo}
          searchPlaceholder={`Buscar ${rotulo.toLowerCase()}`}
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
        <Button type="button" variant="secondary" onClick={() => void exportar()}>Exportar</Button>
        {podeGerenciar && (
          <Button type="button" variant="secondary" onClick={() => abrirNovoRegistro()}>+ Novo registro</Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" aria-haspopup="menu">Ações do processo <ChevronDown aria-hidden="true" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            onCloseAutoFocus={(evento) => { if (focoDrawer) evento.preventDefault(); }}
          >
            <DropdownMenuItem onSelect={() => abrirNovoRegistro()}>Cadastrar operação</DropdownMenuItem>
            <DropdownMenuItem disabled={!detalhe} onSelect={abrirDuplicar}>Duplicar perfil</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => abrirNovoRegistro('enq-prod')}>Relacionar produto e cliente</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => abrirNovoRegistro('enq-prioridade')}>Controlar prioridade</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <div className="grid gap-2 md:grid-cols-4">
          {comboBusca('Estabelecimento', 'filtro-estab', 'estabelecimentos', 'estabelecimentoId')}
          {comboBusca('Operação fiscal (CFOP)', 'filtro-cfop', 'cfops', 'cfopId')}
          {comboBusca('Produto', 'filtro-prod', 'produtos', 'produtoId')}
          {comboBusca('Cliente', 'filtro-cli', 'clientes', 'clienteId')}
        </div>
        <Button type="button" variant="secondary" onClick={() => void exportar()}>Exportar visão</Button>
        <GradeEnquadramentos
          linhas={linhas}
          total={paginacao.total}
          pageSize={paginacao.pageSize}
          carregando={carregando}
          erro={erroLista}
          filtros={filtros}
          selecionadoId={selecionadoId}
          onSelecionar={selecionar}
          onOrdenar={ordenar}
          onPagina={(page) => setFiltros((atual) => ({ ...atual, page }))}
          onTentarNovamente={() => setRecarga((n) => n + 1)}
        />
      </section>
      <section className="grid gap-2">
        <h2 className="text-sm font-semibold">Detalhamento e execução</h2>
        {erroFicha && <p role="alert" className="text-sm text-destructive">{erroFicha}</p>}
        {detalhe && (
          <AbasDetalhe
            detalhe={detalhe}
            podeGerenciar={podeGerenciar}
            aba={aba}
            onAba={setAba}
            alerta={alerta}
            historico={historico}
            preCondicoes={preCondicoes}
            onValidarPreCondicoes={() => void validarPreCondicoes()}
            onConsultar={() => void consultar()}
            onEditar={abrirEdicao}
            onDuplicar={abrirDuplicar}
            onInativar={() => situacao('inativar')}
            onReativar={() => situacao('reativar')}
            onRemover={() => situacao('remover')}
          />
        )}
      </section>
      <EnquadramentoDrawer
        aberto={drawer}
        detalhe={editando ? fichaEdicao : null}
        erro={erroDrawer}
        selecaoCodigo={selecaoCodigo}
        focoInicial={focoDrawer}
        removido={removidoEdicao}
        conflito={conflitoDrawer}
        onRecarregar={recarregarEdicao}
        onFechar={() => setDrawer(false)}
        onSalvar={salvar}
        onErro={setErroDrawer}
        onNovoCodigo={setCodigoTipo}
      />
      <DuplicarDialog
        aberto={alvoDuplicar !== null}
        prioridadeOrigem={alvoDuplicar?.prioridade ?? 1}
        erro={erroDuplicar}
        onFechar={() => { setAlvoDuplicar(null); setErroDuplicar(null); }}
        onConfirmar={(corpo) => {
          if (!alvoDuplicar) return;
          // Versão capturada ao abrir o diálogo: se a ficha mudou desde então, o servidor responde 409.
          const { id, versao } = alvoDuplicar;
          void enquadramentosApi.duplicar(id, { ...corpo, vigenciaFim: corpo.vigenciaFim || undefined, versao })
            .then(() => atualizarApos(id))
            .then(() => { setAlvoDuplicar(null); toast.success('Enquadramento salvo.'); })
            .catch((erro: unknown) => {
              if (erro instanceof ErroEnquadramento && erro.codigo === 'CONFLITO_CONCORRENTE') void carregarFicha(id);
              setErroDuplicar(erro instanceof ErroEnquadramento ? (mensagemSobreposicao(erro) ?? erro.message) : 'Falha na operação.');
            });
        }}
      />
      <DecisaoDialog
        decisao={decisao}
        onFechar={() => setDecisao(null)}
        onConcluido={() => undefined}
        onConflito={() => undefined}
      />
      <CodigoFiscalDialog
        aberto={codigoTipo !== null}
        tipo={codigoTipo}
        onFechar={() => setCodigoTipo(null)}
        onConfirmar={async (corpo) => {
          if (!codigoTipo) return;
          const tipo = codigoTipo;
          const criado = await enquadramentosApi.criarCodigo(tipo, corpo);
          const codigo = tipo === 'cfops' ? mascararCfop(criado.codigo) : mascararNcm(criado.codigo);
          setSelecaoCodigo({ tipo, id: criado.id, rotulo: `${codigo} ${criado.descricao}`.trim() });
          setCodigoTipo(null);
        }}
      />
    </div>
  );
}
