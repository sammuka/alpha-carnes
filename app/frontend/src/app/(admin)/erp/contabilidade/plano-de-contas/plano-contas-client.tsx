'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { BadgeProvisorio } from '@/components/ui/badge-provisorio';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Kpi, KpiStrip } from '@/components/ui/kpi-strip';
import { PageHeader } from '@/components/ui/page-header';
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { AbasContabeis, type Aba } from '@/components/contabilidade/abas-contabeis';
import { GradeContabil, SeloSituacao, type ColunaContabil } from '@/components/contabilidade/grade-contabil';
import { CampoForm } from '@/components/fiscal/comum/campo-form';
import { Campo, SecaoRotulo } from '@/components/fiscal/empresas/aba-ficha';
import { AcoesProcessoSheet } from '@/components/fiscal/empresas/acoes-processo-sheet';

const CHAVE_RASCUNHO = 'e09-t01-plano';

const POR_PAGINA = 20; // mesmo valor de PAGINA em plano.service.ts
const EXCECOES = ['Conta desativada', 'Mudança de classificação após fechamento'];
const COLUNAS: { rotulo: string; ordenar?: 'contaContabil' | 'naturezaConta' | 'centroCusto' | 'vigenciaInicio' | 'vigenciaFim' }[] = [
  { rotulo: 'Conta contábil', ordenar: 'contaContabil' },
  { rotulo: 'Situação' },
  { rotulo: 'Natureza da conta', ordenar: 'naturezaConta' },
  { rotulo: 'Centro de custo', ordenar: 'centroCusto' },
  { rotulo: 'Início de vigência', ordenar: 'vigenciaInicio' },
  { rotulo: 'Fim de vigência', ordenar: 'vigenciaFim' },
];
const FILTROS = [
  ['', 'Todos'],
  ['DRAFT', 'Rascunho'],
  ['REVIEW', 'Aguardando revisão'],
  ['APPROVED', 'Aprovado'],
  ['REJECTED', 'Rejeitado'],
  ['SUSPENDED', 'Suspenso'],
] as const;
const NATUREZAS = [
  ['ATIVO', 'Ativo'],
  ['PASSIVO', 'Passivo'],
  ['RECEITA', 'Receita'],
  ['DESPESA', 'Despesa'],
  ['CUSTO', 'Custos'],
] as const;

export type ContaGrade = {
  codigo: string;
  nome: string;
  situacaoRotulo: string;
  naturezaRotulo: string;
  centroNome: string;
  vigenciaInicio: string;
  vigenciaFim: string | null;
  classificacaoRotulo: string;
  grupo: string;
  contaPaiCodigo: string | null;
  centroCodigo: string;
  situacao: string;
  natureza: string;
  classificacao: string;
  numero: number;
  responsavelNome: string;
  criadoEm: string;
  alteradoEm: string;
};

type Modal = 'bloquear' | 'mapear' | 'versionar' | 'aprovar' | 'revisar-competencia';
type Ordenar = NonNullable<(typeof COLUNAS)[number]['ordenar']>;
type Centro = { codigo: string; nome: string };
type OpcaoPai = { codigo: string; nome: string };
type Evento = { quando: string; quem: string; acontecimento: string; justificativa: string };
type Formulario = {
  codigo: string;
  nome: string;
  classificacao: 'sintetica' | 'analitica';
  natureza: 'ATIVO' | 'PASSIVO' | 'RECEITA' | 'DESPESA' | 'CUSTO';
  grupo: string;
  contaPaiCodigo: string;
  centroCodigo: string;
  vigenciaInicio: string;
  vigenciaFim: string;
  justificativa: string;
};

/** Referência do requisito (catalogo.js, E09-T01). */
const REFERENCIA: Array<[string, string]> = [
  ['Campos', 'conta sintética/analítica, código, natureza, grupo, validade, centro custo'],
  ['Ações', 'criar, versionar, aprovar, bloquear conta e mapear lançamentos'],
  ['Regras', 'partida dobrada, níveis hierárquicos válidos, competência obrigatória'],
  ['Exceções', 'conta desativada, mudança de classificação após fechamento'],
];
const TITULOS_MODAL: Record<Modal, string> = {
  bloquear: 'Bloquear conta e mapear lançamentos',
  mapear: 'Bloquear conta e mapear lançamentos',
  versionar: 'Versionar',
  aprovar: 'Aprovar',
  'revisar-competencia': 'Revisar competência',
};
const DICA_CADASTRO = 'Vinculado a cadastro existente; seleção obrigatória no formulário.';
const DICA_ENUM = 'Valor pertencente ao conjunto de opções do domínio.';
const CONTROLE = 'h-8 w-full rounded-md border border-border-strong bg-background px-2 text-xs disabled:bg-surface-2 read-only:bg-surface-2';
const AREA = 'min-h-16 w-full rounded-md border border-border-strong bg-background px-2 py-1.5 text-xs';

type Contagens = { revisao: number; suspensos: number };

const FORM_VAZIO: Formulario = {
  codigo: '',
  nome: '',
  classificacao: 'sintetica',
  natureza: 'ATIVO',
  grupo: '',
  contaPaiCodigo: '',
  centroCodigo: '',
  vigenciaInicio: '',
  vigenciaFim: '',
  justificativa: '',
};

function dataBr(iso: string | null): string {
  if (!iso) return '—';
  const [ano, mes, dia] = iso.slice(0, 10).split('-');
  if (!ano || !mes || !dia) return '—';
  return `${dia}/${mes}/${ano}`;
}

