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
  ErroRegra,
  mensagemDeRegra,
  regrasApi,
  type ContagensRegra,
  type CorpoRegra,
  type DetalheRegra,
  type EventoHistorico,
  type LinhaRegra,
  type PreCondicao,
} from '@/lib/fiscal-regras';
import { DecisaoDialog, type DecisaoPendente } from '../empresas/decisao-dialog';
import { ComboboxBusca } from '../enquadramentos/combobox-busca';
import { GradeFiscal, type ColunaGrade } from '../comum/grade-fiscal';
import { useFichaFiscal } from '../comum/use-ficha-fiscal';
import { useListaFiscal } from '../comum/use-lista-fiscal';
import { AbasDetalhe, type IdAba, type OcorrenciasRegra } from './abas-detalhe';
import { CodigoTributarioDialog } from './codigo-tributario-dialog';
import { CompararDialog } from './comparar-dialog';
import { RegraDrawer, type SelecaoCodigoTributario } from './regra-drawer';
import { VersaoDialog } from './versao-dialog';

type AcaoRegra = 'submeter' | 'aprovar' | 'aposentar';

const TEXTOS_ACAO: Record<AcaoRegra, { titulo: string; detalhe: string; rotulo: string }> = {
  submeter: {
    titulo: 'Submeter regra',
    detalhe: 'A regra segue para aprovação por outro usuário. Informe a justificativa.',
    rotulo: 'Submeter',
  },
  aprovar: {
    titulo: 'Aprovar regra',
    detalhe: 'Só quem não submeteu a regra pode aprová-la. Informe a justificativa.',
    rotulo: 'Aprovar',
  },
  aposentar: {
    titulo: 'Aposentar regra',
    detalhe: 'A regra deixa de ser usada nas simulações. Informe a justificativa.',
    rotulo: 'Aposentar',
  },
};

const COLUNAS: ColunaGrade<LinhaRegra>[] = [
  { id: 'enquadramento', rotulo: 'Enquadramento fiscal', celula: (l) => l.enquadramentoFiscal },
  { id: 'cfop', rotulo: 'Operação fiscal (CFOP)', celula: (l) => l.operacaoFiscal, className: 'font-data' },
  { id: 'cBenef', rotulo: 'Benefício fiscal', celula: (l) => l.beneficioFiscal },
  { id: 'cClassTrib', rotulo: 'Classificação IBS/CBS', celula: (l) => l.classificacaoIbsCbs },
  { id: 'operacao', rotulo: 'Operação', celula: (l) => l.operacao },
  { id: 'icmsCst', rotulo: 'Tratamento ICMS', celula: (l) => l.tratamentoIcms },
];

const CHAVE_ROTULO_CFOP = 'fiscal.regras.rotulo-cfop';
const MENSAGEM_NAO_ENCONTRADA = 'A regra tributária selecionada não está mais disponível.';
const MENSAGEM_REMOVIDA = 'Esta regra não está mais disponível. O que foi digitado continua aqui, mas não pode ser salvo.';

/** Lê ficha e histórico juntos; função de módulo para manter a identidade estável. */
const buscarFicha = (id: string): Promise<[DetalheRegra, EventoHistorico[]]> =>
  Promise.all([regrasApi.obter(id), regrasApi.historico(id)]);

function lerRotuloCfop(): string {
  return typeof window === 'undefined' ? '' : window.sessionStorage.getItem(CHAVE_ROTULO_CFOP) ?? '';
}

const texto = (falha: unknown) => (falha instanceof Error ? falha.message : 'Falha na operação.');

