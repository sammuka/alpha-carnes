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
import { rotuloData } from '@/lib/fiscal-enquadramentos';
import { conectarRealtime } from '@/lib/realtime';
import {
  CHAVE_LISTA,
  FILTROS_LISTA,
  SITUACOES,
  TEXTO_PENDENTE,
  TEXTO_VAZIO,
  ErroAcaoHomologacao,
  ErroHomologacao,
  homologacoesApi,
  mensagemDeHomologacao,
  type Contagens,
  type CorpoAbertura,
  type DetalheHomologacao,
  type EventoHistorico,
  type LinhaHomologacao,
  type PreCondicao,
} from '@/lib/fiscal-homologacoes';
import { GradeFiscal, type ColunaGrade } from '../comum/grade-fiscal';
import { useFichaFiscal } from '../comum/use-ficha-fiscal';
import { useListaFiscal } from '../comum/use-lista-fiscal';
import { AbasDetalhe, podeDecidir, podePublicar, type IdAba } from './abas-detalhe';
import { CenarioDialog, type AlvoCenario } from './cenario-dialog';
import { DecisaoDialog, type DecisaoPendente } from './decisao-dialog';
import { DiffDialog } from './diff-dialog';
import { HomologacaoDrawer } from './homologacao-drawer';

const COLUNAS: ColunaGrade<LinhaHomologacao>[] = [
  { id: 'enquadramento', rotulo: 'Enquadramento fiscal', celula: (l) => l.enquadramento },
  { id: 'vigenciaInicio', rotulo: 'Início de vigência', celula: (l) => rotuloData(l.vigenciaInicio) },
  { id: 'situacao', rotulo: 'Situação', celula: (l) => l.situacao, ordenavel: false },
  { id: 'usuario', rotulo: 'Usuário', celula: (l) => l.usuario },
  { id: 'aprovador', rotulo: 'Responsável pela aprovação', celula: (l) => l.aprovador || TEXTO_PENDENTE },
  { id: 'descricao', rotulo: 'Descrição', celula: (l) => l.descricao },
];

const MENSAGEM_NAO_ENCONTRADA = 'A homologação selecionada não está mais disponível.';
const MENSAGEM_REMOVIDA = 'Esta homologação não está mais disponível. O que foi digitado continua aqui, mas não pode ser enviado.';

/** Lê ficha e histórico juntos; função de módulo para manter a identidade estável. */
const buscarFicha = (id: string): Promise<[DetalheHomologacao, EventoHistorico[]]> =>
  Promise.all([homologacoesApi.obter(id), homologacoesApi.historico(id)]);

const texto = (falha: unknown) => (falha instanceof Error ? falha.message : 'Falha na operação.');