function quandoBr(iso: string): string {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return iso;
  return data.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

function textoMensagem(message: unknown): string {
  if (typeof message === 'string') return message;
  if (Array.isArray(message)) return message.map(String).join(' ');
  if (message && typeof message === 'object' && 'message' in message) {
    return textoMensagem((message as { message: unknown }).message);
  }
  return '';
}

async function lerMensagem(resposta: Response): Promise<string> {
  const texto = await resposta.text();
  if (!texto) return '';
  try {
    const corpo = JSON.parse(texto) as { message?: unknown };
    return textoMensagem(corpo.message);
  } catch {
    return texto;
  }
}

function corpoAcao(modal: Modal, conta: ContaGrade, justificativa: string) {
  if (modal === 'revisar-competencia') {
    return {
      numero: conta.numero,
      vigenciaInicio: conta.vigenciaInicio,
      vigenciaFim: conta.vigenciaFim,
      justificativa,
    };
  }
  if (modal === 'mapear') {
    return { numero: conta.numero, centroCodigo: conta.centroCodigo, justificativa };
  }
  if (modal === 'versionar') {
    return {
      nome: conta.nome,
      classificacao: conta.classificacao,
      natureza: conta.natureza,
      grupo: conta.grupo,
      contaPaiCodigo: conta.contaPaiCodigo,
      centroCodigo: conta.centroCodigo,
      vigenciaInicio: conta.vigenciaInicio,
      vigenciaFim: conta.vigenciaFim,
      numero: conta.numero,
      justificativa,
    };
  }
  return { numero: conta.numero, justificativa };
}

function formularioDe(conta: ContaGrade): Formulario {
  return {
    codigo: conta.codigo,
    nome: conta.nome,
    classificacao: conta.classificacao === 'analitica' ? 'analitica' : 'sintetica',
    natureza: (NATUREZAS.some(([valor]) => valor === conta.natureza) ? conta.natureza : 'ATIVO') as Formulario['natureza'],
    grupo: conta.grupo,
    contaPaiCodigo: conta.contaPaiCodigo ?? '',
    centroCodigo: conta.centroCodigo,
    vigenciaInicio: conta.vigenciaInicio,
    vigenciaFim: conta.vigenciaFim ?? '',
    justificativa: '',
  };
}

function corpoConta(form: Formulario) {
  return {
    codigo: form.codigo.trim(),
    nome: form.nome.trim(),
    classificacao: form.classificacao,
    natureza: form.natureza,
    grupo: form.grupo.trim(),
    contaPaiCodigo: form.contaPaiCodigo.trim() || null,
    centroCodigo: form.centroCodigo.trim(),
    vigenciaInicio: form.vigenciaInicio,
    vigenciaFim: form.vigenciaFim.trim() || null,
    justificativa: form.justificativa.trim(),
  };
}

export function PlanoContasClient({ inicial, totalInicial = inicial.length, contagensIniciais = null, semAcesso = false }: {
  inicial: ContaGrade[];
  totalInicial?: number;
  contagensIniciais?: Contagens | null;
  semAcesso?: boolean;
}) {
  const [contas, setContas] = useState(inicial);
  const [total, setTotal] = useState(totalInicial);
  const [codigoSelecionado, setCodigoSelecionado] = useState(inicial[0]?.codigo ?? '');
  const [aba, setAba] = useState<Aba>('Ficha e campos');
  const [processo, setProcesso] = useState(false);
  const [drawer, setDrawer] = useState<null | 'criar' | 'editar'>(null);
  const [modal, setModal] = useState<null | Modal>(null);
  const [motivo, setMotivo] = useState('');
  const [aviso, setAviso] = useState(semAcesso ? 'Acesso não permitido' : '');
  const [busca, setBusca] = useState('');
  const [situacao, setSituacao] = useState('');
  const [ordenar, setOrdenar] = useState<Ordenar>('contaContabil');
  const [direcao, setDirecao] = useState<'asc' | 'desc'>('asc');
  const [pagina, setPagina] = useState(1);
  const [marcadas, setMarcadas] = useState<string[]>([]);
  const [form, setForm] = useState<Formulario>(FORM_VAZIO);
  const [formBase, setFormBase] = useState(JSON.stringify(FORM_VAZIO));
  const [centros, setCentros] = useState<Centro[]>([]);
  const [centrosVazios, setCentrosVazios] = useState(false);
  const [lookupPai, setLookupPai] = useState(false);
  const [paisOpcoes, setPaisOpcoes] = useState<OpcaoPai[]>([]);
  const [paisTruncado, setPaisTruncado] = useState(false);
  const [paiBusca, setPaiBusca] = useState('');
  const [paiRotulo, setPaiRotulo] = useState('');
  const [erroPais, setErroPais] = useState('');
  const pedidoPais = useRef(0);
  const pedidoRotuloPai = useRef(0);
  const botaoPesquisaPai = useRef<HTMLButtonElement>(null);
  const popupPai = useRef<HTMLDivElement>(null);
  const [centroNovo, setCentroNovo] = useState({ codigo: '', nome: '', justificativa: '' });
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [acessoNegado, setAcessoNegado] = useState(semAcesso);
  const [contagens, setContagens] = useState<Contagens | null>(contagensIniciais);
  const [carregando, setCarregando] = useState(false);
  const [erroLista, setErroLista] = useState('');
  const [carregandoEventos, setCarregandoEventos] = useState(false);
  const [erroEventos, setErroEventos] = useState<string | null>(null);
  const sequenciaLista = useRef(0);

  const selecionada = contas.find((conta) => conta.codigo === codigoSelecionado) ?? contas[0];

  useEffect(() => {
    const gravado = sessionStorage.getItem(CHAVE_RASCUNHO);
    if (gravado === null) sessionStorage.setItem(CHAVE_RASCUNHO, '{}');
  }, []);

  function guardarRascunho(extra: Record<string, unknown> = {}) {
    sessionStorage.setItem(CHAVE_RASCUNHO, JSON.stringify({
      q: busca, situacao, ordenar, direcao, pagina, rascunho: form, ...extra,
    }));
  }

  async function carregar(parcial: Partial<{ q: string; situacao: string; ordenar: Ordenar; direcao: 'asc' | 'desc'; pagina: number }> = {}) {
    const consulta = { q: busca, situacao, ordenar, direcao, pagina, ...parcial };
    const qs = new URLSearchParams({
      pagina: String(consulta.pagina),
      q: consulta.q,
      situacao: consulta.situacao,
      ordenar: consulta.ordenar,
      direcao: consulta.direcao,
    });
    const minha = (sequenciaLista.current += 1);
    setCarregando(true);
    try {
      const resposta = await fetch(`/api/contabilidade/plano?${qs}`);
      if (minha !== sequenciaLista.current) return;
      if (resposta.status === 403) {
        setAcessoNegado(true);
        setAviso('Acesso não permitido');
        return;
      }
      if (!resposta.ok) {
        setErroLista((await lerMensagem(resposta)) || 'Não foi possível atualizar a lista. Tente novamente.');
        return;
      }
      const corpo = await resposta.json() as { itens?: ContaGrade[]; total?: number; contagens?: Contagens };
      if (minha !== sequenciaLista.current) return;
      aplicarLista(corpo);
    } catch {
      if (minha === sequenciaLista.current) setErroLista('Não foi possível atualizar a lista. Tente novamente.');
    } finally {
      if (minha === sequenciaLista.current) setCarregando(false);
    }
  }

  function aplicarLista(corpo: { itens?: ContaGrade[]; total?: number; contagens?: Contagens }) {
    const itens = corpo.itens ?? [];
    setErroLista('');
    setContas(itens);
    setTotal(corpo.total ?? itens.length);
    if (corpo.contagens) setContagens(corpo.contagens);
    // A lista mudou (página, filtro, ordenação ou gravação): marcas de outra visão não seguem para o lote.
    setMarcadas([]);
    setCodigoSelecionado((atual) => itens.some((item) => item.codigo === atual) ? atual : (itens[0]?.codigo ?? ''));
  }

  function ordenarPor(chave: Ordenar) {
    const proxima = ordenar === chave && direcao === 'asc' ? 'desc' : 'asc';
    setOrdenar(chave);
    setDirecao(proxima);
    guardarRascunho({ ordenar: chave, direcao: proxima });
    void carregar({ ordenar: chave, direcao: proxima, pagina: 1 });
    setPagina(1);
  }

  async function tratarResposta(resposta: Response, sucesso?: string) {
    if (resposta.status === 403) return setAviso('Acesso não permitido');
    if (resposta.status === 409) return setAviso('conflito concorrente');
    if (!resposta.ok) return setAviso(await lerMensagem(resposta));
    if (sucesso) setAviso(sucesso);
    setModal(null);
    setMotivo('');
    setDrawer(null);
    await carregar();
  }

  async function confirmar() {
    if (!selecionada || !modal) return;
    const justificativa = motivo.trim();
    if (!justificativa) {
      setAviso('Informe justificativa para demonstrar a decisão auditável.');
      return;
    }
    if (modal === 'revisar-competencia' && !/^\d{4}-\d{2}-\d{2}$/.test(selecionada.vigenciaInicio)) {
      setAviso('Início de vigência é obrigatório');
      return;
    }
    const lote = (modal === 'revisar-competencia' || modal === 'aprovar' || modal === 'bloquear') && marcadas.length > 1;
    const resposta = lote
      ? await fetch('/api/contabilidade/plano/lote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acao: modal,
          codigos: marcadas,
          justificativa,
          numeroPorCodigo: Object.fromEntries(
            contas.filter((conta) => marcadas.includes(conta.codigo)).map((conta) => [conta.codigo, conta.numero]),
          ),
        }),
      })
      : await fetch(`/api/contabilidade/plano/${encodeURIComponent(selecionada.codigo)}/${modal}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpoAcao(modal, selecionada, justificativa)),
      });
    await tratarResposta(resposta, modal === 'aprovar' ? 'concluído com evidência' : undefined);
  }

  function abrirCriar() {
    setForm(FORM_VAZIO);
    setFormBase(JSON.stringify(FORM_VAZIO));
    setDrawer('criar');
    pedidoRotuloPai.current += 1;
    setPaiRotulo('');
    setLookupPai(false);
    setCentrosVazios(false);
  }

  async function rotuloDoPai(codigo: string) {
    const naGrade = contas.find((conta) => conta.codigo === codigo);
    if (naGrade) return naGrade.nome;
    try {
      const resposta = await fetch(`/api/contabilidade/plano/opcoes-pai?q=${encodeURIComponent(codigo)}`);
      if (!resposta.ok) return '';
      const corpo = await resposta.json() as { itens?: OpcaoPai[] };
      return corpo.itens?.find((item) => item.codigo === codigo)?.nome ?? '';
    } catch {
      return '';
    }
  }

  function abrirEditar() {
    if (!selecionada) return;
    const preenchido = formularioDe(selecionada);
    setForm(preenchido);
    setFormBase(JSON.stringify(preenchido));
    setDrawer('editar');
    setPaiRotulo('');
    setLookupPai(false);
    const pai = preenchido.contaPaiCodigo;
    const pedido = (pedidoRotuloPai.current += 1);
    if (pai) {
      void rotuloDoPai(pai).then((nome) => {
        if (pedido === pedidoRotuloPai.current) setPaiRotulo((atual) => (nome && !atual ? nome : atual));
      });
    }
  }

  function voltar() {
    if (drawer && JSON.stringify(form) !== formBase) {
      if (!window.confirm('Há alterações não salvas. Deseja sair?')) return;
    }
    const gravado = sessionStorage.getItem(CHAVE_RASCUNHO);
    if (gravado) {
      try {
        const dados = JSON.parse(gravado) as { q?: string; situacao?: string; ordenar?: Ordenar; direcao?: 'asc' | 'desc'; pagina?: number };
        if (typeof dados.q === 'string') setBusca(dados.q);
        if (typeof dados.situacao === 'string') setSituacao(dados.situacao);
        if (dados.ordenar) setOrdenar(dados.ordenar);
        if (dados.direcao) setDirecao(dados.direcao);
        if (typeof dados.pagina === 'number') setPagina(dados.pagina);
      } catch {
        sessionStorage.setItem(CHAVE_RASCUNHO, '{}');
      }
    }
    pedidoRotuloPai.current += 1;
    setDrawer(null);
  }

  async function pesquisarCentros() {
    const resposta = await fetch('/api/contabilidade/centros-custo');
    if (!resposta.ok) {
      setAviso(await lerMensagem(resposta));
      return;
    }
    const lista = await resposta.json() as Centro[];
    setCentros(Array.isArray(lista) ? lista : []);
    setCentrosVazios(!Array.isArray(lista) || lista.length === 0);
    if (!Array.isArray(lista) || lista.length === 0) {
      setAviso('Nenhum cadastro disponível para seleção. Consulte a área responsável.');
    }
  }

  async function carregarPais(q: string) {
    const pedido = (pedidoPais.current += 1);
    const atual = () => pedido === pedidoPais.current;
    try {
      const resposta = await fetch(`/api/contabilidade/plano/opcoes-pai?q=${encodeURIComponent(q)}`);
      if (!resposta.ok) {
        const mensagem = await lerMensagem(resposta);
        if (atual()) setErroPais(mensagem || 'Não foi possível carregar as contas. Tente novamente.');
        return;
      }
      const corpo = await resposta.json() as { itens?: OpcaoPai[]; truncado?: boolean };
      if (!atual()) return;
      setErroPais('');
      setPaisOpcoes(corpo.itens ?? []);
      setPaisTruncado(corpo.truncado === true);
    } catch {
      if (atual()) setErroPais('Não foi possível carregar as contas. Tente novamente.');
    }
  }

  function abrirPesquisaPai() {
    setPaisOpcoes([]);
    setPaisTruncado(false);
    setPaiBusca('');
    setErroPais('');
    setLookupPai(true);
    void carregarPais('');
  }

  // Fecha o popup e devolve o foco ao botão Pesquisar que o abriu.
  function fecharPesquisaPai() {
    setLookupPai(false);
    botaoPesquisaPai.current?.focus();
  }

  // Enquanto o popup está aberto: Escape fecha de qualquer foco; Tab/Shift+Tab ciclam dentro dele.
  useEffect(() => {
    if (!lookupPai) return undefined;
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === 'Escape') {
        setLookupPai(false);
        botaoPesquisaPai.current?.focus();
        return;
      }
      if (evento.key !== 'Tab' || !popupPai.current) return;
      const focaveis = Array.from(popupPai.current.querySelectorAll<HTMLElement>('button, input, [href], select, textarea, [tabindex]:not([tabindex="-1"])'))
        .filter((el) => !el.hasAttribute('disabled'));
      const primeiro = focaveis[0];
      const ultimo = focaveis[focaveis.length - 1];
      if (!primeiro || !ultimo) return;
      const dentro = popupPai.current.contains(document.activeElement);
      if (!dentro || (evento.shiftKey && document.activeElement === primeiro) || (!evento.shiftKey && document.activeElement === ultimo)) {
        evento.preventDefault();
        (evento.shiftKey && dentro ? ultimo : primeiro).focus();
      }
    }
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [lookupPai]);

  function escolherPai(opcao: OpcaoPai) {
    setForm({ ...form, contaPaiCodigo: opcao.codigo });
    pedidoRotuloPai.current += 1;
    setPaiRotulo(opcao.nome);
    fecharPesquisaPai();
  }

  async function criarCentro() {
    const resposta = await fetch('/api/contabilidade/centros-custo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(centroNovo),
    });
    if (!resposta.ok) {
      setAviso(await lerMensagem(resposta));
      return;
    }
    setForm((atual) => ({ ...atual, centroCodigo: centroNovo.codigo.trim() }));
    setCentroNovo({ codigo: '', nome: '', justificativa: '' });
    await pesquisarCentros();
  }

  async function salvarConta() {
    const corpo = corpoConta(form);
    const resposta = drawer === 'editar' && selecionada
      ? await fetch(`/api/contabilidade/plano/${encodeURIComponent(selecionada.codigo)}/editar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...corpo, codigo: undefined, numero: selecionada.numero }),
      })
      : await fetch('/api/contabilidade/plano', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
      });
    if (resposta.ok) setCodigoSelecionado(corpo.codigo || selecionada?.codigo || '');
    await tratarResposta(resposta);
  }

  async function validar() {
    const resposta = await fetch('/api/contabilidade/plano/validar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpoConta(form.codigo ? form : (selecionada ? formularioDe(selecionada) : form))),
    });
    if (!resposta.ok) {
      setAviso(await lerMensagem(resposta));
      return;
    }
    const corpo = await resposta.json() as { valido?: boolean; mensagens?: string[] };
    setAviso(corpo.valido ? 'concluído com evidência' : (corpo.mensagens ?? []).join(' '));
  }

  async function consultarHistorico(destino: Aba) {
    setAba(destino);
    if (!selecionada) return;
    setCarregandoEventos(true);
    setErroEventos(null);
    try {
      const resposta = await fetch(`/api/contabilidade/plano/${encodeURIComponent(selecionada.codigo)}/historico`);
      if (!resposta.ok) {
        setErroEventos((await lerMensagem(resposta)) || 'Não foi possível carregar o histórico. Tente novamente.');
        return;
      }
      setEventos(await resposta.json() as Evento[]);
    } catch {
      setErroEventos('Não foi possível carregar o histórico. Tente novamente.');
    } finally {
      setCarregandoEventos(false);
    }
  }

  async function exportar() {
    const qs = new URLSearchParams({ pagina: String(pagina), q: busca, situacao, ordenar, direcao });
    const resposta = await fetch(`/api/contabilidade/plano/exportar?${qs}`);
    if (!resposta.ok) {
      setAviso(await lerMensagem(resposta));
      return;
    }
    // blob, não text(): text() descarta o BOM e o Excel perde os acentos.
    const url = URL.createObjectURL(await resposta.blob());
    const link = document.createElement('a');
    link.href = url;
    link.download = 'plano-de-contas.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  function valorCelula(conta: ContaGrade, rotulo: string): string {
    if (rotulo === 'Conta contábil') return conta.nome;
    if (rotulo === 'Situação') return conta.situacaoRotulo;
    if (rotulo === 'Natureza da conta') return conta.naturezaRotulo;
    if (rotulo === 'Centro de custo') return conta.centroNome;
    if (rotulo === 'Início de vigência') return dataBr(conta.vigenciaInicio);
    return dataBr(conta.vigenciaFim);
  }

  const colunasGrade: ColunaContabil<ContaGrade>[] = COLUNAS.map((coluna) => ({
    rotulo: coluna.rotulo,
    ordenar: coluna.ordenar,
    celula: (conta) => (coluna.rotulo === 'Situação'
      ? <SeloSituacao situacao={conta.situacao} rotulo={conta.situacaoRotulo} />
      : valorCelula(conta, coluna.rotulo)),
  }));
  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const avisoNaTela = aviso ? <p role="status" className="rounded-md bg-info-soft p-2.5 text-xs text-info-fg">{aviso}</p> : null;

  function irParaPagina(nova: number) {
    setPagina(nova);
    void carregar({ pagina: nova });
  }

  if (acessoNegado) {
    return (
      <div className="grid gap-4">
        <PageHeader title="Plano de contas e centros de custo" />
        <EmptyState title="Acesso não permitido" description="A permissão é conferida no servidor." />
      </div>
    );
  }

  const acoesDominio: Array<{ rotulo: string; abrir: () => void }> = [
    { rotulo: 'Criar', abrir: abrirCriar },
    { rotulo: 'Versionar', abrir: () => setModal('versionar') },
    { rotulo: 'Aprovar', abrir: () => setModal('aprovar') },
    { rotulo: 'Bloquear conta e mapear lançamentos', abrir: () => setModal('bloquear') },
    { rotulo: 'Revisar competência', abrir: () => setModal('revisar-competencia') },
  ];

  return (
    <div className="grid gap-4">
      <PageHeader
        title="Plano de contas e centros de custo"
        subtitle="criar, versionar, aprovar, bloquear conta e mapear lançamentos."
        badge={(
          <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            Acesso típico: contador/controladoria <BadgeProvisorio />
          </span>
        )}
      >
        <Button type="button" variant="secondary" onClick={() => void exportar()}>Exportar</Button>
        <Button type="button" onClick={abrirCriar}>+ Novo registro</Button>
        <Button type="button" onClick={() => setProcesso(true)}>Ações do processo <ChevronDown aria-hidden="true" /></Button>
      </PageHeader>
      <KpiStrip>
        <Kpi label="Em revisão" value={contagens?.revisao ?? '—'} />
        <Kpi label="Bloqueados" value={contagens?.suspensos ?? '—'} />
      </KpiStrip>
      {!modal && !drawer && avisoNaTela}
      <div className="grid grid-cols-1 items-start gap-3.5 min-[1250px]:grid-cols-[minmax(0,1.34fr)_minmax(340px,1fr)]">
        <Card className="min-w-0">
          <CardHeader><CardTitle><h2>Registros e consultas</h2></CardTitle></CardHeader>
          <CardContent className="grid min-w-0 grid-cols-1 gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <input
                aria-label="Buscar registros da lista"
                placeholder="Pesquisar descrição ou referência de negócio"
                className={`${CONTROLE} max-w-[280px]`}
                value={busca}
                onChange={(evento) => {
                  const q = evento.target.value;
                  setBusca(q);
                  guardarRascunho({ q });
                  void carregar({ q, pagina: 1 });
                  setPagina(1);
                }}
              />
              <select
                aria-label="Filtrar situação"
                className={`${CONTROLE} max-w-[190px]`}
                value={situacao}
                onChange={(evento) => {
                  const valor = evento.target.value;
                  setSituacao(valor);
                  guardarRascunho({ situacao: valor });
                  void carregar({ situacao: valor, pagina: 1 });
                  setPagina(1);
                }}
              >
                {FILTROS.map(([valor, rotulo]) => <option key={rotulo} value={valor}>{rotulo}</option>)}
              </select>
              <span className="flex-1" />
              <Button type="button" size="sm" variant="secondary" onClick={() => void exportar()}>Exportar visão</Button>
            </div>
            {erroLista && (
              <div role="alert" className="flex flex-wrap items-center gap-3 rounded-md border border-destructive/40 p-3 text-xs text-destructive">
                {erroLista}
                <Button type="button" size="sm" variant="secondary" onClick={() => void carregar()}>Tentar novamente</Button>
              </div>
            )}
            {carregando ? <p role="status" aria-busy="true" className="text-xs text-muted-foreground">Carregando…</p> : null}
            <GradeContabil
              className="plano-grade"
              colunas={colunasGrade}
              linhas={contas}
              total={total}
              pagina={pagina}
              totalPaginas={totalPaginas}
              ordenar={ordenar}
              direcao={direcao}
              carregando={carregando}
              selecionado={selecionada?.codigo}
              marcadas={marcadas}
              rotuloLinha={(conta) => conta.nome}
              onSelecionar={setCodigoSelecionado}
              onMarcar={(codigo) => setMarcadas((atual) => atual.includes(codigo) ? atual.filter((item) => item !== codigo) : [...atual, codigo])}
              onOrdenar={(chave) => ordenarPor(chave as Ordenar)}
              onPagina={irParaPagina}
            />
          </CardContent>
        </Card>
        <Card className="min-w-0">
          <CardHeader><CardTitle><h2>Detalhamento e execução</h2></CardTitle></CardHeader>
          <CardContent className="min-w-0">
            <AbasContabeis
              aba={aba}
              onAba={(nome) => {
                if (nome === 'Histórico' || nome === 'Movimentações') void consultarHistorico(nome);
                else setAba(nome);
              }}
              eventos={eventos}
              carregandoEventos={carregandoEventos}
              erroEventos={erroEventos}
              situacao={selecionada ? { situacao: selecionada.situacao, rotulo: selecionada.situacaoRotulo } : null}
              regras="partida dobrada, níveis hierárquicos válidos, competência obrigatória"
              excecoes={EXCECOES}
              referencia={REFERENCIA}
              ficha={selecionada ? (
                <div className="grid gap-4 text-sm">
                  <div>
                    <SecaoRotulo>Informações do registro selecionado</SecaoRotulo>
                    <p className="mb-2 text-[11px] font-semibold text-muted-foreground">Dados principais</p>
                    <div className="grid grid-cols-1 gap-x-3.5 gap-y-2.5 sm:grid-cols-2">
                      <Campo label="Conta contábil">{selecionada.nome}</Campo>
                      <CampoDica label="Conta sintética/analítica" dica={DICA_ENUM}>{selecionada.classificacaoRotulo}</CampoDica>
                      <CampoDica label="Natureza da conta" dica={DICA_ENUM}>{selecionada.naturezaRotulo}</CampoDica>
                      <Campo label="Grupo">{selecionada.grupo}</Campo>
                      <CampoDica label="Centro de custo" dica={DICA_CADASTRO}>{selecionada.centroNome}</CampoDica>
                      <Campo label="Início de vigência">{dataBr(selecionada.vigenciaInicio)}</Campo>
                      <Campo label="Fim de vigência">{dataBr(selecionada.vigenciaFim)}</Campo>
                    </div>
                  </div>
                  <div>
                    <SecaoRotulo>Trilha e responsabilização</SecaoRotulo>
                    <div className="grid grid-cols-1 gap-x-3.5 gap-y-2.5 sm:grid-cols-2">
                      <Campo label="Empresa"><span className="flex flex-wrap items-center gap-2">— <BadgeProvisorio /></span></Campo>
                      <Campo label="Situação"><SeloSituacao situacao={selecionada.situacao} rotulo={selecionada.situacaoRotulo} /></Campo>
                      <Campo label="Responsável">{selecionada.responsavelNome}</Campo>
                      <Campo label="Alterado em">{quandoBr(selecionada.alteradoEm)}</Campo>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" onClick={abrirEditar}>Editar versão</Button>
                    <Button type="button" variant="secondary" onClick={() => void validar()}>Validar pré-condições</Button>
                    <Button type="button" variant="secondary" onClick={() => void consultarHistorico('Histórico')}>Consultar histórico</Button>
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
        aberto={processo}
        onFechar={() => setProcesso(false)}
        descricao="Operações previstas para o plano de contas e os centros de custo"
        apoio="Confirme permissões, validade, origem e efeitos contábeis antes de registrar."
        condicionantes={['partida dobrada, níveis hierárquicos válidos, competência obrigatória', 'Exceções: conta desativada, mudança de classificação após fechamento.']}
        comandos={[
          { titulo: 'Criar', rotuloAcessivel: 'Abrir decisão: Criar', abrir: () => { setProcesso(false); abrirCriar(); } },
          { titulo: 'Versionar', rotuloAcessivel: 'Abrir decisão: Versionar', abrir: () => { setProcesso(false); setModal('versionar'); } },
          { titulo: 'Aprovar', rotuloAcessivel: 'Abrir decisão: Aprovar', abrir: () => { setProcesso(false); setModal('aprovar'); } },
          { titulo: 'Bloquear conta e mapear lançamentos', abrir: () => { setProcesso(false); setModal('mapear'); } },
        ]}
      />

      <Sheet open={drawer !== null} onOpenChange={(aberto) => { if (!aberto) voltar(); }}>
        <SheetContent
          aria-describedby={undefined}
          className="w-full gap-0 overflow-y-auto p-0 sm:max-w-[580px]"
          onEscapeKeyDown={(evento) => { if (lookupPai) evento.preventDefault(); }}
        >
          <SheetHeader className="border-b border-border p-5">
            <span className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-primary">Cadastro · Contabilidade</span>
            <SheetTitle className="text-lg font-bold">Plano de contas e centros de custo</SheetTitle>
          </SheetHeader>
          <div className="flex flex-1 flex-col gap-3 p-5">
            {centrosVazios && (
              <div className="grid gap-3 rounded-md border border-border bg-surface-2 p-3">
                <p className="text-xs text-muted-foreground">Nenhum cadastro disponível para seleção. Consulte a área responsável.</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <CampoForm rotulo="Código" htmlFor="centro-codigo">
                    <input id="centro-codigo" className={CONTROLE} value={centroNovo.codigo} onChange={(evento) => setCentroNovo({ ...centroNovo, codigo: evento.target.value })} />
                  </CampoForm>
                  <CampoForm rotulo="Centro de custo" htmlFor="centro-nome">
                    <input id="centro-nome" className={CONTROLE} value={centroNovo.nome} onChange={(evento) => setCentroNovo({ ...centroNovo, nome: evento.target.value })} />
                  </CampoForm>
                  <div className="sm:col-span-2">
                    <CampoForm rotulo="Motivo da alteração" htmlFor="centro-motivo">
                      <textarea id="centro-motivo" rows={2} className={AREA} value={centroNovo.justificativa} onChange={(evento) => setCentroNovo({ ...centroNovo, justificativa: evento.target.value })} />
                    </CampoForm>
                  </div>
                </div>
                <Button type="button" size="sm" className="justify-self-start" onClick={() => void criarCentro()}>+ Novo registro</Button>
              </div>
            )}
            <SecaoRotulo>Dados principais</SecaoRotulo>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <CampoForm rotulo="Código" htmlFor="conta-codigo">
                <input id="conta-codigo" className={CONTROLE} value={form.codigo} readOnly={drawer === 'editar'} onChange={(evento) => setForm({ ...form, codigo: evento.target.value })} />
              </CampoForm>
              <CampoForm rotulo="Conta contábil" htmlFor="conta-nome">
                <input id="conta-nome" className={CONTROLE} placeholder="Informe conta contábil" value={form.nome} onChange={(evento) => setForm({ ...form, nome: evento.target.value })} />
              </CampoForm>
              <CampoForm rotulo="Conta sintética/analítica" htmlFor="conta-classe">
                <select id="conta-classe" className={CONTROLE} value={form.classificacao} onChange={(evento) => setForm({ ...form, classificacao: evento.target.value as Formulario['classificacao'] })}>
                  <option value="sintetica">sintética</option>
                  <option value="analitica">analítica</option>
                </select>
              </CampoForm>
              <CampoForm rotulo="Natureza da conta" htmlFor="conta-natureza">
                <select id="conta-natureza" className={CONTROLE} value={form.natureza} onChange={(evento) => setForm({ ...form, natureza: evento.target.value as Formulario['natureza'] })}>
                  {NATUREZAS.map(([valor, rotulo]) => <option key={valor} value={valor}>{rotulo}</option>)}
                </select>
              </CampoForm>
              <CampoForm rotulo="Grupo" htmlFor="conta-grupo">
                <input id="conta-grupo" className={CONTROLE} value={form.grupo} onChange={(evento) => setForm({ ...form, grupo: evento.target.value })} />
              </CampoForm>
              <CampoForm rotulo="Conta contábil" htmlFor="conta-pai">
                <div className="flex items-stretch gap-1.5">
                  <select id="conta-pai" className={`${CONTROLE} min-w-0 flex-1`} ref={(elemento) => { elemento?.setAttribute('placeholder', 'Selecione conta contábil'); }} value={form.contaPaiCodigo} onChange={(evento) => setForm({ ...form, contaPaiCodigo: evento.target.value })}>
                    <option value="">Selecione conta contábil</option>
                    {form.contaPaiCodigo && <option value={form.contaPaiCodigo}>{paiRotulo || form.contaPaiCodigo}</option>}
                  </select>
                  <Button type="button" size="sm" variant="secondary" ref={botaoPesquisaPai} aria-label="Pesquisar conta contábil" title="Pesquisar cadastro pelo nome" onClick={abrirPesquisaPai}>Pesquisar</Button>
                </div>
                <Dica>Vinculado a cadastro existente; seleção obrigatória no formulário.</Dica>
              </CampoForm>
              <CampoForm rotulo="Centro de custo" htmlFor="conta-centro">
                <div className="flex items-stretch gap-1.5">
                  <select id="conta-centro" className={`${CONTROLE} min-w-0 flex-1`} value={form.centroCodigo} onChange={(evento) => setForm({ ...form, centroCodigo: evento.target.value })}>
                    <option value="">Selecione</option>
                    {centros.map((centro) => <option key={centro.codigo} value={centro.codigo}>{centro.nome}</option>)}
                  </select>
                  <Button type="button" size="sm" variant="secondary" aria-label="Pesquisar centro de custo" title="Pesquisar cadastro pelo nome" onClick={() => void pesquisarCentros()}>Pesquisar</Button>
                </div>
                <Dica>Seleção vinculada ao cadastro; sem digitar identificadores.</Dica>
              </CampoForm>
              <CampoForm rotulo="Início de vigência" htmlFor="conta-inicio">
                <input id="conta-inicio" type="date" className={CONTROLE} value={form.vigenciaInicio} onChange={(evento) => setForm({ ...form, vigenciaInicio: evento.target.value })} />
              </CampoForm>
              <CampoForm rotulo="Fim de vigência" htmlFor="conta-fim">
                <input id="conta-fim" type="date" className={CONTROLE} value={form.vigenciaFim} onChange={(evento) => setForm({ ...form, vigenciaFim: evento.target.value })} />
              </CampoForm>
              <CampoForm rotulo="Situação" htmlFor="conta-situacao">
                <select id="conta-situacao" className={CONTROLE} disabled value="DRAFT">
                  <option value="DRAFT">Rascunho</option>
                </select>
              </CampoForm>
              <div className="sm:col-span-2">
                <CampoForm rotulo="Motivo da alteração" htmlFor="review-justification">
                  <textarea id="review-justification" rows={3} className={AREA} placeholder="Por que este cadastro precisa ser criado/alterado?" value={form.justificativa} onChange={(evento) => setForm({ ...form, justificativa: evento.target.value })} />
                </CampoForm>
              </div>
            </div>
            {!modal && avisoNaTela}
          </div>
          <SheetFooter className="flex-row justify-end border-t border-border px-5 py-3">
            <Button type="button" variant="secondary" onClick={voltar}>Voltar</Button>
            <Button type="button" variant="secondary" onClick={() => void validar()}>Verificar dados</Button>
            <Button type="button" onClick={() => void salvarConta()}>{drawer === 'editar' ? 'Editar versão' : 'Criar'}</Button>
          </SheetFooter>
          {lookupPai && (
            <div
              ref={popupPai}
              role="dialog"
              aria-modal="true"
              aria-label="Selecionar Conta contábil"
              className="fixed inset-0 z-[120] grid place-items-center bg-lookup-scrim p-3.5"
            >
              <div className="w-[min(490px,95vw)] overflow-hidden rounded-[9px] bg-card shadow-lg">
                <div className="flex items-center justify-between gap-2 border-b border-border px-3.5 py-3">
                  <h2 className="text-sm font-bold">Selecionar Conta contábil</h2>
                  <Button type="button" size="sm" variant="secondary" onClick={fecharPesquisaPai}>Fechar</Button>
                </div>
                <input
                  type="search"
                  autoFocus
                  placeholder="Pesquisar pelo nome ou descrição"
                  aria-label="Pesquisar cadastro"
                  className="m-3 h-9 w-[calc(100%-24px)] rounded-md border border-border-strong px-2 text-xs"
                  value={paiBusca}
                  onChange={(evento) => { setPaiBusca(evento.target.value); void carregarPais(evento.target.value); }}
                />
                <div className="max-h-[315px] overflow-auto">
                  {paisOpcoes.filter((opcao) => !(drawer === 'editar' && opcao.codigo === selecionada?.codigo)).map((opcao) => (
                    <button type="button" key={opcao.codigo} className="block w-full border-b border-border px-3.5 py-2.5 text-left hover:bg-surface-2" onClick={() => escolherPai(opcao)}>
                      <b className="block text-xs">{opcao.nome}</b>
                      <small className="mt-1 block text-[10px] text-muted-foreground">{opcao.codigo}</small>
                    </button>
                  ))}
                </div>
                {erroPais && <p role="alert" className="px-3.5 py-2 text-xs text-destructive">{erroPais}</p>}
                {paisTruncado && <p className="px-3.5 py-2 text-xs text-muted-foreground">Refine a busca para ver mais contas.</p>}
                <p className="px-3.5 py-2.5 text-[10px] text-muted-foreground">A seleção utiliza uma referência interna invisível, nunca digitação de GUID.</p>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={modal !== null} onOpenChange={(aberto) => { if (!aberto) { setModal(null); setAviso(''); } }}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Ação do domínio: {modal ? TITULOS_MODAL[modal] : ''}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 px-4">
            <CampoForm rotulo="Justificativa / observação" htmlFor="action-reason">
              <textarea id="action-reason" rows={3} className={AREA} placeholder="Registre a razão para a decisão" value={motivo} onChange={(evento) => setMotivo(evento.target.value)} />
            </CampoForm>
            {avisoNaTela}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => { setModal(null); setAviso(''); }}>Cancelar</Button>
            <Button type="button" onClick={() => void confirmar()}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Dica({ children }: { children: ReactNode }) {
  return <span className="mt-1 block text-[11px] text-muted-foreground">{children}</span>;
}

/** Campo da ficha com a dica do protótipo abaixo do valor (cadastro vinculado ou opção do domínio). */
function CampoDica({ label, dica, children }: { label: string; dica: string; children: ReactNode }) {
  return (
    <div>
      <Campo label={label}>{children}</Campo>
      <Dica>{dica}</Dica>
    </div>
  );
}
