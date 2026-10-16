'use client';

import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { BadgeProvisorio } from '@/components/ui/badge-provisorio';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Kpi, KpiStrip } from '@/components/ui/kpi-strip';
import { PageHeader } from '@/components/ui/page-header';
import { baixarArquivo, type FalhaSalvar } from '@/lib/fiscal-comum-ui';
import { conectarRealtime } from '@/lib/realtime';
import {
  CHAVE_LISTA,
  FILTROS_LISTA,
  TEXTO_VAZIO,
  ErroSimulacao,
  mensagemDeSimulacao,
  simulacoesApi,
  type Contagens,
  type CorpoSimulacao,
  type DetalheSimulacao,
  type EventoHistorico,
  type Explicacao,
  type LinhaSimulacao,
  type PreCondicao,
} from '@/lib/fiscal-simulacoes';
import { ComboboxBusca } from '../enquadramentos/combobox-busca';
import { GradeFiscal, type ColunaGrade } from '../comum/grade-fiscal';
import { useFichaFiscal } from '../comum/use-ficha-fiscal';
import { useListaFiscal } from '../comum/use-lista-fiscal';
import { AbasDetalhe, type IdAba } from './abas-detalhe';
import { CompararDialog } from './comparar-dialog';
import { SimulacaoDrawer } from './simulacao-drawer';
import { VersaoDialog } from './versao-dialog';

const COLUNAS: ColunaGrade<LinhaSimulacao>[] = [
  { id: 'cliente', rotulo: 'Cliente', celula: (l) => l.cliente },
  { id: 'produto', rotulo: 'Produto', celula: (l) => l.produto },
  { id: 'valor', rotulo: 'Valor', celula: (l) => l.valor, className: 'font-data' },
  { id: 'valorLiquido', rotulo: 'Valor líquido (calculado)', celula: (l) => l.valorLiquido, className: 'font-data' },
  { id: 'estabelecimento', rotulo: 'Estabelecimento', celula: (l) => l.estabelecimento },
  { id: 'operacao', rotulo: 'Operação', celula: (l) => l.operacao },
];

const CHAVE_ROTULOS = 'fiscal.simulador.rotulos';
const MENSAGEM_NAO_ENCONTRADA = 'A simulação selecionada não está mais disponível.';
const MENSAGEM_REMOVIDA = 'Esta simulação não está mais disponível. O que foi digitado continua aqui, mas não pode ser salvo.';
type ChaveFiltro = 'estabelecimentoId' | 'clienteId' | 'produtoId';

/** Lê ficha e histórico juntos; função de módulo para manter a identidade estável. */
const buscarFicha = (id: string): Promise<[DetalheSimulacao, EventoHistorico[]]> =>
  Promise.all([simulacoesApi.obter(id), simulacoesApi.historico(id)]);

function lerRotulos(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(window.sessionStorage.getItem(CHAVE_ROTULOS) ?? '{}') as Record<string, string>;
  } catch {
    return {};
  }
}

const texto = (falha: unknown) => (falha instanceof Error ? falha.message : 'Falha na operação.');

