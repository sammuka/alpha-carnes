'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Pagination, PaginationContent, PaginationItem, PaginationLink } from '@/components/ui/pagination';
import { BadgeProvisorio } from '@/components/ui/badge-provisorio';

const CHAVE_RASCUNHO = 'politicas-de-contabilizacao';
const POR_PAGINA = 20; // mesmo valor de PAGINA em politicas.service.ts
const ABAS = ['Ficha e campos', 'Movimentações', 'Regras e validações', 'Exceções', 'Histórico', 'Integrações', 'Aceite e testes'] as const;
const EXCECOES = ['Mapeamento ausente', 'Evento duplicado'];
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

interface Opcao { codigo: string; nome: string }
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

function valorApi(texto: string): string {
  const casado = /^(\d{1,13}),(\d{2})$/.exec(texto.trim());
  return casado ? `${casado[1]}.${casado[2]}` : '';
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
  semAcesso = false,
}: {
  inicial: PoliticaApresentada[];
  totalInicial?: number;
  semAcesso?: boolean;
}) {
  const [marcadas, setMarcadas] = useState<string[]>([]);
  const [linhas, setLinhas] = useState(inicial);
  const [modal, setModal] = useState<'simular' | 'aprovar' | null>(null);
  const [drawer, setDrawer] = useState<'criar' | 'editar' | 'processo' | null>(null);
  const [aba, setAba] = useState<(typeof ABAS)[number]>('Ficha e campos');
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
  const [enviando, setEnviando] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [total, setTotal] = useState(totalInicial);
  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const sequenciaModal = useRef(0);

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

  useEffect(() => {
    const consulta = new URLSearchParams({
      pagina: String(pagina), q: busca, competencia: filtroCompetencia, situacao: filtroSituacao, ordenar, direcao,
    }).toString();
    // Compara com a última consulta feita (inicialmente, a da lista que o servidor entregou): não consulta ao montar
    // nem na segunda montagem simulada do StrictMode, e consulta uma vez só depois da restauração do sessionStorage.
    if (consulta === ultimaConsulta.current) return;
    ultimaConsulta.current = consulta;
    sequenciaLista.current += 1;
    const minha = sequenciaLista.current;
    void (async () => {
      try {
        const resposta = await fetch(`/api/contabilidade/politicas?${consulta}`);
        if (minha !== sequenciaLista.current) return;
        if (!resposta.ok) {
          setAviso(await lerMensagem(resposta));
          return;
        }
        const corpo = await lerCorpo(resposta) as { itens?: PoliticaApresentada[]; total?: number } | null;
        if (minha !== sequenciaLista.current) return;
        if (!corpo || !Array.isArray(corpo.itens)) {
          setAviso(NAO_CONFIRMADO);
          return;
        }
        const novoTotal = typeof corpo.total === 'number' ? corpo.total : corpo.itens.length;
        setLinhas(corpo.itens);
        setTotal(novoTotal);
        setMarcadas([]);
        setAviso('');
        const ultima = Math.max(1, Math.ceil(novoTotal / POR_PAGINA));
        if (pagina > ultima) setPagina(ultima);
      } catch {
        if (minha === sequenciaLista.current) setAviso('Não foi possível atualizar a lista. Tente novamente.');
      }
    })();
  }, [busca, filtroCompetencia, filtroSituacao, ordenar, direcao, pagina]);
  // ponytail: uma requisição por tecla, sem debounce; a guarda de sequência descarta resposta antiga. Adicionar debounce de 250 ms se o servidor sentir.

  if (semAcesso) {
    return (
      <>
        <h1>Políticas de contabilização</h1>
        <p>Acesso não permitido</p>
      </>
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
      setAviso('Nenhum cadastro disponível para seleção. Consulte a área responsável.');
    }
  }

  function abrirCriar() {
    setForm(FORM_VAZIO);
    setSalvo(JSON.stringify(FORM_VAZIO));
    setDrawer('criar');
    void carregarOpcoes();
  }

  function abrirEditar() {
    if (!selecionada) return;
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
    const atual = alvo();
    if (!atual && marcadas.length <= 1) {
      setAviso('Selecione uma política na lista.');
      return;
    }
    const valor = valorApi(valorTexto);
    if (!justificativaModal.trim()) {
      setAviso('Informe justificativa para demonstrar a decisão auditável.');
      return;
    }
    if (acao === 'simular' && !valor) {
      setAviso('Valor é obrigatório.');
      return;
    }
    if (acao === 'simular' && /^0+\.00$/.test(valor)) {
      setAviso('Valor deve ser maior que zero.');
      return;
    }
    const emLote = marcadas.length > 1;
    const token = sequenciaModal.current;
    setEnviando(true);
    try {
      const resposta = emLote
        ? await fetch('/api/contabilidade/politicas/lote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            acao,
            codigos: marcadas,
            justificativa: justificativaModal,
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
            ? { numero: atual!.numero, valor, justificativa: justificativaModal }
            : { numero: atual!.numero, justificativa: justificativaModal }),
        });
      if (!resposta.ok) {
        setAviso(await lerMensagem(resposta));
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
      setEnviando(false);
    }
  }

  async function gravar() {
    if (!form.justificativa.trim()) {
      setAviso('Informe justificativa para demonstrar a decisão auditável.');
      return;
    }
    const criando = drawer !== 'editar';
    if (!criando && !selecionada) return;
    const resposta = criando
      ? await fetch('/api/contabilidade/politicas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      : await fetch(`/api/contabilidade/politicas/${encodeURIComponent(selecionada!.codigo)}/editar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, numero: selecionada!.numero }),
      });
    if (!resposta.ok) {
      setAviso(await lerMensagem(resposta));
      return;
    }
    const gravada = await resposta.json() as PoliticaApresentada;
    setLinhas((lista) => [gravada, ...lista.filter((linha) => linha.codigo !== gravada.codigo)]);
    setCodigoSelecionado(gravada.codigo);
    setSalvo(JSON.stringify(form));
    setDrawer(null);
    setAviso('');
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

  async function abrirHistorico(nome: (typeof ABAS)[number]) {
    setAba(nome);
    if (!selecionada || (nome !== 'Histórico' && nome !== 'Movimentações')) return;
    const resposta = await fetch(`/api/contabilidade/politicas/${encodeURIComponent(selecionada.codigo)}/historico`);
    if (!resposta.ok) {
      setAviso(await lerMensagem(resposta));
      return;
    }
    setHistorico(await resposta.json() as HistoricoLinha[]);
  }

  function voltar() {
    if (JSON.stringify(form) !== salvo && !window.confirm('Há alterações não salvas. Deseja sair?')) return;
    setDrawer(null);
  }

  function ordenarPor(campo: string) {
    const proxima = ordenar === campo && direcao === 'asc' ? 'desc' : 'asc';
    setOrdenar(campo);
    setDirecao(proxima);
    setPagina(1);
  }

  const contasVisiveis = contas.filter((conta) => conta.nome.toLowerCase().includes(busca.toLowerCase()) || !busca);
  const centrosVisiveis = centros.filter((centro) => centro.nome.toLowerCase().includes(busca.toLowerCase()) || !busca);

  return (
    <>
      <style>{`
        .politicas-cartoes { display: none; }
        @media (max-width: 800px) {
          .politicas-grade { display: none; }
          .politicas-cartoes { display: grid; gap: 12px; }
        }
      `}</style>
      <h1>Políticas de contabilização</h1>
      <p>Acesso típico: contador <BadgeProvisorio texto="Provisório" /></p>
      <Button type="button" variant="secondary" onClick={() => void exportar()}>Exportar</Button>
      <Button type="button" variant="secondary" onClick={abrirCriar}>+ Novo registro</Button>
      <Button type="button" onClick={abrirCriar}>Configurar mappings</Button>
      <Button type="button" variant="secondary" onClick={() => abrirModal('simular')}>Simular evento</Button>
      <Button type="button" variant="secondary" onClick={() => abrirModal('aprovar')}>Aprovar regra</Button>
      <Button type="button" variant="secondary" onClick={() => setDrawer('processo')}>Ações do processo</Button>
      <Button type="button" variant="secondary" onClick={voltar}>Voltar</Button>
      <div>
        <input aria-label="Buscar registros da lista" placeholder="Pesquisar descrição ou referência de negócio" value={busca} onChange={(evento) => { setBusca(evento.target.value); setPagina(1); }} />
        <input aria-label="Filtrar competência" type="month" value={filtroCompetencia} onChange={(evento) => { setFiltroCompetencia(evento.target.value); setPagina(1); }} />
        <select aria-label="Filtrar situação" value={filtroSituacao} onChange={(evento) => { setFiltroSituacao(evento.target.value); setPagina(1); }}>
          {SITUACOES.map(([valor, rotulo]) => <option key={rotulo} value={valor}>{rotulo}</option>)}
        </select>
        <Button type="button" variant="secondary" onClick={() => void exportar()}>Exportar visão</Button>
      </div>
      {aviso ? <p role="status">{aviso}</p> : null}
      <div className="politicas-grade">
        <table>
          <thead>
            <tr>
              <th><span className="sr-only">Selecionar</span></th>
              {COLUNAS.map((coluna) => (
                <th key={coluna.rotulo}>
                  {coluna.ordenar
                    ? <button type="button" aria-label={`Ordenar por ${coluna.rotulo}`} onClick={() => ordenarPor(coluna.ordenar!)}>{coluna.rotulo}</button>
                    : coluna.rotulo}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.length === 0 ? (
              <tr>
                <td colSpan={7}>Nenhum resultado para o período, filtro ou situação escolhidos. Limpe os filtros ou cadastre um novo registro.</td>
              </tr>
            ) : linhas.map((linha) => (
              <tr key={linha.codigo} onClick={() => setCodigoSelecionado(linha.codigo)}>
                <td>
                  <input
                    type="checkbox"
                    aria-label={`Selecionar ${linha.tipoEventoRotulo}`}
                    checked={marcadas.includes(linha.codigo)}
                    onChange={() => alternar(linha.codigo)}
                  />
                </td>
                {COLUNAS.map((coluna) => <td key={coluna.rotulo}>{celula(linha, coluna.rotulo)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="politicas-cartoes" hidden>
        {linhas.map((linha) => (
          <article key={linha.codigo}>
            <input
              type="checkbox"
              aria-label={`Selecionar ${linha.tipoEventoRotulo}`}
              checked={marcadas.includes(linha.codigo)}
              onChange={() => alternar(linha.codigo)}
            />
            {COLUNAS.map((coluna) => (
              <p key={coluna.rotulo}><b>{coluna.rotulo}</b> {celula(linha, coluna.rotulo)}</p>
            ))}
          </article>
        ))}
      </div>
      <p>Exibindo {linhas.length} de {total}</p>
      <Pagination aria-label="Paginação da lista">
        <PaginationContent>
          <PaginationItem>
            <PaginationLink
              href="#"
              size="default"
              aria-label="Página anterior"
              aria-disabled={pagina <= 1}
              onClick={(evento) => { evento.preventDefault(); if (pagina > 1) setPagina(pagina - 1); }}
            >Anterior</PaginationLink>
          </PaginationItem>
          <PaginationItem><span>Página {pagina} de {totalPaginas}</span></PaginationItem>
          <PaginationItem>
            <PaginationLink
              href="#"
              size="default"
              aria-label="Próxima página"
              aria-disabled={pagina >= totalPaginas}
              onClick={(evento) => { evento.preventDefault(); if (pagina < totalPaginas) setPagina(pagina + 1); }}
            >Próxima</PaginationLink>
          </PaginationItem>
        </PaginationContent>
      </Pagination>
      <div role="tablist">
        {ABAS.map((nome) => (
          <button key={nome} type="button" role="tab" aria-selected={aba === nome} onClick={() => void abrirHistorico(nome)}>{nome}</button>
        ))}
      </div>
      {aba === 'Ficha e campos' && selecionada ? (
        <section>
          <p>Versão {selecionada.numero}</p>
          <p>Competência {selecionada.competenciaRotulo}</p>
          <p>Conta de débito {selecionada.contaDebitoNome}</p>
          <p>Conta de crédito {selecionada.contaCreditoNome}</p>
          <p>Centro de custo {selecionada.centroNome}</p>
          <p>Tipo de ocorrência {selecionada.tipoEventoRotulo}</p>
          <p>Início de vigência {dataBr(selecionada.vigenciaInicio)}</p>
          <p>Situação {selecionada.situacaoRotulo}</p>
          <p>Empresa —</p>
          <p>Responsável {selecionada.responsavelNome}</p>
          <p>Vinculado a cadastro existente; seleção obrigatória no formulário.</p>
          <p>Valor pertencente ao conjunto de opções do domínio.</p>
          <Button type="button" variant="secondary" onClick={abrirEditar}>Editar versão</Button>
          <Button type="button" variant="secondary" onClick={() => void abrirHistorico('Histórico')}>Consultar histórico</Button>
          <Button type="button" variant="secondary" onClick={() => void validar()}>Validar pré-condições</Button>
        </section>
      ) : null}
      {aba === 'Movimentações' ? (
        <table>
          <thead>
            <tr><th>Acontecimento</th><th>Origem</th><th>Efeito</th><th>Situação</th></tr>
          </thead>
          <tbody>
            {historico.map((evento) => (
              <tr key={`${evento.quando}-${evento.acontecimento}`}>
                <td>{evento.acontecimento}</td>
                <td>{evento.quem}</td>
                <td>{evento.justificativa}</td>
                <td>{selecionada?.situacaoRotulo}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      {aba === 'Regras e validações' ? <p>origem imutável, não lançar sem mapeamento correto, balanceamento exato</p> : null}
      {aba === 'Exceções' ? EXCECOES.map((item) => <p key={item}><b>Bloqueio / exceção:</b> {item}.</p>) : null}
      {aba === 'Histórico' ? (
        <ul>
          {historico.map((evento) => (
            <li key={`${evento.quando}-${evento.acontecimento}`}>
              {evento.acontecimento} {dataBr(evento.quando)} {evento.quem}
            </li>
          ))}
        </ul>
      ) : null}
      {aba === 'Integrações' ? <p>Esta tela não chama serviço externo.</p> : null}
      {aba === 'Aceite e testes' ? (
        <ul>
          {ACEITE.map((item) => <li key={item}>{item}</li>)}
        </ul>
      ) : null}
      <p>Enquadramento fiscal</p>
      <p>—</p>

      {drawer === 'criar' || drawer === 'editar' ? (
        <section>
          <h2>Dados principais</h2>
          <label>
            Conta de débito
            <select aria-label="Conta de débito" value={form.contaDebitoCodigo} onChange={(evento) => setForm({ ...form, contaDebitoCodigo: evento.target.value })}>
              <option value="">Selecione conta de débito</option>
              {contasVisiveis.map((conta) => <option key={conta.codigo} value={conta.codigo}>{conta.nome}</option>)}
            </select>
          </label>
          <label>
            Conta de crédito
            <select aria-label="Conta de crédito" value={form.contaCreditoCodigo} onChange={(evento) => setForm({ ...form, contaCreditoCodigo: evento.target.value })}>
              <option value="">Selecione conta de crédito</option>
              {contasVisiveis.map((conta) => <option key={conta.codigo} value={conta.codigo}>{conta.nome}</option>)}
            </select>
          </label>
          <label>
            Centro de custo
            <select aria-label="Centro de custo" value={form.centroCodigo} onChange={(evento) => setForm({ ...form, centroCodigo: evento.target.value })}>
              <option value="">Selecione centro de custo</option>
              {centrosVisiveis.map((centro) => <option key={centro.codigo} value={centro.codigo}>{centro.nome}</option>)}
            </select>
          </label>
          <p>Seleção vinculada ao cadastro; sem digitar identificadores.</p>
          <Button type="button" variant="secondary" onClick={() => {
            if (contas.length === 0 && centros.length === 0) {
              setAviso('Nenhum cadastro disponível para seleção. Consulte a área responsável.');
            }
          }}>Pesquisar</Button>
          <label>
            Tipo de ocorrência
            <select aria-label="Tipo de ocorrência" value={form.tipoEvento} disabled={drawer === 'editar'} onChange={(evento) => setForm({ ...form, tipoEvento: evento.target.value })}>
              <option value="">Selecione tipo de ocorrência</option>
              {TIPOS.map(([valor, rotulo]) => <option key={rotulo} value={valor}>{rotulo}</option>)}
            </select>
          </label>
          <label>
            Competência
            <input aria-label="Competência" type="month" required value={form.competencia} disabled={drawer === 'editar'} onChange={(evento) => setForm({ ...form, competencia: evento.target.value })} />
          </label>
          <label>
            Enquadramento fiscal
            <select aria-label="Enquadramento fiscal" disabled value="">
              <option value="">—</option>
            </select>
            <BadgeProvisorio texto="Provisório" />
          </label>
          <label>
            Início de vigência
            <input aria-label="Início de vigência" type="date" required value={form.vigenciaInicio} onChange={(evento) => setForm({ ...form, vigenciaInicio: evento.target.value })} />
          </label>
          <label>
            Situação
            <select aria-label="Situação" disabled value="DRAFT">
              <option value="DRAFT">Rascunho</option>
            </select>
          </label>
          <label>
            Justificativa auditável
            <textarea aria-label="Justificativa auditável" value={form.justificativa} onChange={(evento) => setForm({ ...form, justificativa: evento.target.value })} />
          </label>
          <Button type="button" variant="secondary" onClick={() => void validar()}>Verificar dados</Button>
          <Button type="button" onClick={() => void gravar()}>Configurar mappings</Button>
        </section>
      ) : null}

      {drawer === 'processo' ? (
        <section>
          <h2>Ações do processo</h2>
          <Button type="button" onClick={abrirCriar}>Configurar mappings</Button>
          <Button type="button" variant="secondary" onClick={() => abrirModal('simular')}>Simular evento</Button>
          <Button type="button" variant="secondary" onClick={() => abrirModal('aprovar')}>Aprovar regra</Button>
          <Button type="button" variant="secondary" onClick={() => setAba('Ficha e campos')}>Abrir decisão →</Button>
        </section>
      ) : null}

      {modal ? (
        <section>
          <label>
            Justificativa / observação
            <textarea aria-label="Justificativa / observação" value={justificativaModal} onChange={(evento) => setJustificativaModal(evento.target.value)} />
          </label>
          {modal === 'simular' ? (
            <label>
              Valor
              <input aria-label="Valor" value={valorTexto} onChange={(evento) => setValorTexto(evento.target.value)} />
            </label>
          ) : null}
          <Button type="button" disabled={enviando} onClick={() => void confirmarLoteOuAcao(modal)}>Confirmar</Button>
        </section>
      ) : null}
    </>
  );
}
