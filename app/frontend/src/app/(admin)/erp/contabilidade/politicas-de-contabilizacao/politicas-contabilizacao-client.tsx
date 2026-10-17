'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { BadgeProvisorio } from '@/components/ui/badge-provisorio';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Kpi, KpiStrip } from '@/components/ui/kpi-strip';
import { PageHeader } from '@/components/ui/page-header';
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { AbasContabeis, detalheAcao, type Aba } from '@/components/contabilidade/abas-contabeis';
import { GradeContabil, SeloSituacao, type ColunaContabil } from '@/components/contabilidade/grade-contabil';
import { LookupCadastro, type OpcaoCadastro } from '@/components/contabilidade/lookup-cadastro';
import { CampoForm } from '@/components/fiscal/comum/campo-form';
import { Campo, SecaoRotulo } from '@/components/fiscal/empresas/aba-ficha';
import { AcoesProcessoSheet } from '@/components/fiscal/empresas/acoes-processo-sheet';
import { rotuloDataHora } from '@/lib/fiscal-enquadramentos';
import { lerMensagem as lerMensagemComRotulos } from '@/components/contabilidade/mensagem-erro';
import { justificativaValida, normalizarJustificativa } from '@/lib/justificativa';

const CHAVE_RASCUNHO = 'politicas-de-contabilizacao';
const POR_PAGINA = 20; // mesmo valor de PAGINA em politicas.service.ts
const EXCECOES = ['Mapeamento ausente', 'Evento duplicado'];
const REGRAS = 'origem imutável, não lançar sem mapeamento correto, balanceamento exato';
const RISCOS = 'mapeamento ausente, evento duplicado';
const DICA_SELECAO = 'Seleção vinculada ao cadastro; sem digitar identificadores.';
const SEM_CADASTRO = 'Nenhum cadastro disponível para seleção. Consulte a área responsável.';
type CampoCadastro = 'contaDebitoCodigo' | 'contaCreditoCodigo' | 'centroCodigo';
const CAMPOS_CADASTRO: Record<CampoCadastro, string> = {
  contaDebitoCodigo: 'Conta de débito',
  contaCreditoCodigo: 'Conta de crédito',
  centroCodigo: 'Centro de custo',
};
const NOME_DO_CAMPO = { contaDebitoCodigo: 'contaDebitoNome', contaCreditoCodigo: 'contaCreditoNome', centroCodigo: 'centroNome' } as const;
/** Referência do requisito (catalogo.js, E09-T02). */
const REFERENCIA: Array<[string, string]> = [
  ['Campos', 'evento fonte, regra débito/crédito, centro custo, imposto, versão e data'],
  ['Ações', 'configurar mappings, simular evento, aprovar regra'],
  ['Regras', 'origem imutável, não lançar sem mapeamento correto, balanceamento exato'],
  ['Exceções', 'mapeamento ausente, evento duplicado'],
];
const DICA_CADASTRO = 'Vinculado a cadastro existente; seleção obrigatória no formulário.';
const DICA_ENUM = 'Valor pertencente ao conjunto de opções do domínio.';
const CONTROLE = 'h-8 w-full rounded-md border border-border-strong bg-background px-2 text-xs disabled:bg-surface-2';
const AREA = 'min-h-16 w-full rounded-md border border-border-strong bg-background px-2 py-1.5 text-xs';
const COLUNAS: { rotulo: string; ordenar?: 'competencia' | 'contaDebito' | 'contaCredito' | 'centroCusto' | 'tipoEvento' }[] = [
  { rotulo: 'Competência', ordenar: 'competencia' },
  { rotulo: 'Situação' },
  { rotulo: 'Conta de débito', ordenar: 'contaDebito' },
  { rotulo: 'Conta de crédito', ordenar: 'contaCredito' },
  { rotulo: 'Centro de custo', ordenar: 'centroCusto' },
  { rotulo: 'Tipo de ocorrência', ordenar: 'tipoEvento' },
];
const TIPOS = [
  ['LIQUIDACAO', 'Liquidação'],
  ['REGISTRO', 'Registro de cobrança'],
  ['CANCELAMENTO', 'Cancelamento'],
  ['ESTORNO', 'Estorno'],
  ['TARIFA', 'Tarifa'],
] as const;
const SITUACOES = [
  ['', 'Todos'],
  ['DRAFT', 'Rascunho'],
  ['REVIEW', 'Aguardando revisão'],
  ['APPROVED', 'Aprovado'],
  ['REJECTED', 'Rejeitado'],
  ['SUSPENDED', 'Suspenso'],
] as const;

export interface PoliticaApresentada {
  codigo: string;
  tipoEvento: string;
  tipoEventoRotulo: string;
  competencia: string;
  competenciaRotulo: string;
  contaDebitoCodigo: string;
  contaDebitoNome: string;
  contaCreditoCodigo: string;
  contaCreditoNome: string;
  centroCodigo: string;
  centroNome: string;
  vigenciaInicio: string;
  situacao: string;
  situacaoRotulo: string;
  numero: number;
  responsavelNome: string;
  aprovadorNome: string | null;
  criadoEm: string;
  alteradoEm: string;
  simulacaoValor: string | null;
  simulacaoDebito: string | null;
  simulacaoCredito: string | null;
}

type Opcao = OpcaoCadastro;
type Contagens = { revisao: number; suspensos: number };
interface HistoricoLinha { quando: string; quem: string; acontecimento: string; justificativa: string }