export function HomologacoesClient({ podeGerenciar, podeAprovar }: { podeGerenciar: boolean; podeAprovar: boolean }) {
  const [recarga, setRecarga] = useState(0);
  const lista = useListaFiscal<typeof FILTROS_LISTA, LinhaHomologacao, Contagens>({
    chave: CHAVE_LISTA,
    padrao: FILTROS_LISTA,
    listar: homologacoesApi.listar,
    contagens: homologacoesApi.contagens,
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
  const [drawer, setDrawer] = useState(false);
  const [diffAberto, setDiffAberto] = useState(false);
  /** Homologação e versão quando o diálogo de cenário abriu. */
  const [alvoCenario, setAlvoCenario] = useState<(AlvoCenario & { id: string }) | null>(null);
  const [decisao, setDecisao] = useState<(DecisaoPendente & { id: string }) | null>(null);

  useEffect(() => conectarRealtime({
    rooms: ['fiscal-homologacoes'],
    onMessage: () => setRecarga((n) => n + 1),
    onReconnect: () => setRecarga((n) => n + 1),
  }), []);

  /** Lista e ficha abertas com o que está gravado; termina antes de a tela aceitar a próxima ação. */
  async function atualizarApos(id: string) {
    await Promise.all([lista.carregar(), ficha.carregar(id)]);
  }

  /** Executa a ação do servidor; a falha segue ao diálogo com o texto da tela e a indicação de conflito. */
  async function executar(id: string, chamada: () => Promise<unknown>, sucesso: string) {
    try {
      await chamada();
    } catch (erro) {
      if (erro instanceof ErroHomologacao) {
        if (erro.status === 404) throw new ErroAcaoHomologacao(MENSAGEM_REMOVIDA, false, true);
        throw new ErroAcaoHomologacao(mensagemDeHomologacao(erro), erro.codigo === 'CONFLITO_CONCORRENTE');
      }
      throw erro;
    }
    toast.success(sucesso);
    await atualizarApos(id);
  }

  async function exportar() {
    try {
      baixarArquivo(await homologacoesApi.exportar({ ...filtros, search: lista.busca }), 'homologacoes.csv');
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

  async function salvar(corpo: CorpoAbertura): Promise<FalhaSalvar | null> {
    try {
      const criada = await homologacoesApi.criar(corpo);
      toast.success('Revisão aberta.');
      setDrawer(false);
      await lista.carregar();
      selecionar(criada.id);
      return null;
    } catch (erro) {
      if (erro instanceof ErroHomologacao) return { mensagem: mensagemDeHomologacao(erro), porCampo: erro.porCampo };
      return { mensagem: 'Falha na operação.', porCampo: {} };
    }
  }

  function abrirDecisao() {
    if (!detalhe) return;
    const { id, versao } = detalhe;
    setDecisao({
      id,
      titulo: 'Aprovar/rejeitar',
      versao,
      recarregar: () => recarregarVersao(id),
      acoes: [
        {
          rotulo: 'Aprovar',
          executar: (justificativa, vigente) => executar(id, () => homologacoesApi.aprovar(id, { versao: vigente, justificativa }), 'Homologação aprovada.'),
        },
        {
          rotulo: 'Rejeitar',
          perigosa: true,
          executar: (justificativa, vigente) => executar(id, () => homologacoesApi.rejeitar(id, { versao: vigente, justificativa }), 'Homologação rejeitada.'),
        },
      ],
    });
  }

  function abrirPublicacao() {
    if (!detalhe) return;
    const { id, versao } = detalhe;
    setDecisao({
      id,
      titulo: 'Publicar e auditar',
      versao,
      recarregar: () => recarregarVersao(id),
      acoes: [{
        rotulo: 'Publicar',
        executar: (justificativa, vigente) => executar(id, () => homologacoesApi.publicar(id, { versao: vigente, justificativa }), 'Homologação publicada.'),
      }],
    });
  }

  /** Relê a homologação após um 409 e devolve a versão nova, ou `null` se ela não existe mais. */
  async function recarregarVersao(id: string): Promise<number | null> {
    const fresca = await ficha.carregar(id);
    return fresca ? fresca.versao : null;
  }

  function abrirCenarios() {
    if (detalhe) setAlvoCenario({ id: detalhe.id, regraId: detalhe.regraId, versao: detalhe.versao });
  }

  async function validarPreCondicoes() {
    if (!detalhe) return;
    setCarregandoPreCondicoes(true);
    setErroPreCondicoes(null);
    try {
      setPreCondicoes(await homologacoesApi.preCondicoes(detalhe.id));
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
      ficha.setHistorico(await homologacoesApi.historico(detalhe.id));
    } catch (erro) {
      setErroHistorico(texto(erro));
    } finally {
      setCarregandoHistorico(false);
    }
  }

  const situacao = detalhe?.situacao ?? '';
  /** Outro usuário removeu a homologação enquanto o diálogo estava aberto. */
  const decisaoRemovida = decisao !== null && detalhe?.id !== decisao.id;
  const cenarioRemovido = alvoCenario !== null && detalhe?.id !== alvoCenario.id;

  return (
    <div className="grid gap-4">
      <PageHeader
        title="Painel de alterações e homologação de regras"
        subtitle="revisar diff, aprovar/rejeitar, publicar e auditar."
        badge={(
          <span className="inline-flex items-center gap-2">
            Acesso típico
            <BadgeProvisorio codigo="H-E01-12" />
          </span>
        )}
        live
      >
        <Button type="button" variant="secondary" onClick={() => void exportar()}>Exportar</Button>
        {podeGerenciar && <Button type="button" onClick={() => setDrawer(true)}>+ Novo registro</Button>}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" aria-haspopup="menu">Ações do processo <ChevronDown aria-hidden="true" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem disabled={!detalhe} onSelect={() => setDiffAberto(true)}>Revisar diff</DropdownMenuItem>
            {podeAprovar && <DropdownMenuItem disabled={!detalhe || !podeDecidir(situacao)} onSelect={abrirDecisao}>Aprovar/rejeitar</DropdownMenuItem>}
            {podeAprovar && <DropdownMenuItem disabled={!detalhe || !podePublicar(situacao)} onSelect={abrirPublicacao}>Publicar e auditar</DropdownMenuItem>}
          </DropdownMenuContent>
        </DropdownMenu>
      </PageHeader>
      <KpiStrip>
        <Kpi label="Em revisão" value={lista.contagens?.emRevisao ?? '—'} />
        <Kpi label="Aprovadas" value={lista.contagens?.aprovadas ?? '—'} />
        <Kpi label="Rejeitadas" value={lista.contagens?.rejeitadas ?? '—'} />
        <Kpi label="Publicadas" value={lista.contagens?.publicadas ?? '—'} />
      </KpiStrip>
      <section className="grid gap-3">
        <h2 className="text-sm font-semibold">Registros e consultas</h2>
        <div className="flex flex-wrap gap-2">
          <input
            aria-label="Pesquisar descrição ou referência de negócio"
            placeholder="Pesquisar descrição ou referência de negócio"
            className="h-8 min-w-64 rounded-md border px-2 text-sm"
            value={lista.busca}
            onChange={(e) => lista.setBusca(e.target.value)}
          />
          <select
            aria-label="Situação"
            className="h-8 rounded-md border px-2 text-sm"
            value={filtros.situacao}
            onChange={(e) => setFiltros((atual) => ({ ...atual, situacao: e.target.value, page: 1 }))}
          >
            <option value="">Todos</option>
            {SITUACOES.map(([valor, rotulo]) => <option key={valor} value={valor}>{rotulo}</option>)}
          </select>
          <Button type="button" variant="secondary" onClick={() => void exportar()}>Exportar visão</Button>
        </div>
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
            podeAprovar={podeAprovar}
            aba={aba}
            onAba={setAba}
            historico={ficha.historico}
            carregandoHistorico={carregandoHistorico}
            erroHistorico={erroHistorico}
            preCondicoes={preCondicoes}
            carregandoPreCondicoes={carregandoPreCondicoes}
            erroPreCondicoes={erroPreCondicoes}
            onCenarios={abrirCenarios}
            onRevisarDiff={() => setDiffAberto(true)}
            onDecidir={abrirDecisao}
            onPublicar={abrirPublicacao}
            onValidarPreCondicoes={() => void validarPreCondicoes()}
            onConsultarHistorico={() => void consultarHistorico()}
          />
        )}
      </section>
      <HomologacaoDrawer aberto={drawer} onFechar={() => setDrawer(false)} onSalvar={salvar} />
      <DiffDialog
        aberto={diffAberto}
        carregar={async () => (detalhe ? (await homologacoesApi.diff(detalhe.id)).diferencas ?? [] : [])}
        onFechar={() => setDiffAberto(false)}
      />
      <DecisaoDialog decisao={decisao} bloqueado={decisaoRemovida ? MENSAGEM_REMOVIDA : null} onFechar={() => setDecisao(null)} />
      <CenarioDialog
        aberto={alvoCenario !== null}
        alvo={alvoCenario}
        bloqueado={cenarioRemovido ? MENSAGEM_REMOVIDA : null}
        onFechar={() => setAlvoCenario(null)}
        onRecarregar={() => (alvoCenario ? recarregarVersao(alvoCenario.id) : Promise.resolve(null))}
        onVincular={async (simulacaoId, justificativa, versao) => {
          if (!alvoCenario) return;
          await executar(
            alvoCenario.id,
            () => homologacoesApi.vincular(alvoCenario.id, { simulacaoId, versao, justificativa }),
            'Cenário vinculado.',
          );
          setAlvoCenario(null);
        }}
      />
    </div>
  );
}