export function RegrasClient({ podeGerenciar, podeAprovar }: { podeGerenciar: boolean; podeAprovar: boolean }) {
  const [recarga, setRecarga] = useState(0);
  const lista = useListaFiscal<typeof FILTROS_LISTA, LinhaRegra, ContagensRegra>({
    chave: CHAVE_LISTA,
    padrao: FILTROS_LISTA,
    listar: regrasApi.listar,
    contagens: regrasApi.contagens,
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
  const [ocorrencias, setOcorrencias] = useState<OcorrenciasRegra>({});
  const [drawer, setDrawer] = useState(false);
  /** Versão em edição: cópia e versão enviada, tiradas ao abrir (um 409 legítimo avisa se mudou). */
  const [edicao, setEdicao] = useState<{ detalhe: DetalheRegra; versao: number } | null>(null);
  const [selecaoCodigo, setSelecaoCodigo] = useState<SelecaoCodigoTributario | null>(null);
  const [codigoTipo, setCodigoTipo] = useState<'beneficio' | 'classificacao' | null>(null);
  /** Versão de origem da versão nova: cópia e versão enviada, tiradas ao abrir. */
  const [alvoVersao, setAlvoVersao] = useState<DetalheRegra | null>(null);
  const [compararAberto, setCompararAberto] = useState(false);
  const [decisao, setDecisao] = useState<DecisaoPendente | null>(null);
  const [rotuloCfop, setRotuloCfop] = useState(lerRotuloCfop);

  useEffect(() => { window.sessionStorage.setItem(CHAVE_ROTULO_CFOP, rotuloCfop); }, [rotuloCfop]);
  useEffect(() => conectarRealtime({
    rooms: ['fiscal-regras'],
    onMessage: () => setRecarga((n) => n + 1),
    onReconnect: () => setRecarga((n) => n + 1),
  }), []);

  /** Lista e ficha abertas com o que está gravado; termina antes de a tela aceitar a próxima edição. */
  async function atualizarApos(id: string) {
    await Promise.all([lista.carregar(), ficha.carregar(id)]);
  }

  /** Guarda a última recusa das exceções documentadas. */
  function registrar(erro: unknown) {
    if (!(erro instanceof ErroRegra)) return;
    const mensagem = mensagemDeRegra(erro);
    if (erro.codigo === 'BENEFICIO_NAO_ELEGIVEL' || erro.codigo === 'CLASSIFICACAO_NAO_ATIVA') {
      setOcorrencias((atual) => ({ ...atual, beneficio: mensagem }));
    }
    if (erro.codigo === 'VIGENCIA_AMBIGUA') setOcorrencias((atual) => ({ ...atual, vigencia: mensagem }));
  }

  function falhaDe(erro: unknown): FalhaSalvar {
    registrar(erro);
    if (erro instanceof ErroRegra) return { mensagem: mensagemDeRegra(erro), porCampo: erro.porCampo, conflito: erro.codigo === 'CONFLITO_CONCORRENTE' };
    return { mensagem: 'Falha na operação.', porCampo: {} };
  }

  async function exportar() {
    try {
      baixarArquivo(await regrasApi.exportar({ ...filtros, search: lista.busca }), 'regras-tributarias.csv');
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

  async function salvar(corpo: CorpoRegra): Promise<FalhaSalvar | null> {
    // Edição nunca cai em "criar": se o registro sumiu, o formulário fica bloqueado.
    if (edicao && removidoNaEdicao) return { mensagem: MENSAGEM_REMOVIDA, porCampo: {} };
    try {
      if (edicao) {
        await regrasApi.atualizar(edicao.detalhe.id, { ...corpo, versao: edicao.versao });
        await atualizarApos(edicao.detalhe.id);
      } else {
        await regrasApi.criar(corpo);
        await lista.carregar();
      }
      toast.success('Regra tributária salva.');
      setDrawer(false);
      return null;
    } catch (erro) {
      return falhaDe(erro);
    }
  }

  /** 409 no formulário: relê o registro e passa a enviar a versão nova, sem tocar no que foi digitado. */
  async function recarregarEdicao(): Promise<boolean> {
    if (!edicao) return false;
    const fresca = await ficha.carregar(edicao.detalhe.id);
    if (!fresca) return false;
    setEdicao({ detalhe: edicao.detalhe, versao: fresca.versao });
    void lista.carregar();
    return true;
  }

  function decidir(acao: AcaoRegra) {
    if (!detalhe) return;
    const { id } = detalhe;
    const alvo = { versao: detalhe.versao };
    const textos = TEXTOS_ACAO[acao];
    setDecisao({
      titulo: textos.titulo,
      detalhe: textos.detalhe,
      rotuloConfirmar: textos.rotulo,
      perigosa: acao === 'aposentar',
      mensagemSucesso: 'Regra tributária salva.',
      executar: async (justificativa) => {
        try {
          await regrasApi[acao](id, { versao: alvo.versao, justificativa });
        } catch (erro) {
          registrar(erro);
          throw erro;
        }
        await atualizarApos(id);
      },
      recarregar: async () => {
        const fresca = await ficha.carregar(id);
        if (!fresca) return false;
        alvo.versao = fresca.versao;
        return true;
      },
    });
  }

  async function salvarVersao(corpo: CorpoRegra & { versao: number }): Promise<FalhaSalvar | null> {
    if (!alvoVersao || versaoRemovida) return { mensagem: MENSAGEM_REMOVIDA, porCampo: {} };
    try {
      const nova = await regrasApi.versao(alvoVersao.id, corpo);
      toast.success('Regra tributária salva.');
      setAlvoVersao(null);
      await lista.carregar();
      setAba('ficha');
      selecionar(nova.id);
      return null;
    } catch (erro) {
      return falhaDe(erro);
    }
  }

  async function recarregarVersao(): Promise<boolean> {
    if (!alvoVersao) return false;
    const fresca = await ficha.carregar(alvoVersao.id);
    if (!fresca) return false;
    setAlvoVersao({ ...alvoVersao, versao: fresca.versao });
    return true;
  }

  async function criarCodigo(corpo: { codigo: string; descricao: string; justificativa: string }) {
    if (!codigoTipo) return;
    const tipo = codigoTipo;
    const criado = tipo === 'beneficio' ? await regrasApi.criarBeneficio(corpo) : await regrasApi.criarClassificacao(corpo);
    setSelecaoCodigo({ tipo, id: criado.id, rotulo: criado.descricao });
    setCodigoTipo(null);
  }

  async function validarPreCondicoes() {
    if (!detalhe) return;
    setCarregandoPreCondicoes(true);
    setErroPreCondicoes(null);
    try {
      setPreCondicoes(await regrasApi.preCondicoes(detalhe.id));
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
      ficha.setHistorico(await regrasApi.historico(detalhe.id));
    } catch (erro) {
      setErroHistorico(texto(erro));
    } finally {
      setCarregandoHistorico(false);
    }
  }

  function abrirNovoRegistro() {
    setSelecaoCodigo(null);
    setEdicao(null);
    setDrawer(true);
  }

  function abrirVersao() {
    if (detalhe) setAlvoVersao(detalhe);
  }

  function abrirEdicao() {
    if (!detalhe) return;
    setSelecaoCodigo(null);
    setEdicao({ detalhe, versao: detalhe.versao });
    setDrawer(true);
  }

  const situacao = detalhe?.situacao;
  /** Outro usuário removeu o registro enquanto o formulário estava aberto. */
  const removidoNaEdicao = edicao !== null && detalhe?.id !== edicao.detalhe.id;
  const versaoRemovida = alvoVersao !== null && detalhe?.id !== alvoVersao.id;

  return (
    <div className="grid gap-4">
      <PageHeader
        title="Editor de regras tributárias"
        subtitle="Criar rascunho, adicionar versão, comparar, submeter, aprovar e aposentar. Acesso típico"
        badge={<BadgeProvisorio codigo="H-E01-12" />}
        live
      >
        <Button type="button" variant="secondary" onClick={() => void exportar()}>Exportar</Button>
        {podeGerenciar && <Button type="button" onClick={abrirNovoRegistro}>+ Novo registro</Button>}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" aria-haspopup="menu">Ações do processo <ChevronDown aria-hidden="true" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {podeGerenciar && <DropdownMenuItem onSelect={abrirNovoRegistro}>Criar rascunho</DropdownMenuItem>}
            {podeGerenciar && (
              <DropdownMenuItem disabled={situacao !== 'Aprovada' && situacao !== 'Aposentada'} onSelect={abrirVersao}>
                Adicionar versão
              </DropdownMenuItem>
            )}
            <DropdownMenuItem disabled={!detalhe} onSelect={() => setCompararAberto(true)}>Comparar</DropdownMenuItem>
            {podeGerenciar && <DropdownMenuItem disabled={situacao !== 'Rascunho'} onSelect={() => decidir('submeter')}>Submeter</DropdownMenuItem>}
            {podeAprovar && <DropdownMenuItem disabled={situacao !== 'Submetida'} onSelect={() => decidir('aprovar')}>Aprovar</DropdownMenuItem>}
            {podeAprovar && <DropdownMenuItem disabled={situacao !== 'Aprovada'} onSelect={() => decidir('aposentar')}>Aposentar</DropdownMenuItem>}
          </DropdownMenuContent>
        </DropdownMenu>
      </PageHeader>
      <KpiStrip>
        <Kpi label="Regras" value={lista.contagens?.total ?? '—'} />
        <Kpi label="Em rascunho" value={lista.contagens?.rascunhos ?? '—'} />
        <Kpi label="Submetidas" value={lista.contagens?.submetidas ?? '—'} />
        <Kpi label="Aprovadas" value={lista.contagens?.aprovadas ?? '—'} />
      </KpiStrip>
      <section className="grid gap-3">
        <h2 className="text-sm font-semibold">Registros e consultas</h2>
        <input
          aria-label="Pesquisar descrição ou referência de negócio"
          placeholder="Pesquisar descrição ou referência de negócio"
          className="h-8 rounded-md border px-2 text-sm"
          value={lista.busca}
          onChange={(e) => lista.setBusca(e.target.value)}
        />
        <label className="grid max-w-sm gap-1 text-xs" htmlFor="filtro-cfop">
          Operação fiscal (CFOP)
          <ComboboxBusca
            id="filtro-cfop"
            tipo="cfops"
            value={filtros.cfopId}
            rotulo={rotuloCfop}
            clearable
            onChange={(opcao) => {
              setRotuloCfop(opcao?.rotulo ?? '');
              setFiltros((atual) => ({ ...atual, cfopId: opcao?.id ?? '', page: 1 }));
            }}
            placeholder="Operação fiscal (CFOP)"
            searchPlaceholder="Buscar CFOP"
          />
        </label>
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
            podeAprovar={podeAprovar}
            aba={aba}
            onAba={setAba}
            historico={ficha.historico}
            carregandoHistorico={carregandoHistorico}
            erroHistorico={erroHistorico}
            preCondicoes={preCondicoes}
            carregandoPreCondicoes={carregandoPreCondicoes}
            erroPreCondicoes={erroPreCondicoes}
            ocorrencias={ocorrencias}
            onEditar={abrirEdicao}
            onValidarPreCondicoes={() => void validarPreCondicoes()}
            onConsultarHistorico={() => void consultarHistorico()}
            onSubmeter={() => decidir('submeter')}
            onAprovar={() => decidir('aprovar')}
            onAposentar={() => decidir('aposentar')}
            onAdicionarVersao={abrirVersao}
            onComparar={() => setCompararAberto(true)}
          />
        )}
      </section>
      <RegraDrawer
        aberto={drawer}
        detalhe={edicao?.detalhe ?? null}
        bloqueado={removidoNaEdicao ? MENSAGEM_REMOVIDA : null}
        onRecarregar={recarregarEdicao}
        selecaoCodigo={selecaoCodigo}
        onFechar={() => setDrawer(false)}
        onSalvar={salvar}
        onNovoCodigo={setCodigoTipo}
      />
      <CodigoTributarioDialog aberto={codigoTipo !== null} tipo={codigoTipo} onFechar={() => setCodigoTipo(null)} onConfirmar={criarCodigo} />
      <VersaoDialog
        aberto={alvoVersao !== null}
        origem={alvoVersao}
        bloqueado={versaoRemovida ? MENSAGEM_REMOVIDA : null}
        onRecarregar={recarregarVersao}
        onFechar={() => setAlvoVersao(null)}
        onSalvar={salvarVersao}
      />
      <CompararDialog aberto={compararAberto} detalhe={detalhe} onFechar={() => setCompararAberto(false)} />
      <DecisaoDialog decisao={decisao} onFechar={() => setDecisao(null)} onConcluido={() => undefined} onConflito={() => undefined} />
    </div>
  );
}
