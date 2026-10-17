'use client';

import { useEffect, useRef, useState } from 'react';
import { BadgeProvisorio } from '@/components/ui/badge-provisorio';

const CHAVE_RASCUNHO = 'e09-t01-plano';

const ABAS = ['Ficha e campos', 'Movimentações', 'Regras e validações', 'Exceções', 'Histórico', 'Integrações', 'Aceite e testes'] as const;
const EXCECOES = ['Conta desativada', 'Mudança de classificação após fechamento'];
const ACEITE = [
  'Todos os campos de negócio e seus formatos são exibidos e validados',
  'Ações de cadastro, edição, confirmação, cancelamento e versões possuem estados visíveis',
  'Regras de negócio do backend e pré-condições são verificadas',
  'Fluxos negativos exibem erros e não produzem gravações parciais',
  'Permissões e segregação das aprovações são auditáveis',
  'Concorrência, duplicação e reprocessamento seguros são testados',
  'Interface respeita DS v3, teclado, estados vazios e tratamento de loading/erro',
  'Integrações e batch possuem evidência de contrato, sandbox e rastreabilidade',
];
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

type Aba = (typeof ABAS)[number];
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

export function PlanoContasClient({ inicial, semAcesso = false }: { inicial: ContaGrade[]; semAcesso?: boolean }) {
  const [contas, setContas] = useState(inicial);
  const [total, setTotal] = useState(inicial.length);
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
    const resposta = await fetch(`/api/contabilidade/plano?${qs}`);
    if (resposta.status === 403) {
      setAcessoNegado(true);
      setAviso('Acesso não permitido');
      return;
    }
    if (!resposta.ok) {
      setAviso(await lerMensagem(resposta));
      return;
    }
    const corpo = await resposta.json() as { itens?: ContaGrade[]; total?: number };
    const itens = corpo.itens ?? [];
    setContas(itens);
    setTotal(corpo.total ?? itens.length);
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
    const resposta = await fetch(`/api/contabilidade/plano/${encodeURIComponent(selecionada.codigo)}/historico`);
    if (!resposta.ok) {
      setAviso(await lerMensagem(resposta));
      return;
    }
    setEventos(await resposta.json() as Evento[]);
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

  if (acessoNegado) {
    return (
      <>
        <h1>Plano de contas e centros de custo</h1>
        <p>Acesso não permitido</p>
      </>
    );
  }

  return (
    <>
      <style>{`
        .plano-cartoes { display: none; }
        @media (max-width: 800px) {
          .plano-grade { display: none; }
          .plano-cartoes { display: grid; gap: 12px; }
        }
      `}</style>
      <h1>Plano de contas e centros de custo</h1>
      <p>Acesso típico: contador/controladoria <BadgeProvisorio texto="Provisório" /></p>
      <button type="button" onClick={() => void exportar()}>Exportar</button>
      <button type="button" onClick={abrirCriar}>+ Novo registro</button>
      <button type="button" onClick={() => setProcesso(true)}>Ações do processo</button>
      <button type="button" onClick={voltar}>Voltar</button>
      <div>
        <button type="button" onClick={abrirCriar}>Criar</button>
        <button type="button" onClick={() => setModal('versionar')}>Versionar</button>
        <button type="button" onClick={() => setModal('aprovar')}>Aprovar</button>
        <button type="button" onClick={() => setModal('bloquear')}>Bloquear conta e mapear lançamentos</button>
        <button type="button" onClick={() => setModal('revisar-competencia')}>Revisar competência</button>
      </div>
      <div>
        <input aria-label="Buscar registros da lista" placeholder="Pesquisar descrição ou referência de negócio" value={busca} onChange={(evento) => {
          const q = evento.target.value;
          setBusca(q);
          guardarRascunho({ q });
          void carregar({ q, pagina: 1 });
          setPagina(1);
        }} />
        <select aria-label="Filtrar situação" value={situacao} onChange={(evento) => {
          const valor = evento.target.value;
          setSituacao(valor);
          guardarRascunho({ situacao: valor });
          void carregar({ situacao: valor, pagina: 1 });
          setPagina(1);
        }}>
          {FILTROS.map(([valor, rotulo]) => <option key={rotulo} value={valor}>{rotulo}</option>)}
        </select>
        <button type="button" onClick={() => void exportar()}>Exportar visão</button>
      </div>
      <div className="plano-grade">
        <table>
          <thead>
            <tr>
              <th><span className="sr-only">Selecionar</span></th>
              {COLUNAS.map((coluna) => (
                <th key={coluna.rotulo}>
                  {coluna.ordenar ? (
                    <button type="button" aria-label={`Ordenar por ${coluna.rotulo}`} onClick={() => ordenarPor(coluna.ordenar!)}>
                      {coluna.rotulo}
                    </button>
                  ) : coluna.rotulo}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {contas.length === 0 ? (
              <tr>
                <td colSpan={7}>Nenhum resultado para o período, filtro ou situação escolhidos. Limpe os filtros ou cadastre um novo registro.</td>
              </tr>
            ) : contas.map((conta) => (
              <tr key={conta.codigo} onClick={() => setCodigoSelecionado(conta.codigo)}>
                <td>
                  <input
                    type="checkbox"
                    aria-label={`Selecionar ${conta.nome}`}
                    checked={marcadas.includes(conta.codigo)}
                    onChange={() => setMarcadas((atual) => atual.includes(conta.codigo) ? atual.filter((item) => item !== conta.codigo) : [...atual, conta.codigo])}
                  />
                </td>
                {COLUNAS.map((coluna) => <td key={coluna.rotulo}>{valorCelula(conta, coluna.rotulo)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="plano-cartoes">
        {contas.map((conta) => (
          <article key={conta.codigo}>
            {COLUNAS.map((coluna) => (
              <p key={coluna.rotulo}><b>{coluna.rotulo}</b> {valorCelula(conta, coluna.rotulo)}</p>
            ))}
          </article>
        ))}
      </div>
      <p>Exibindo {contas.length} de {total}</p>
      <button type="button" onClick={() => { const nova = Math.max(1, pagina - 1); setPagina(nova); void carregar({ pagina: nova }); }}>Anterior</button>
      <button type="button" onClick={() => { const nova = pagina + 1; setPagina(nova); void carregar({ pagina: nova }); }}>Próxima</button>
      <div role="tablist">
        {ABAS.map((nome) => (
          <button key={nome} type="button" role="tab" aria-selected={aba === nome} onClick={() => {
            if (nome === 'Histórico' || nome === 'Movimentações') void consultarHistorico(nome);
            else setAba(nome);
          }}>{nome}</button>
        ))}
      </div>
      {aba === 'Ficha e campos' && selecionada && (
        <section>
          <h2>Dados principais</h2>
          <p>Conta contábil {selecionada.nome}</p>
          <p>Natureza da conta {selecionada.naturezaRotulo}</p>
          <p>Centro de custo {selecionada.centroNome}</p>
          <p>Início de vigência {dataBr(selecionada.vigenciaInicio)}</p>
          <p>Fim de vigência {dataBr(selecionada.vigenciaFim)}</p>
          <p>Situação {selecionada.situacaoRotulo}</p>
          <p>Grupo {selecionada.grupo}</p>
          <p>Conta sintética/analítica {selecionada.classificacaoRotulo}</p>
          <p>Empresa —</p>
          <p>Responsável {selecionada.responsavelNome}</p>
          <button type="button" onClick={abrirEditar}>Editar versão</button>
          <button type="button" onClick={() => void validar()}>Validar pré-condições</button>
          <button type="button" onClick={() => void consultarHistorico('Histórico')}>Consultar histórico</button>
        </section>
      )}
      {aba === 'Movimentações' && (
        <table>
          <thead>
            <tr>
              <th>Acontecimento</th>
              <th>Origem</th>
              <th>Efeito</th>
              <th>Situação</th>
            </tr>
          </thead>
          <tbody>
            {eventos.map((evento) => (
              <tr key={`${evento.quando}-${evento.acontecimento}`}>
                <td>{evento.acontecimento}</td>
                <td>{evento.quem}</td>
                <td>{evento.justificativa}</td>
                <td>{selecionada?.situacaoRotulo ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {aba === 'Regras e validações' && <p>partida dobrada, níveis hierárquicos válidos, competência obrigatória</p>}
      {aba === 'Exceções' && EXCECOES.map((texto) => (
        <p key={texto}><b>Bloqueio / exceção:</b> {texto}.</p>
      ))}
      {aba === 'Histórico' && eventos.map((evento) => (
        <p key={`${evento.quando}-${evento.acontecimento}`}>{evento.acontecimento} {quandoBr(evento.quando)} {evento.quem}</p>
      ))}
      {aba === 'Integrações' && <p>Esta tela não chama serviço externo.</p>}
      {aba === 'Aceite e testes' && (
        <ul>
          {ACEITE.map((item) => <li key={item}>{item}</li>)}
        </ul>
      )}
      {processo && (
        <button type="button" onClick={() => { setProcesso(false); setModal('mapear'); }}>Abrir decisão →</button>
      )}
      {drawer && (
        <section>
          <h2>Dados principais</h2>
          <button type="button" aria-label="Pesquisar centro de custo" onClick={() => void pesquisarCentros()}>Pesquisar</button>
          {centrosVazios && (
            <>
              <p>Nenhum cadastro disponível para seleção. Consulte a área responsável.</p>
              <label htmlFor="centro-codigo">Código</label>
              <input id="centro-codigo" value={centroNovo.codigo} onChange={(evento) => setCentroNovo({ ...centroNovo, codigo: evento.target.value })} />
              <label htmlFor="centro-nome">Centro de custo</label>
              <input id="centro-nome" value={centroNovo.nome} onChange={(evento) => setCentroNovo({ ...centroNovo, nome: evento.target.value })} />
              <label htmlFor="centro-motivo">Motivo da alteração</label>
              <textarea id="centro-motivo" value={centroNovo.justificativa} onChange={(evento) => setCentroNovo({ ...centroNovo, justificativa: evento.target.value })} />
              <button type="button" onClick={() => void criarCentro()}>+ Novo registro</button>
            </>
          )}
          <label htmlFor="conta-codigo">Código</label>
          <input id="conta-codigo" value={form.codigo} readOnly={drawer === 'editar'} onChange={(evento) => setForm({ ...form, codigo: evento.target.value })} />
          <label htmlFor="conta-nome">Conta contábil</label>
          <input id="conta-nome" placeholder="Informe conta contábil" value={form.nome} onChange={(evento) => setForm({ ...form, nome: evento.target.value })} />
          <label htmlFor="conta-classe">Conta sintética/analítica</label>
          <select id="conta-classe" value={form.classificacao} onChange={(evento) => setForm({ ...form, classificacao: evento.target.value as Formulario['classificacao'] })}>
            <option value="sintetica">sintética</option>
            <option value="analitica">analítica</option>
          </select>
          <label htmlFor="conta-natureza">Natureza da conta</label>
          <select id="conta-natureza" value={form.natureza} onChange={(evento) => setForm({ ...form, natureza: evento.target.value as Formulario['natureza'] })}>
            {NATUREZAS.map(([valor, rotulo]) => <option key={valor} value={valor}>{rotulo}</option>)}
          </select>
          <label htmlFor="conta-grupo">Grupo</label>
          <input id="conta-grupo" value={form.grupo} onChange={(evento) => setForm({ ...form, grupo: evento.target.value })} />
          <label htmlFor="conta-pai">Conta contábil</label>
          <div className="flex items-center gap-2">
            <select id="conta-pai" ref={(elemento) => { elemento?.setAttribute('placeholder', 'Selecione conta contábil'); }} value={form.contaPaiCodigo} onChange={(evento) => setForm({ ...form, contaPaiCodigo: evento.target.value })}>
              <option value="">Selecione conta contábil</option>
              {form.contaPaiCodigo && <option value={form.contaPaiCodigo}>{paiRotulo || form.contaPaiCodigo}</option>}
            </select>
            <button type="button" ref={botaoPesquisaPai} aria-label="Pesquisar conta contábil" title="Pesquisar cadastro pelo nome" onClick={abrirPesquisaPai}>Pesquisar</button>
          </div>
          <p>Vinculado a cadastro existente; seleção obrigatória no formulário.</p>
          <label htmlFor="conta-centro">Centro de custo</label>
          <select id="conta-centro" value={form.centroCodigo} onChange={(evento) => setForm({ ...form, centroCodigo: evento.target.value })}>
            <option value="">Selecione</option>
            {centros.map((centro) => <option key={centro.codigo} value={centro.codigo}>{centro.nome}</option>)}
          </select>
          <label htmlFor="conta-inicio">Início de vigência</label>
          <input id="conta-inicio" type="date" value={form.vigenciaInicio} onChange={(evento) => setForm({ ...form, vigenciaInicio: evento.target.value })} />
          <label htmlFor="conta-fim">Fim de vigência</label>
          <input id="conta-fim" type="date" value={form.vigenciaFim} onChange={(evento) => setForm({ ...form, vigenciaFim: evento.target.value })} />
          <label htmlFor="conta-situacao">Situação</label>
          <select id="conta-situacao" disabled value="DRAFT">
            <option value="DRAFT">Rascunho</option>
          </select>
          <label htmlFor="review-justification">Motivo da alteração</label>
          <textarea id="review-justification" value={form.justificativa} onChange={(evento) => setForm({ ...form, justificativa: evento.target.value })} />
          <button type="button" onClick={() => void salvarConta()}>{drawer === 'editar' ? 'Editar versão' : 'Criar'}</button>
          <button type="button" onClick={() => void validar()}>Verificar dados</button>
        </section>
      )}
      {lookupPai && (
        <div
          ref={popupPai}
          role="dialog"
          aria-modal="true"
          aria-label="Selecionar Conta contábil"
          className="fixed inset-0 z-[120] grid place-items-center bg-lookup-scrim p-3.5"
        >
          <div className="w-[min(490px,95vw)] overflow-hidden rounded-[9px] bg-white shadow-lg">
            <div>
              <h2>Selecionar Conta contábil</h2>
              <button type="button" onClick={fecharPesquisaPai}>Fechar</button>
            </div>
            <input
              type="search"
              autoFocus
              placeholder="Pesquisar pelo nome ou descrição"
              aria-label="Pesquisar cadastro"
              value={paiBusca}
              onChange={(evento) => { setPaiBusca(evento.target.value); void carregarPais(evento.target.value); }}
            />
            <div>
              {paisOpcoes.filter((opcao) => !(drawer === 'editar' && opcao.codigo === selecionada?.codigo)).map((opcao) => (
                <button type="button" key={opcao.codigo} onClick={() => escolherPai(opcao)}>
                  <b>{opcao.nome}</b>
                  <small>{opcao.codigo}</small>
                </button>
              ))}
            </div>
            {erroPais && <p role="alert">{erroPais}</p>}
            {paisTruncado && <p>Refine a busca para ver mais contas.</p>}
            <p>A seleção utiliza uma referência interna invisível, nunca digitação de GUID.</p>
          </div>
        </div>
      )}
      {modal && (
        <dialog open aria-modal="true">
          <label htmlFor="action-reason">Justificativa / observação</label>
          <textarea id="action-reason" value={motivo} onChange={(evento) => setMotivo(evento.target.value)} />
          <button type="button" onClick={() => { setModal(null); setAviso(''); }}>Cancelar</button>
          <button type="button" onClick={() => void confirmar()}>Confirmar</button>
          {aviso ? <p>{aviso}</p> : null}
        </dialog>
      )}
      {aviso && !modal ? <p>{aviso}</p> : null}
    </>
  );
}