type Formulario = {
  contaDebitoCodigo: string;
  contaCreditoCodigo: string;
  centroCodigo: string;
  tipoEvento: string;
  competencia: string;
  vigenciaInicio: string;
  justificativa: string;
};

const FORM_VAZIO: Formulario = {
  contaDebitoCodigo: '',
  contaCreditoCodigo: '',
  centroCodigo: '',
  tipoEvento: '',
  competencia: '',
  vigenciaInicio: '',
  justificativa: '',
};

function dataBr(iso: string | null): string {
  if (!iso) return '—';
  const [ano, mes, dia] = iso.slice(0, 10).split('-');
  if (!ano || !mes || !dia) return '—';
  return `${dia}/${mes}/${ano}`;
}

/** Valor em reais da tela para a API: aceita 123,45, 1.234,56 e 0,01 (milhar com ponto, kiro §5); '' se fora do formato. */
function valorApi(texto: string): string {
  const casado = /^(\d{1,3}(?:\.\d{3})+|\d+),(\d{2})$/.exec(texto.trim());
  if (!casado) return '';
  const inteiro = casado[1]!.replace(/\./g, '').replace(/^0+(?=\d)/, '');
  return inteiro.length <= 13 ? `${inteiro}.${casado[2]}` : '';
}

/** Rótulo visível de cada campo do DTO, para a mensagem de validação dizer o que falta. */
const ROTULOS_POLITICA: Record<string, string> = {
  contaDebitoCodigo: 'Conta de débito',
  contaCreditoCodigo: 'Conta de crédito',
  centroCodigo: 'Centro de custo',
  tipoEvento: 'Tipo de ocorrência',
  competencia: 'Competência',
  vigenciaInicio: 'Início de vigência',
  justificativa: 'Justificativa auditável',
  numero: 'Versão',
};
const ROTULOS_ACAO: Record<string, string> = { ...ROTULOS_POLITICA, justificativa: 'Justificativa / observação', valor: 'Valor' };
const JUSTIFICATIVA_CURTA = 'Informe justificativa para demonstrar a decisão auditável (mínimo de 3 caracteres).';

function lerMensagem(resposta: Response, rotulos: Record<string, string> = ROTULOS_POLITICA): Promise<string> {
  return lerMensagemComRotulos(resposta, rotulos);
}

const NAO_CONFIRMADO = 'O servidor não confirmou a operação. Atualize a tela e confira a situação.';

async function lerCorpo(resposta: Response): Promise<unknown> {
  const texto = await resposta.text();
  if (!texto) return null;
  try {
    return JSON.parse(texto) as unknown;
  } catch {
    return null;
  }
}

function ehPolitica(corpo: unknown): corpo is PoliticaApresentada {
  if (!corpo || typeof corpo !== 'object') return false;
  const { codigo, situacao, numero } = corpo as Record<string, unknown>;
  return typeof codigo === 'string' && typeof situacao === 'string' && typeof numero === 'number';
}

function rotuloSituacao(situacao: string): string {
  return SITUACOES.find(([valor]) => valor === situacao)?.[1] ?? situacao;
}

function celula(linha: PoliticaApresentada, rotulo: string): string {
  if (rotulo === 'Competência') return linha.competenciaRotulo;
  if (rotulo === 'Situação') return linha.situacaoRotulo;
  if (rotulo === 'Conta de débito') return linha.contaDebitoNome;
  if (rotulo === 'Conta de crédito') return linha.contaCreditoNome;
  if (rotulo === 'Centro de custo') return linha.centroNome;
  return linha.tipoEventoRotulo;
}