export function SimulacoesClient({ podeGerenciar }: { podeGerenciar: boolean }) {
  const [recarga, setRecarga] = useState(0);
  const lista = useListaFiscal<typeof FILTROS_LISTA, LinhaSimulacao, Contagens>({
    chave: CHAVE_LISTA,
    padrao: FILTROS_LISTA,
    listar: simulacoesApi.listar,
    contagens: simulacoesApi.contagens,
    recarga,
  });
  const ficha = useFichaFiscal({ buscar: buscarFicha, recarga, mensagemNaoEncontrada: MENSAGEM_NAO_ENCONTRADA });
  const { filtros, setFiltros } = lista;
  const detalhe = ficha.detalhe;

  const [aba, setAba] = useState<IdAba>('ficha');
  const [preCondicoes, setPreCondicoes] = useState<PreCondicao[]>([]);
  const [carregandoPreCondicoes, setCarregandoPreCondicoes] = useState(false);
  const [erroPreCondicoes, setErroPreCondicoes] = useState<string | null>(null);
  const [carregandoHistorico, setCarregandoHistorico] = useState(false);
  const [erroHistorico, setErroHistorico] = useState<string | null>(null);
  const [explicacao, setExplicacao] = useState<Explicacao | null>(null);
  const [carregandoExplicacao, setCarregandoExplicacao] = useState(false);
  const [erroExplicacao, setErroExplicacao] = useState<string | null>(null);
  const [falta, setFalta] = useState<string | null>(null);
  const [drawer, setDrawer] = useState(false);
  /** Simulação de origem da versão nova: cópia e versão enviada, tiradas ao abrir. */
  const [alvoVersao, setAlvoVersao] = useState<DetalheSimulacao | null>(null);
  const [compararAberto, setCompararAberto] = useState(false);
  const [rotulosFiltro, setRotulosFiltro] = useState<Record<string, string>>(lerRotulos);

  useEffect(() => { window.sessionStorage.setItem(CHAVE_ROTULOS, JSON.stringify(rotulosFiltro)); }, [rotulosFiltro]);
  useEffect(() => conectarRealtime({
    rooms: ['fiscal-simulacoes'],
    onMessage: () => setRecarga((n) => n + 1),
    onReconnect: () => setRecarga((n) => n + 1),
  }), []);

  /** A explicação pertence à simulação aberta; troca de registro ou de versão a descarta. */
  const idFicha = detalhe?.id;
  useEffect(() => {
    setExplicacao(null);
    setErroExplicacao(null);
  }, [idFicha]);

  async function carregarExplicacao(id: string) {
    setCarregandoExplicacao(true);
    setErroExplicacao(null);
    try {
      setExplicacao(await simulacoesApi.explicar(id));
    } catch (erro) {
      setExplicacao(null);
      setErroExplicacao(texto(erro));
    } finally {
      setCarregandoExplicacao(false);
    }
  }

  /** A exceção "base tributável difere do valor bruto" cita o texto da explicação. */
  useEffect(() => {
    if (aba === 'excecoes' && detalhe?.baseDifereBruto && !explicacao && !carregandoExplicacao && !erroExplicacao) {
      void carregarExplicacao(detalhe.id);
    }
  }, [aba, detalhe?.id, detalhe?.baseDifereBruto, explicacao, carregandoExplicacao, erroExplicacao]);

  function falhaDe(erro: unknown): FalhaSalvar {
    if (!(erro instanceof ErroSimulacao)) return { mensagem: 'Falha na operação.', porCampo: {} };
    const mensagem = mensagemDeSimulacao(erro);
    if (erro.codigo === 'FALTA_REFERENCIA_LEGAL') setFalta(mensagem);
    return { mensagem, porCampo: erro.porCampo, conflito: erro.codigo === 'CONFLITO_CONCORRENTE' };
  }

  async function exportar() {
    try {
      baixarArquivo(await simulacoesApi.exportar({ ...filtros, search: lista.busca }), 'simulacoes-fiscais.csv');
    } catch (erro) {
      toast.error(texto(erro));
    }
  }

  async function exportarMemoria() {
    if (!detalhe) return;
    try {
      baixarArquivo(await simulacoesApi.exportarMemoria(detalhe.id), 'memoria-de-calculo.csv');
    } catch (erro) {
      toast.error(texto(erro));
    }
  }

  function selecionar(id: string) {
    setPreCondicoes([]);
    setErroPreCondicoes(null);
    setErroHistorico(null);
    setAba('ficha');
    ficha.selecionar(id);
  }

  /** Abre a ficha da simulação ou da versão recém-gravada. */
  async function abrirCriada(criada: DetalheSimulacao) {
    await lista.carregar();
    selecionar(criada.id);
  }

  async function salvar(corpo: CorpoSimulacao): Promise<FalhaSalvar | null> {
    try {
      const criada = await simulacoesApi.criar(corpo);
      toast.success('Simulação calculada.');
      setDrawer(false);
      await abrirCriada(criada);
      return null;
    } catch (erro) {
      return falhaDe(erro);
    }
  }

  async function salvarVersao(corpo: CorpoSimulacao & { versao: number }): Promise<FalhaSalvar | null> {
    if (!alvoVersao || versaoRemovida) return { mensagem: MENSAGEM_REMOVIDA, porCampo: {} };
    try {
      const nova = await simulacoesApi.versao(alvoVersao.id, corpo);
      toast.success('Simulação calculada.');
      setAlvoVersao(null);
      await abrirCriada(nova);
      return null;
    } catch (erro) {
      return falhaDe(erro);
    }
  }

  /** 409 no diálogo: relê a origem e passa a enviar a versão nova, sem tocar no que foi digitado. */
  async function recarregarVersao(): Promise<boolean> {
    if (!alvoVersao) return false;
    const fresca = await ficha.carregar(alvoVersao.id);
    if (!fresca) return false;
    setAlvoVersao({ ...alvoVersao, versao: fresca.versao });
    return true;
  }

  function abrirVersao() {
    if (detalhe) setAlvoVersao(detalhe);
  }

  /** O resultado da explicação aparece na aba Ficha; a tela vai para lá antes de carregar. */
  async function explicar() {
    if (!detalhe) return;
    setAba('ficha');
    await carregarExplicacao(detalhe.id);
  }

  async function validarPreCondicoes() {
    if (!detalhe) return;
    setCarregandoPreCondicoes(true);
    setErroPreCondicoes(null);
    try {
      setPreCondicoes(await simulacoesApi.preCondicoes(detalhe.id));
    } catch (erro) {
      setPreCondicoes([]);
      setErroPreCondicoes(texto(erro));
    } finally {
      setCarregandoPreCondicoes(false);
    }
  }

  async function consultarHistorico() {
    setAba('historico');
    if (!detalhe) return;
    setCarregandoHistorico(true);
    setErroHistorico(null);
    try {
      ficha.setHistorico(await simulacoesApi.historico(detalhe.id));
    } catch (erro) {
      setErroHistorico(texto(erro));
    } finally {
      setCarregandoHistorico(false);
    }
  }

  function comboFiltro(rotulo: string, id: string, tipo: 'estabelecimentos' | 'clientes' | 'produtos', chave: ChaveFiltro) {
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

  /** Outro usuário removeu a simulação enquanto o diálogo estava aberto. */
  const versaoRemovida = alvoVersao !== null && detalhe?.id !== alvoVersao.id;

  return (
    <div className="grid gap-4">
      <PageHeader
        title="Simulador fiscal e memória de cálculo"
        subtitle="Simular, explicar, exportar e comparar versões da memória."
        badge={<BadgeProvisorio codigo="H-E01-12" />}
        live
      >
        <Button type="button" variant="secondary" onClick={() => void exportar()}>Exportar</Button>
        {podeGerenciar && <Button type="button" onClick={() => setDrawer(true)}>+ Novo registro</Button>}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" aria-haspopup="menu">Ações do processo <ChevronDown aria-hidden="true" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {podeGerenciar && <DropdownMenuItem onSelect={() => setDrawer(true)}>Simular</DropdownMenuItem>}
            <DropdownMenuItem disabled={!detalhe} onSelect={() => void explicar()}>Explicar tributos</DropdownMenuItem>
            <DropdownMenuItem disabled={!detalhe} onSelect={() => setCompararAberto(true)}>Comparar versões</DropdownMenuItem>
            {podeGerenciar && <DropdownMenuItem disabled={!detalhe} onSelect={abrirVersao}>Nova versão</DropdownMenuItem>}
          </DropdownMenuContent>
        </DropdownMenu>
      </PageHeader>
      <KpiStrip>
        <Kpi label="Simulações" value={lista.contagens?.simulacoes ?? '—'} />
        <Kpi label="Versões" value={lista.contagens?.versoes ?? '—'} />
        <Kpi label="Base tributável difere de valor bruto" value={lista.contagens?.baseDiferente ?? '—'} />
      </KpiStrip>
      <section className="grid gap-3">
        <h2 className="text-sm font-semibold">Registros e consultas</h2>
        <input
          aria-label="Buscar cliente"
          placeholder="Pesquisar descrição ou referência de negócio"
          className="h-8 rounded-md border px-2 text-sm"
          value={lista.busca}
          onChange={(e) => lista.setBusca(e.target.value)}
        />
        <div className="grid gap-2 md:grid-cols-4">
          {comboFiltro('Estabelecimento', 'filtro-estab', 'estabelecimentos', 'estabelecimentoId')}
          {comboFiltro('Cliente', 'filtro-cli', 'clientes', 'clienteId')}
          {comboFiltro('Produto', 'filtro-prod', 'produtos', 'produtoId')}
          <label className="grid gap-1 text-xs">
            Competência
            <input
              aria-label="Competência"
              type="month"
              className="h-8 rounded-md border px-2 text-[13px]"
              value={filtros.competencia}
              onChange={(e) => setFiltros((atual) => ({ ...atual, competencia: e.target.value, page: 1 }))}
            />
          </label>
        </div>
        <Button type="button" variant="secondary" className="justify-self-start" onClick={() => void exportar()}>Exportar visão</Button>
        <GradeFiscal
          colunas={COLUNAS}
          linhas={lista.linhas}
          total={lista.total}
          pageSize={lista.pageSize}
          carregando={lista.carregando}
          erro={lista.erro}
          sort={filtros.sort}
          dir={filtros.dir}
          page={filtros.page}
          selecionadoId={ficha.selecionadoId}
          textoVazio={TEXTO_VAZIO}
          onSelecionar={selecionar}
          onOrdenar={lista.ordenar}
          onPagina={(page) => setFiltros((atual) => ({ ...atual, page }))}
          onTentarNovamente={() => setRecarga((n) => n + 1)}
        />
      </section>
      <section className="grid gap-2">
        <h2 className="text-sm font-semibold">Detalhamento e execução</h2>
        {ficha.erro && <p role="alert" className="text-sm text-destructive">{ficha.erro}</p>}
        {ficha.selecionadoId && (
          <AbasDetalhe
            detalhe={detalhe}
            carregandoFicha={ficha.carregando}
            podeGerenciar={podeGerenciar}
            aba={aba}
            onAba={setAba}
            historico={ficha.historico}
            carregandoHistorico={carregandoHistorico}
            erroHistorico={erroHistorico}
            preCondicoes={preCondicoes}
            carregandoPreCondicoes={carregandoPreCondicoes}
            erroPreCondicoes={erroPreCondicoes}
            explicacao={explicacao}
            carregandoExplicacao={carregandoExplicacao}
            erroExplicacao={erroExplicacao}
            falta={falta}
            onExplicar={() => void explicar()}
            onExportarMemoria={() => void exportarMemoria()}
            onComparar={() => setCompararAberto(true)}
            onNovaVersao={abrirVersao}
            onValidarPreCondicoes={() => void validarPreCondicoes()}
            onConsultarHistorico={() => void consultarHistorico()}
          />
        )}
      </section>
      <SimulacaoDrawer aberto={drawer} onFechar={() => setDrawer(false)} onSalvar={salvar} />
      <VersaoDialog
        aberto={alvoVersao !== null}
        origem={alvoVersao}
        bloqueado={versaoRemovida ? MENSAGEM_REMOVIDA : null}
        onRecarregar={recarregarVersao}
        onFechar={() => setAlvoVersao(null)}
        onSalvar={salvarVersao}
      />
      <CompararDialog aberto={compararAberto} detalhe={detalhe} onFechar={() => setCompararAberto(false)} />
    </div>
  );
}