export function PoliticasContabilizacaoClient({
  inicial,
  totalInicial = inicial.length,
  contagensIniciais = null,
  semAcesso = false,
}: {
  inicial: PoliticaApresentada[];
  totalInicial?: number;
  contagensIniciais?: Contagens | null;
  semAcesso?: boolean;
}) {
  const [marcadas, setMarcadas] = useState<string[]>([]);
  const [linhas, setLinhas] = useState(inicial);
  const [modal, setModal] = useState<'simular' | 'aprovar' | null>(null);
  const [drawer, setDrawer] = useState<'criar' | 'editar' | 'processo' | null>(null);
  const [aba, setAba] = useState<Aba>('Ficha e campos');
  const [contagens, setContagens] = useState<Contagens | null>(contagensIniciais);
  const [erroLista, setErroLista] = useState('');
  const [carregandoHistorico, setCarregandoHistorico] = useState(false);
  const [erroHistorico, setErroHistorico] = useState<string | null>(null);
  const [aviso, setAviso] = useState('');
  const [valorTexto, setValorTexto] = useState('');
  const [justificativaModal, setJustificativaModal] = useState('');
  const [form, setForm] = useState<Formulario>(FORM_VAZIO);
  const [salvo, setSalvo] = useState(JSON.stringify(FORM_VAZIO));
  const [contas, setContas] = useState<Opcao[]>([]);
  const [centros, setCentros] = useState<Opcao[]>([]);
  const [codigoSelecionado, setCodigoSelecionado] = useState<string | null>(inicial[0]?.codigo ?? null);
  const [historico, setHistorico] = useState<HistoricoLinha[]>([]);
  const [busca, setBusca] = useState('');
  const [filtroCompetencia, setFiltroCompetencia] = useState('');
  const [filtroSituacao, setFiltroSituacao] = useState('');
  const [ordenar, setOrdenar] = useState<string>('competencia');
  const [direcao, setDirecao] = useState<'asc' | 'desc'>('asc');
  // Guarda de envio em voo (mesmo padrão da T01): um clique a mais não gera segundo POST nem segunda auditoria.
  const [enviando, setEnviando] = useState(false);
  const emVoo = useRef(false);
  const [carregando, setCarregando] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [total, setTotal] = useState(totalInicial);
  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const sequenciaModal = useRef(0);
  const [lookup, setLookup] = useState<CampoCadastro | null>(null);
  const [buscaLookup, setBuscaLookup] = useState('');
  const botoesLookup = useRef<Partial<Record<CampoCadastro, HTMLButtonElement | null>>>({});
  // Foco volta ao botão que abriu o drawer (o Radix só devolve sozinho ao SheetTrigger).
  const gatilhoDrawer = useRef<HTMLElement | null>(null);
  function lembrarGatilho() {
    gatilhoDrawer.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }

  useEffect(() => {
    const cru = sessionStorage.getItem(CHAVE_RASCUNHO);
    if (!cru) return;
    try {
      const rascunho = JSON.parse(cru) as { form?: Formulario; busca?: string; filtroCompetencia?: string; filtroSituacao?: string; ordenar?: string; direcao?: string; pagina?: number };
      if (rascunho.form) setForm(rascunho.form);
      if (rascunho.busca) setBusca(rascunho.busca);
      if (rascunho.filtroCompetencia) setFiltroCompetencia(rascunho.filtroCompetencia);
      if (rascunho.filtroSituacao) setFiltroSituacao(rascunho.filtroSituacao);
      if (rascunho.ordenar && COLUNAS.some((coluna) => coluna.ordenar === rascunho.ordenar)) setOrdenar(rascunho.ordenar!);
      if (rascunho.direcao === 'asc' || rascunho.direcao === 'desc') setDirecao(rascunho.direcao);
      if (Number.isInteger(rascunho.pagina) && rascunho.pagina! >= 2 && rascunho.pagina! <= 100000) setPagina(rascunho.pagina!);
    } catch {
      sessionStorage.setItem(CHAVE_RASCUNHO, '');
    }
  }, []);

  useEffect(() => {
    sessionStorage.setItem(CHAVE_RASCUNHO, JSON.stringify({ form, busca, filtroCompetencia, filtroSituacao, ordenar, direcao, pagina }));
  }, [form, busca, filtroCompetencia, filtroSituacao, ordenar, direcao, pagina]);

  const ultimaConsulta = useRef(new URLSearchParams({
    pagina: '1', q: '', competencia: '', situacao: '', ordenar: 'competencia', direcao: 'asc',
  }).toString());
  const sequenciaLista = useRef(0);

  function consultaAtual() {
    return new URLSearchParams({
      pagina: String(pagina), q: busca, competencia: filtroCompetencia, situacao: filtroSituacao, ordenar, direcao,
    }).toString();
  }

  async function consultar(consulta: string, paginaDaConsulta: number) {
    ultimaConsulta.current = consulta;
    sequenciaLista.current += 1;
    const minha = sequenciaLista.current;
    setCarregando(true);
    try {
      // Uma segunda tentativa cobre página vazia com total > 0 (lista lida antes de uma gravação, total depois).
      for (let tentativa = 0; tentativa < 2; tentativa += 1) {
        const resposta = await fetch(`/api/contabilidade/politicas?${consulta}`);
        if (minha !== sequenciaLista.current) return;
        if (!resposta.ok) {
          setErroLista((await lerMensagem(resposta)) || 'Não foi possível atualizar a lista. Tente novamente.');
          return;
        }
        const corpo = await lerCorpo(resposta) as { itens?: PoliticaApresentada[]; total?: number; contagens?: Contagens } | null;
        if (minha !== sequenciaLista.current) return;
        if (!corpo || !Array.isArray(corpo.itens)) {
          setAviso(NAO_CONFIRMADO);
          return;
        }
        const novoTotal = typeof corpo.total === 'number' ? corpo.total : corpo.itens.length;
        const ultima = Math.max(1, Math.ceil(novoTotal / POR_PAGINA));
        if (corpo.itens.length === 0 && novoTotal > 0 && paginaDaConsulta <= ultima && tentativa === 0) continue;
        setLinhas(corpo.itens);
        setTotal(novoTotal);
        setMarcadas([]);
        setAviso('');
        setErroLista('');
        if (corpo.contagens) setContagens(corpo.contagens);
        if (paginaDaConsulta > ultima) setPagina(ultima);
        return;
      }
    } catch {
      if (minha === sequenciaLista.current) setErroLista('Não foi possível atualizar a lista. Tente novamente.');
    } finally {
      if (minha === sequenciaLista.current) setCarregando(false);
    }
  }

  useEffect(() => {
    const consulta = consultaAtual();
    // Compara com a última consulta feita (inicialmente, a da lista que o servidor entregou): não consulta ao montar
    // nem na segunda montagem simulada do StrictMode, e consulta uma vez só depois da restauração do sessionStorage.
    if (consulta === ultimaConsulta.current) return;
    void consultar(consulta, pagina);
  }, [busca, filtroCompetencia, filtroSituacao, ordenar, direcao, pagina]);
  // ponytail: uma requisição por tecla, sem debounce; a guarda de sequência descarta resposta antiga. Adicionar debounce de 250 ms se o servidor sentir.

  if (semAcesso) {
    return (
      <div className="grid gap-4">
        <PageHeader title="Políticas de contabilização" />
        <EmptyState title="Acesso não permitido" description="A permissão é conferida no servidor." />
      </div>
    );
  }

  const selecionada = linhas.find((linha) => linha.codigo === codigoSelecionado) ?? linhas[0];

  function alternar(codigo: string) {
    setMarcadas((atual) => {
      if (atual.includes(codigo)) return atual.filter((item) => item !== codigo);
      if (atual.length >= 20) return atual;
      return [...atual, codigo];
    });
  }

  function alvo(): PoliticaApresentada | undefined {
    if (marcadas.length === 1) return linhas.find((linha) => linha.codigo === marcadas[0]);
    return selecionada;
  }

  async function carregarOpcoes() {
    const resposta = await fetch('/api/contabilidade/politicas/opcoes');
    if (!resposta.ok) {
      setAviso(await lerMensagem(resposta));
      return;
    }
    const corpo = await resposta.json() as { contas?: Opcao[]; centros?: Opcao[] };
    setContas(corpo.contas ?? []);
    setCentros(corpo.centros ?? []);
    if ((corpo.contas ?? []).length === 0 && (corpo.centros ?? []).length === 0) {
      setAviso(SEM_CADASTRO);
    }
  }

  function abrirLookup(campo: CampoCadastro) {
    if ((campo === 'centroCodigo' ? centros : contas).length === 0) {
      setAviso(SEM_CADASTRO);
      return;
    }
    setBuscaLookup('');
    setLookup(campo);
  }

  function fecharLookup() {
    const campo = lookup;
    setLookup(null);
    if (campo) botoesLookup.current[campo]?.focus();
  }

  function abrirCriar() {
    lembrarGatilho();
    setForm(FORM_VAZIO);
    setSalvo(JSON.stringify(FORM_VAZIO));
    setDrawer('criar');
    void carregarOpcoes();
  }

  function abrirEditar() {
    if (!selecionada) return;
    lembrarGatilho();
    const proximo: Formulario = {
      contaDebitoCodigo: selecionada.contaDebitoCodigo,
      contaCreditoCodigo: selecionada.contaCreditoCodigo,
      centroCodigo: selecionada.centroCodigo,
      tipoEvento: selecionada.tipoEvento,
      competencia: selecionada.competencia.slice(0, 7),
      vigenciaInicio: selecionada.vigenciaInicio.slice(0, 10),
      justificativa: '',
    };
    setForm(proximo);
    setSalvo(JSON.stringify(proximo));
    setDrawer('editar');
    void carregarOpcoes();
  }

  function abrirModal(acao: 'simular' | 'aprovar') {
    sequenciaModal.current += 1;
    setValorTexto('');
    setJustificativaModal('');
    setAviso('');
    setModal(acao);
  }

  async function confirmarLoteOuAcao(acao: 'simular' | 'aprovar') {
    if (emVoo.current) return;
    const atual = alvo();
    if (!atual && marcadas.length <= 1) {
      setAviso('Selecione uma política na lista.');
      return;
    }
    const valor = valorApi(valorTexto);
    if (!justificativaValida(justificativaModal)) {
      setAviso(JUSTIFICATIVA_CURTA);
      return;
    }
    if (acao === 'simular' && !valor) {
      setAviso(valorTexto.trim() ? 'Informe o valor no formato 1.234,56.' : 'Valor é obrigatório.');
      return;
    }
    const justificativa = normalizarJustificativa(justificativaModal);
    if (acao === 'simular' && /^0+\.00$/.test(valor)) {
      setAviso('Valor deve ser maior que zero.');
      return;
    }
    const emLote = marcadas.length > 1;
    const token = sequenciaModal.current;
    emVoo.current = true;
    setEnviando(true);
    try {
      const resposta = emLote
        ? await fetch('/api/contabilidade/politicas/lote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            acao,
            codigos: marcadas,
            justificativa,
            numeroPorCodigo: Object.fromEntries(
              linhas.filter((linha) => marcadas.includes(linha.codigo)).map((linha) => [linha.codigo, linha.numero]),
            ),
            ...(acao === 'simular' ? { valor } : {}),
          }),
        })
        : await fetch(`/api/contabilidade/politicas/${encodeURIComponent(atual!.codigo)}/${acao}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(acao === 'simular'
            ? { numero: atual!.numero, valor, justificativa }
            : { numero: atual!.numero, justificativa }),
        });
      if (!resposta.ok) {
        setAviso(await lerMensagem(resposta, ROTULOS_ACAO));
        return;
      }
      const corpo = await lerCorpo(resposta);
      if (emLote) {
        const efeitos = Array.isArray(corpo) ? corpo as { codigo?: unknown; acao?: unknown; situacao?: unknown }[] : null;
        const confere = efeitos !== null
          && efeitos.length === marcadas.length
          && efeitos.every((efeito) => typeof efeito.codigo === 'string' && marcadas.includes(efeito.codigo)
            && efeito.acao === acao && typeof efeito.situacao === 'string'
            && (acao !== 'aprovar' || efeito.situacao === 'APPROVED'));
        if (!confere) {
          setAviso(NAO_CONFIRMADO);
          return;
        }
        if (acao === 'aprovar') {
          const situacoes = new Map(efeitos.map((efeito) => [String(efeito.codigo), String(efeito.situacao)]));
          setLinhas((lista) => lista.map((item) => {
            const situacao = situacoes.get(item.codigo);
            return situacao ? { ...item, situacao, situacaoRotulo: rotuloSituacao(situacao) } : item;
          }));
        }
      } else {
        if (!ehPolitica(corpo) || corpo.codigo !== atual!.codigo || (acao === 'aprovar' && corpo.situacao !== 'APPROVED')) {
          setAviso(NAO_CONFIRMADO);
          return;
        }
        setLinhas((lista) => lista.map((item) => (item.codigo === corpo.codigo ? corpo : item)));
      }
      if (sequenciaModal.current === token) {
        setModal(null);
        setValorTexto('');
        setJustificativaModal('');
      }
      setAviso(acao === 'aprovar' ? 'concluído com evidência' : '');
    } catch {
      setAviso('Não foi possível concluir a operação. Tente novamente.');
    } finally {
      emVoo.current = false;
      setEnviando(false);
    }
  }

  async function gravar() {
    if (emVoo.current) return;
    if (!justificativaValida(form.justificativa)) {
      setAviso(JUSTIFICATIVA_CURTA);
      return;
    }
    const criando = drawer !== 'editar';
    if (!criando && !selecionada) return;
    emVoo.current = true;
    setEnviando(true);
    try {
      await gravarEmVoo(criando);
    } catch {
      setAviso('Não foi possível concluir a operação. Tente novamente.');
    } finally {
      emVoo.current = false;
      setEnviando(false);
    }
  }

  async function gravarEmVoo(criando: boolean) {
    const corpoForm = { ...form, justificativa: normalizarJustificativa(form.justificativa) };
    const resposta = criando
      ? await fetch('/api/contabilidade/politicas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpoForm),
      })
      : await fetch(`/api/contabilidade/politicas/${encodeURIComponent(selecionada!.codigo)}/editar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...corpoForm, numero: selecionada!.numero }),
      });
    if (!resposta.ok) {
      setAviso(await lerMensagem(resposta));
      return;
    }
    const gravada = await lerCorpo(resposta);
    if (!ehPolitica(gravada)) {
      setAviso(NAO_CONFIRMADO);
      return;
    }
    setCodigoSelecionado(gravada.codigo);
    setSalvo(JSON.stringify(form));
    setDrawer(null);
    setAviso('');
    // A consulta vigente está no ref (o efeito dos filtros o atualiza): filtro trocado durante o POST não volta ao do clique.
    const vigente = ultimaConsulta.current;
    await consultar(vigente, Number(new URLSearchParams(vigente).get('pagina')) || 1);
  }

  async function exportar() {
    const consulta = new URLSearchParams({ q: busca, competencia: filtroCompetencia, situacao: filtroSituacao, ordenar, direcao });
    try {
      const resposta = await fetch(`/api/contabilidade/politicas/exportar?${consulta.toString()}`);
      if (!resposta.ok) {
        setAviso((await lerMensagem(resposta)) || 'Não foi possível exportar. Tente novamente.');
        return;
      }
      // blob, não text(): text() descarta o BOM e o Excel perde os acentos.
      const url = URL.createObjectURL(await resposta.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = 'politicas-de-contabilizacao.csv';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setAviso('');
    } catch {
      setAviso('Não foi possível exportar. Tente novamente.');
    }
  }

  async function validar() {
    if (emVoo.current) return;
    const resposta = await fetch('/api/contabilidade/politicas/validar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (!resposta.ok) {
      setAviso(await lerMensagem(resposta));
      return;
    }
    const corpo = await resposta.json() as { valido: boolean; mensagens: string[] };
    setAviso(corpo.valido ? '' : corpo.mensagens.join(' '));
  }

  async function abrirHistorico(nome: Aba) {
    setAba(nome);
    if (!selecionada || (nome !== 'Histórico' && nome !== 'Movimentações')) return;
    setCarregandoHistorico(true);
    setErroHistorico(null);
    try {
      const resposta = await fetch(`/api/contabilidade/politicas/${encodeURIComponent(selecionada.codigo)}/historico`);
      if (!resposta.ok) {
        setErroHistorico((await lerMensagem(resposta)) || 'Não foi possível carregar o histórico. Tente novamente.');
        return;
      }
      setHistorico(await resposta.json() as HistoricoLinha[]);
    } catch {
      setErroHistorico('Não foi possível carregar o histórico. Tente novamente.');
    } finally {
      setCarregandoHistorico(false);
    }
  }

  /** "Tentar novamente" refaz a última consulta da lista (a vigente no ref). */
  async function tentarDeNovo() {
    const vigente = ultimaConsulta.current;
    await consultar(vigente, Number(new URLSearchParams(vigente).get('pagina')) || 1);
  }

  function voltar() {
    if (emVoo.current) return;
    if (JSON.stringify(form) !== salvo && !window.confirm('Há alterações não salvas. Deseja sair?')) return;
    setDrawer(null);
  }

  function ordenarPor(campo: string) {
    const proxima = ordenar === campo && direcao === 'asc' ? 'desc' : 'asc';
    setOrdenar(campo);
    setDirecao(proxima);
    setPagina(1);
  }

  /** Cadastro completo (a busca da lista não filtra o drawer); o valor do formulário fora da lista carregada continua visível. */
  function opcoesDoCampo(campo: CampoCadastro): Opcao[] {
    const lista = campo === 'centroCodigo' ? centros : contas;
    const codigo = form[campo];
    if (!codigo || lista.some((opcao) => opcao.codigo === codigo)) return lista;
    const nome = selecionada?.[campo] === codigo ? selecionada[NOME_DO_CAMPO[campo]] : '';
    return [{ codigo, nome: nome || codigo }, ...lista];
  }
  const avisoNaTela = aviso ? <p role="status" className="rounded-md bg-info-soft p-2.5 text-xs text-info-fg">{aviso}</p> : null;
  const formularioAberto = drawer === 'criar' || drawer === 'editar';

  const colunasGrade: ColunaContabil<PoliticaApresentada>[] = COLUNAS.map((coluna) => ({
    rotulo: coluna.rotulo,
    ordenar: coluna.ordenar,
    celula: (linha) => (coluna.rotulo === 'Situação'
      ? <SeloSituacao situacao={linha.situacao} rotulo={linha.situacaoRotulo} />
      : celula(linha, coluna.rotulo)),
  }));

  const acoesDominio: Array<{ rotulo: string; abrir: () => void }> = [
    { rotulo: 'Configurar mappings', abrir: abrirCriar },
    { rotulo: 'Simular evento', abrir: () => abrirModal('simular') },
    { rotulo: 'Aprovar regra', abrir: () => abrirModal('aprovar') },
  ];

  return (
    <div className="grid gap-4">
      <PageHeader
        title="Políticas de contabilização"
        subtitle="configurar mappings, simular evento, aprovar regra."
        badge={(
          <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            Acesso típico: contador <BadgeProvisorio />
          </span>
        )}
      >
        <Button type="button" variant="secondary" onClick={() => void exportar()}>Exportar</Button>
        <Button type="button" variant="secondary" onClick={abrirCriar}>+ Novo registro</Button>
        <Button type="button" onClick={() => setDrawer('processo')}>Ações do processo <ChevronDown aria-hidden="true" /></Button>
      </PageHeader>
      <KpiStrip>
        <Kpi label="Em revisão" value={contagens?.revisao ?? '—'} hint="Exigem decisão humana" tone="alert" />
        <Kpi label="Bloqueados" value={contagens?.suspensos ?? '—'} hint="Não gerar sucesso falso" tone="danger" />
      </KpiStrip>
      {!modal && !formularioAberto && avisoNaTela}
      <div className="grid grid-cols-1 items-start gap-3.5 min-[1250px]:grid-cols-[minmax(0,1.34fr)_minmax(340px,1fr)]">
        <Card className="min-w-0">
          <CardHeader><CardTitle><h2>Registros e consultas</h2></CardTitle></CardHeader>
          <CardContent className="grid min-w-0 grid-cols-1 gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <input aria-label="Buscar registros da lista" placeholder="Pesquisar descrição ou referência de negócio" className={`${CONTROLE} max-w-[280px]`} value={busca} onChange={(evento) => { setBusca(evento.target.value); setPagina(1); }} />
              <input aria-label="Filtrar competência" type="month" className={`${CONTROLE} max-w-[170px]`} value={filtroCompetencia} onChange={(evento) => { setFiltroCompetencia(evento.target.value); setPagina(1); }} />
              <select aria-label="Filtrar situação" className={`${CONTROLE} max-w-[190px]`} value={filtroSituacao} onChange={(evento) => { setFiltroSituacao(evento.target.value); setPagina(1); }}>
                {SITUACOES.map(([valor, rotulo]) => <option key={rotulo} value={valor}>{rotulo}</option>)}
              </select>
              <span className="flex-1" />
              <Button type="button" size="sm" variant="secondary" onClick={() => void exportar()}>Exportar visão</Button>
            </div>
            {erroLista && (
              <div role="alert" className="flex flex-wrap items-center gap-3 rounded-md border border-destructive/40 p-3 text-xs text-destructive">
                {erroLista}
                <Button type="button" size="sm" variant="secondary" onClick={() => void tentarDeNovo()}>Tentar novamente</Button>
              </div>
            )}
            {carregando ? <p role="status" aria-busy="true" className="text-xs text-muted-foreground">Carregando…</p> : null}
            <GradeContabil
              className="politicas-grade"
              colunas={colunasGrade}
              linhas={linhas}
              total={total}
              pagina={pagina}
              totalPaginas={totalPaginas}
              ordenar={ordenar}
              direcao={direcao}
              carregando={carregando}
              selecionado={selecionada?.codigo}
              marcadas={marcadas}
              rotuloLinha={(linha) => linha.tipoEventoRotulo}
              onSelecionar={setCodigoSelecionado}
              onMarcar={alternar}
              onOrdenar={ordenarPor}
              onPagina={setPagina}
            />
          </CardContent>
        </Card>
        <Card className="min-w-0">
          <CardHeader><CardTitle><h2>Detalhamento e execução</h2></CardTitle></CardHeader>
          <CardContent className="min-w-0">
            <AbasContabeis
              aba={aba}
              onAba={(nome) => void abrirHistorico(nome)}
              eventos={historico}
              carregandoEventos={carregandoHistorico}
              erroEventos={erroHistorico}
              situacao={selecionada ? { situacao: selecionada.situacao, rotulo: selecionada.situacaoRotulo } : null}
              regras={REGRAS}
              excecoes={EXCECOES}
              referencia={REFERENCIA}
              ficha={selecionada ? (
                <div className="grid gap-4 text-sm">
                  <div>
                    <SecaoRotulo>Informações do registro selecionado</SecaoRotulo>
                    <p className="mb-2 text-[11px] font-semibold text-muted-foreground">Dados principais</p>
                    <div className="grid grid-cols-1 gap-x-3.5 gap-y-2.5 sm:grid-cols-2">
                      <Campo label="Versão">{selecionada.numero}</Campo>
                      <Campo label="Competência">{selecionada.competenciaRotulo}</Campo>
                      <CampoDica label="Conta de débito" dica={DICA_CADASTRO}>{selecionada.contaDebitoNome}</CampoDica>
                      <CampoDica label="Conta de crédito" dica={DICA_CADASTRO}>{selecionada.contaCreditoNome}</CampoDica>
                      <CampoDica label="Centro de custo" dica={DICA_CADASTRO}>{selecionada.centroNome}</CampoDica>
                      <CampoDica label="Tipo de ocorrência" dica={DICA_ENUM}>{selecionada.tipoEventoRotulo}</CampoDica>
                      <Campo label="Início de vigência">{dataBr(selecionada.vigenciaInicio)}</Campo>
                      <Campo label="Enquadramento fiscal"><span className="flex flex-wrap items-center gap-2">— <BadgeProvisorio /></span></Campo>
                    </div>
                  </div>
                  <div>
                    <SecaoRotulo>Trilha e responsabilização</SecaoRotulo>
                    <div className="grid grid-cols-1 gap-x-3.5 gap-y-2.5 sm:grid-cols-2">
                      <Campo label="Empresa"><span className="flex flex-wrap items-center gap-2">— <BadgeProvisorio /></span></Campo>
                      <Campo label="Situação"><SeloSituacao situacao={selecionada.situacao} rotulo={selecionada.situacaoRotulo} /></Campo>
                      <Campo label="Responsável">{selecionada.responsavelNome}</Campo>
                      <Campo label="Alterado em">{rotuloDataHora(selecionada.alteradoEm)}</Campo>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" onClick={abrirEditar}>Editar versão</Button>
                    <Button type="button" variant="secondary" onClick={() => void abrirHistorico('Histórico')}>Consultar histórico</Button>
                    <Button type="button" variant="secondary" onClick={() => void validar()}>Validar pré-condições</Button>
                  </div>
                </div>
              ) : <EmptyState title="Selecione um registro na lista para abrir a ficha." />}
            />
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader><CardTitle><h2>Ações do domínio — previstas no contrato completo</h2></CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {acoesDominio.map((acao, indice) => (
            <Button key={acao.rotulo} type="button" variant={indice === 0 ? 'default' : 'secondary'} onClick={acao.abrir}>{acao.rotulo}</Button>
          ))}
        </CardContent>
      </Card>

      <AcoesProcessoSheet
        aberto={drawer === 'processo'}
        onFechar={() => setDrawer(null)}
        descricao="Operações previstas para as políticas de contabilização"
        apoio="Confirme permissões, validade, origem e efeitos contábeis antes de registrar."
        condicionantes={[REGRAS, `Exceções: ${RISCOS}.`]}
        comandos={[
          { titulo: 'Configurar mappings', rotuloAcessivel: 'Abrir decisão: Configurar mappings', abrir: abrirCriar },
          { titulo: 'Simular evento', rotuloAcessivel: 'Abrir decisão: Simular evento', abrir: () => { setDrawer(null); abrirModal('simular'); } },
          { titulo: 'Aprovar regra', rotuloAcessivel: 'Abrir decisão: Aprovar regra', abrir: () => { setDrawer(null); abrirModal('aprovar'); } },
        ]}
      />

      <Sheet open={formularioAberto} onOpenChange={(aberto) => { if (!aberto) voltar(); }}>
        <SheetContent
          aria-describedby={undefined}
          className="w-full gap-0 overflow-y-auto p-0 sm:max-w-[580px]"
          onEscapeKeyDown={(evento) => { if (lookup || emVoo.current) evento.preventDefault(); }}
          onInteractOutside={(evento) => { if (emVoo.current) evento.preventDefault(); }}
          onCloseAutoFocus={(evento) => {
            const gatilho = gatilhoDrawer.current;
            if (gatilho?.isConnected) {
              evento.preventDefault();
              gatilho.focus();
            }
          }}
        >
          <SheetHeader className="border-b border-border p-5">
            <span className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-primary">Cadastro · Contabilidade</span>
            <SheetTitle className="text-lg font-bold">Políticas de contabilização</SheetTitle>
          </SheetHeader>
          <div className="flex flex-1 flex-col gap-3 p-5">
            <SecaoRotulo>Dados principais</SecaoRotulo>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(['contaDebitoCodigo', 'contaCreditoCodigo', 'centroCodigo'] as const).map((campo) => {
                const rotulo = CAMPOS_CADASTRO[campo];
                const opcoes = opcoesDoCampo(campo);
                return (
                  <CampoForm key={campo} rotulo={rotulo}>
                    <div className="flex items-stretch gap-1.5">
                      <select aria-label={rotulo} className={`${CONTROLE} min-w-0 flex-1`} value={form[campo]} onChange={(evento) => setForm({ ...form, [campo]: evento.target.value })}>
                        <option value="">Selecione {rotulo.toLowerCase()}</option>
                        {opcoes.map((opcao) => <option key={opcao.codigo} value={opcao.codigo}>{opcao.nome}</option>)}
                      </select>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        ref={(botao) => { botoesLookup.current[campo] = botao; }}
                        aria-label={`Pesquisar ${rotulo.toLowerCase()}`}
                        title="Pesquisar cadastro pelo nome"
                        onClick={() => abrirLookup(campo)}
                      >Pesquisar</Button>
                    </div>
                    <span className="mt-1 block text-[11px] text-muted-foreground">{DICA_SELECAO}</span>
                  </CampoForm>
                );
              })}
              <CampoForm rotulo="Tipo de ocorrência">
                <select aria-label="Tipo de ocorrência" className={CONTROLE} value={form.tipoEvento} disabled={drawer === 'editar'} onChange={(evento) => setForm({ ...form, tipoEvento: evento.target.value })}>
                  <option value="">Selecione tipo de ocorrência</option>
                  {TIPOS.map(([valor, rotulo]) => <option key={rotulo} value={valor}>{rotulo}</option>)}
                </select>
              </CampoForm>
              <CampoForm rotulo="Competência">
                <input aria-label="Competência" type="month" required className={CONTROLE} value={form.competencia} disabled={drawer === 'editar'} onChange={(evento) => setForm({ ...form, competencia: evento.target.value })} />
              </CampoForm>
              <CampoForm rotulo="Enquadramento fiscal">
                <span className="flex items-center gap-2">
                  <select aria-label="Enquadramento fiscal" className={`${CONTROLE} min-w-0 flex-1`} disabled value="">
                    <option value="">—</option>
                  </select>
                  <BadgeProvisorio />
                </span>
              </CampoForm>
              <CampoForm rotulo="Início de vigência">
                <input aria-label="Início de vigência" type="date" required className={CONTROLE} value={form.vigenciaInicio} onChange={(evento) => setForm({ ...form, vigenciaInicio: evento.target.value })} />
              </CampoForm>
              <CampoForm rotulo="Situação">
                <select aria-label="Situação" className={CONTROLE} disabled value="DRAFT">
                  <option value="DRAFT">Rascunho</option>
                </select>
              </CampoForm>
              <div className="sm:col-span-2">
                <CampoForm rotulo="Justificativa auditável">
                  <textarea aria-label="Justificativa auditável" rows={3} className={AREA} placeholder="Informe a justificativa ou observação operacional" value={form.justificativa} onChange={(evento) => setForm({ ...form, justificativa: evento.target.value })} />
                </CampoForm>
              </div>
            </div>
            {!modal && avisoNaTela}
          </div>
          <SheetFooter className="flex-row justify-end border-t border-border px-5 py-3">
            <Button type="button" variant="secondary" disabled={enviando} onClick={voltar}>Voltar</Button>
            <Button type="button" variant="secondary" disabled={enviando} onClick={() => void validar()}>Verificar dados</Button>
            <Button type="button" disabled={enviando} aria-busy={enviando || undefined} onClick={() => void gravar()}>Configurar mappings</Button>
          </SheetFooter>
          {lookup && (
            <LookupCadastro
              rotulo={CAMPOS_CADASTRO[lookup]}
              busca={buscaLookup}
              onBusca={setBuscaLookup}
              opcoes={(lookup === 'centroCodigo' ? centros : contas)
                .filter((opcao) => `${opcao.nome} ${opcao.codigo}`.toLowerCase().includes(buscaLookup.trim().toLowerCase()))}
              onEscolher={(opcao) => { setForm({ ...form, [lookup]: opcao.codigo }); fecharLookup(); }}
              onFechar={fecharLookup}
            />
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={modal !== null} onOpenChange={(aberto) => { if (!aberto && !emVoo.current) setModal(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ação do domínio: {modal === 'simular' ? 'Simular evento' : 'Aprovar regra'}</DialogTitle>
            <DialogDescription className="text-xs">{detalheAcao(modal === 'simular' ? 'Simular evento' : 'Aprovar regra', REGRAS, RISCOS)}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 px-4">
            {modal === 'simular' ? (
              <CampoForm rotulo="Valor">
                <span className="flex items-center overflow-hidden rounded-md border border-border-strong">
                  <span aria-hidden="true" className="bg-surface-2 px-2 py-1.5 text-[11px] text-muted-foreground">R$</span>
                  <input aria-label="Valor" inputMode="decimal" placeholder="0,00" autoComplete="off" className="h-8 min-w-0 flex-1 px-2 text-xs outline-none" value={valorTexto} onChange={(evento) => setValorTexto(evento.target.value)} />
                </span>
              </CampoForm>
            ) : null}
            <CampoForm rotulo="Justificativa / observação">
              <textarea aria-label="Justificativa / observação" rows={3} className={AREA} placeholder="Registre a razão para a decisão" value={justificativaModal} onChange={(evento) => setJustificativaModal(evento.target.value)} />
            </CampoForm>
            {avisoNaTela}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" disabled={enviando} onClick={() => setModal(null)}>Cancelar</Button>
            <Button type="button" disabled={enviando} aria-busy={enviando || undefined} onClick={() => modal && void confirmarLoteOuAcao(modal)}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Campo da ficha com a dica do protótipo abaixo do valor (cadastro vinculado ou opção do domínio). */
function CampoDica({ label, dica, children }: { label: string; dica: string; children: ReactNode }) {
  return (
    <div>
      <Campo label={label}>{children}</Campo>
      <span className="mt-1 block text-[11px] text-muted-foreground">{dica}</span>
    </div>
  );
}
