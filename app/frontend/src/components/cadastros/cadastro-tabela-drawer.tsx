'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Power, PowerOff, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { mensagemDeErro } from '@/lib/error-message';

export type StatusCadastro = 'ativo' | 'inativo';

export interface ColunaCadastro<T> {
  chave: string;
  titulo: string;
  alinhamento?: 'esquerda' | 'direita';
  render: (registro: T) => React.ReactNode;
}

export interface CampoCadastro {
  nome: string;
  rotulo: string;
  tipo: 'texto' | 'numero' | 'textarea' | 'select';
  obrigatorio?: boolean;
  placeholder?: string;
  colSpan?: 1 | 2;
  opcoes?: Array<{ valor: string; rotulo: string }>;
  monoespacado?: boolean;
}

/** Um `select` da barra de filtros. `''` é a opção neutra e não vai para a query. */
export interface FiltroCadastro {
  nome: string;
  rotuloTodos: string;
  opcoes: Array<{ valor: string; rotulo: string }>;
}

export interface CadastroTabelaDrawerProps<T extends { id: string }> {
  /** Linha de trilha do cabeçalho, como em `produtos-client.tsx:249` ("Cadastros & Regras / Produtos"). */
  caminho: string;
  titulo: string;
  subtitulo: string;
  rotuloNovo: string;
  rotuloSalvar: string;
  tituloDrawerNovo: string;
  tituloDrawerEdicao: (registro: T) => string;
  placeholderBusca: string;
  substantivoSingular: string;
  substantivoPlural: string;
  endpoint: string;
  colunas: ColunaCadastro<T>[];
  campos: CampoCadastro[];
  filtros: FiltroCadastro[];
  larguraDrawer: 460 | 520;
  podeGerenciar: boolean;
  statusDe: (registro: T) => StatusCadastro;
  paraFormulario: (registro: T) => Record<string, string>;
  formularioVazio: Record<string, string>;
  paraPayload: (form: Record<string, string>) => Record<string, unknown>;
  mensagemVazia: string;
  bannerTopo?: React.ReactNode;
  bannerDrawer?: React.ReactNode;
  blocosDrawer?: (registro: T | null) => React.ReactNode;
}

interface Paginado<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

const PAGE_SIZE = 20;

function StatusPillCadastro({ status }: { status: StatusCadastro }) {
  return status === 'ativo' ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-success-surface px-2 py-0.5 text-[11px] font-semibold text-success-strong">
      <span className="size-1.5 rounded-full bg-status-dot-ativo" /> Ativo
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-subtle px-2 py-0.5 text-[11px] font-semibold text-text-secondary">
      <span className="size-1.5 rounded-full bg-text-muted" /> Inativo
    </span>
  );
}

export function CadastroTabelaDrawer<T extends { id: string }>({
  caminho,
  titulo,
  subtitulo,
  rotuloNovo,
  rotuloSalvar,
  tituloDrawerNovo,
  tituloDrawerEdicao,
  placeholderBusca,
  substantivoSingular,
  substantivoPlural,
  endpoint,
  colunas,
  campos,
  filtros,
  larguraDrawer,
  podeGerenciar,
  statusDe,
  paraFormulario,
  formularioVazio,
  paraPayload,
  mensagemVazia,
  bannerTopo,
  bannerDrawer,
  blocosDrawer,
}: CadastroTabelaDrawerProps<T>) {
  const [busca, setBusca] = useState('');
  const [buscaAplicada, setBuscaAplicada] = useState('');
  const [selecao, setSelecao] = useState<Record<string, string>>({});
  const [pagina, setPagina] = useState(1);
  const [resultado, setResultado] = useState<Paginado<T> | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [drawerAberto, setDrawerAberto] = useState(false);
  const [editando, setEditando] = useState<T | null>(null);
  const [form, setForm] = useState<Record<string, string>>(formularioVazio);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setBuscaAplicada(busca.trim());
      setPagina(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [busca]);

  /** Chave estável dos filtros: entra na dependência do `carregar` sem recriar o objeto. */
  const filtrosQuery = useMemo(
    () =>
      filtros
        .map((filtro) => [filtro.nome, selecao[filtro.nome] ?? ''] as const)
        .filter(([, valor]) => valor !== ''),
    [filtros, selecao],
  );
  const filtrosChave = filtrosQuery.map(([nome, valor]) => `${nome}=${valor}`).join('&');

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const params = new URLSearchParams({ page: String(pagina), pageSize: String(PAGE_SIZE) });
      if (buscaAplicada) params.set('search', buscaAplicada);
      for (const par of filtrosChave.split('&').filter(Boolean)) {
        const [nome, valor] = par.split('=');
        if (nome && valor) params.set(nome, valor);
      }
      const res = await fetch(`${endpoint}?${params.toString()}`, { cache: 'no-store' });
      if (!res.ok) {
        setErro(await mensagemDeErro(res));
        return;
      }
      setResultado((await res.json()) as Paginado<T>);
    } catch {
      setErro('Erro de conexão com o servidor.');
    } finally {
      setCarregando(false);
    }
  }, [endpoint, pagina, buscaAplicada, filtrosChave]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const abrirNovo = () => {
    setEditando(null);
    setForm({ ...formularioVazio });
    setDrawerAberto(true);
  };

  const abrirEdicao = (registro: T) => {
    setEditando(registro);
    setForm(paraFormulario(registro));
    setDrawerAberto(true);
  };

  const fechar = () => {
    setDrawerAberto(false);
    setEditando(null);
  };

  const faltando = useMemo(
    () => campos.filter((c) => c.obrigatorio && String(form[c.nome] ?? '').trim() === ''),
    [campos, form],
  );

  const salvar = async () => {
    if (faltando.length > 0) {
      toast.error(`Preencha: ${faltando.map((c) => c.rotulo).join(', ')}`);
      return;
    }
    setSalvando(true);
    try {
      const res = await fetch(editando ? `${endpoint}/${editando.id}` : endpoint, {
        method: editando ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paraPayload(form)),
      });
      if (!res.ok) {
        toast.error(await mensagemDeErro(res));
        return;
      }
      toast.success(editando ? 'Registro atualizado.' : 'Registro criado.');
      fechar();
      await carregar();
    } catch {
      toast.error('Erro de conexão com o servidor.');
    } finally {
      setSalvando(false);
    }
  };

  /**
   * Protótipo: a única ação destrutiva da linha é alternar o status (`Power`/`PowerOff`).
   * Não existe exclusão nestas telas; o soft delete continua acessível apenas pela API.
   */
  const alternarStatus = async (registro: T) => {
    const novo: StatusCadastro = statusDe(registro) === 'ativo' ? 'inativo' : 'ativo';
    try {
      const res = await fetch(`${endpoint}/${registro.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: novo }),
      });
      if (!res.ok) {
        toast.error(await mensagemDeErro(res));
        return;
      }
      toast.success(novo === 'ativo' ? 'Registro ativado.' : 'Registro inativado.');
      await carregar();
    } catch {
      toast.error('Erro de conexão com o servidor.');
    }
  };

  const total = resultado?.total ?? 0;
  const linhas = resultado?.data ?? [];
  const colunasTotal = colunas.length + 1 + (podeGerenciar ? 1 : 0);
  const classeDrawer = larguraDrawer === 520 ? 'w-[520px]' : 'w-[460px]';

  return (
    <div className="flex h-full flex-col gap-5">
      {/* Cabeçalho — Caminhoes.tsx:159-171 */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="mb-0.5 text-[11px] font-medium text-text-muted">{caminho}</p>
          <h1 className="text-[20px] font-bold text-text-strong">{titulo}</h1>
          <p className="mt-0.5 text-[12px] text-text-secondary">{subtitulo}</p>
        </div>
        {podeGerenciar && (
          <button
            type="button"
            onClick={abrirNovo}
            className="flex h-8 flex-shrink-0 items-center gap-1.5 rounded-md bg-brand-navy-deep px-4 text-[13px] font-semibold text-white transition-colors hover:bg-action-blue"
          >
            <Plus className="size-3.5" /> {rotuloNovo}
          </button>
        )}
      </div>

      {bannerTopo}

      {/* Barra de filtros — Caminhoes.tsx:174-190 / Representantes.tsx:264-284 */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            aria-label={placeholderBusca}
            placeholder={placeholderBusca}
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="h-8 w-full rounded-md border border-border bg-card pr-3 pl-8 text-[13px] text-text-strong placeholder:text-placeholder focus:border-action-blue focus:outline-none"
          />
        </div>
        {filtros.map((filtro) => (
          <select
            key={filtro.nome}
            aria-label={filtro.rotuloTodos}
            value={selecao[filtro.nome] ?? ''}
            onChange={(e) => {
              const valor = e.target.value;
              setSelecao((s) => ({ ...s, [filtro.nome]: valor }));
              setPagina(1);
            }}
            className="h-8 rounded-md border border-border bg-card px-2.5 text-[13px] text-text-slate focus:border-action-blue focus:outline-none"
          >
            <option value="">{filtro.rotuloTodos}</option>
            {filtro.opcoes.map((opcao) => (
              <option key={opcao.valor} value={opcao.valor}>
                {opcao.rotulo}
              </option>
            ))}
          </select>
        ))}
        <span className="ml-auto text-[12px] text-text-muted">
          {total} {total === 1 ? substantivoSingular : substantivoPlural}
        </span>
      </div>

      {erro && (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-[13px] text-destructive">
          {erro}
        </p>
      )}

      {/* Tabela — Caminhoes.tsx:193-242 */}
      <div className="flex-1 overflow-hidden rounded-xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-muted bg-surface-subtle">
                {colunas.map((coluna) => (
                  <th
                    key={coluna.chave}
                    className={`px-4 py-2.5 text-[10px] font-bold tracking-wider whitespace-nowrap text-text-secondary uppercase ${
                      coluna.alinhamento === 'direita' ? 'text-right' : 'text-left'
                    }`}
                  >
                    {coluna.titulo}
                  </th>
                ))}
                <th className="px-4 py-2.5 text-left text-[10px] font-bold tracking-wider whitespace-nowrap text-text-secondary uppercase">
                  Status
                </th>
                {podeGerenciar && (
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold tracking-wider whitespace-nowrap text-text-secondary uppercase">
                    Ações
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {carregando && (
                <tr>
                  <td colSpan={colunasTotal} className="px-4 py-12 text-center text-[13px] text-text-muted">
                    Carregando…
                  </td>
                </tr>
              )}
              {!carregando && linhas.length === 0 && (
                <tr>
                  <td colSpan={colunasTotal} className="px-4 py-12 text-center text-[13px] text-text-muted">
                    {mensagemVazia}
                  </td>
                </tr>
              )}
              {!carregando &&
                linhas.map((registro, i) => (
                  <tr
                    key={registro.id}
                    onClick={() => abrirEdicao(registro)}
                    className={`cursor-pointer border-b border-surface-subtle transition-colors hover:bg-table-row-hover ${
                      i % 2 !== 0 ? 'bg-table-zebra' : ''
                    }`}
                  >
                    {colunas.map((coluna) => (
                      <td
                        key={coluna.chave}
                        className={`px-4 py-2.5 ${coluna.alinhamento === 'direita' ? 'text-right' : ''}`}
                      >
                        {coluna.render(registro)}
                      </td>
                    ))}
                    <td className="px-4 py-2.5">
                      <StatusPillCadastro status={statusDe(registro)} />
                    </td>
                    {podeGerenciar && (
                      <td className="px-4 py-2.5" onClick={(ev) => ev.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            title="Editar"
                            aria-label="Editar"
                            onClick={() => abrirEdicao(registro)}
                            className="flex size-7 items-center justify-center rounded text-text-muted transition-colors hover:bg-muted hover:text-text-slate"
                          >
                            <Pencil className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            title={statusDe(registro) === 'ativo' ? 'Inativar' : 'Ativar'}
                            aria-label={statusDe(registro) === 'ativo' ? 'Inativar' : 'Ativar'}
                            onClick={() => void alternarStatus(registro)}
                            className={`flex size-7 items-center justify-center rounded text-text-muted transition-colors ${
                              statusDe(registro) === 'ativo'
                                ? 'hover:bg-danger-surface hover:text-danger-rose'
                                : 'hover:bg-success-surface hover:text-success-strong'
                            }`}
                          >
                            {statusDe(registro) === 'ativo' ? (
                              <PowerOff className="size-3.5" />
                            ) : (
                              <Power className="size-3.5" />
                            )}
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* D41.a — só aparece quando a paginação do backend passa a existir de fato */}
      {total > PAGE_SIZE && (
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            disabled={pagina <= 1}
            onClick={() => setPagina((p) => p - 1)}
            className="h-8 rounded-md border border-border px-3 text-[13px] font-medium text-text-secondary transition-colors hover:bg-surface-subtle disabled:opacity-50"
          >
            Anterior
          </button>
          <button
            type="button"
            disabled={pagina * PAGE_SIZE >= total}
            onClick={() => setPagina((p) => p + 1)}
            className="h-8 rounded-md border border-border px-3 text-[13px] font-medium text-text-secondary transition-colors hover:bg-surface-subtle disabled:opacity-50"
          >
            Próxima
          </button>
        </div>
      )}

      {/* Drawer — Caminhoes.tsx:55-126 / Representantes.tsx:90-207 */}
      <Sheet open={drawerAberto} onOpenChange={(aberto) => { if (!aberto) fechar(); }}>
        <SheetContent
          side="right"
          className={`${classeDrawer} flex max-w-full flex-col border-l border-border bg-card p-0 sm:max-w-full`}
        >
          <SheetHeader className="flex-shrink-0 border-b border-border px-6 py-4">
            <SheetTitle className="text-[16px] font-bold text-text-strong">
              {editando ? tituloDrawerEdicao(editando) : tituloDrawerNovo}
            </SheetTitle>
          </SheetHeader>

          <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-6">
            {bannerDrawer}

            {campos.map((campo) => (
              <div key={campo.nome} className="flex flex-col gap-1">
                <label htmlFor={campo.nome} className="text-[12px] font-semibold text-text-graphite">
                  {campo.rotulo}
                  {campo.obrigatorio && <span className="ml-1 text-destructive">*</span>}
                </label>

                {campo.tipo === 'textarea' && (
                  <textarea
                    id={campo.nome}
                    rows={3}
                    value={form[campo.nome] ?? ''}
                    placeholder={campo.placeholder}
                    onChange={(e) => setForm((f) => ({ ...f, [campo.nome]: e.target.value }))}
                    className="w-full resize-none rounded-md border border-border bg-card px-2.5 py-2 text-[13px] text-text-strong placeholder:text-placeholder focus:border-action-blue focus:outline-none"
                  />
                )}

                {campo.tipo === 'select' && (
                  <select
                    id={campo.nome}
                    value={form[campo.nome] ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, [campo.nome]: e.target.value }))}
                    className="h-8 w-full rounded-md border border-border bg-card px-2.5 text-[13px] text-text-strong focus:border-action-blue focus:outline-none"
                  >
                    {campo.placeholder && <option value="">{campo.placeholder}</option>}
                    {(campo.opcoes ?? []).map((opcao) => (
                      <option key={opcao.valor} value={opcao.valor}>
                        {opcao.rotulo}
                      </option>
                    ))}
                  </select>
                )}

                {(campo.tipo === 'texto' || campo.tipo === 'numero') && (
                  <input
                    id={campo.nome}
                    type={campo.tipo === 'numero' ? 'number' : 'text'}
                    value={form[campo.nome] ?? ''}
                    placeholder={campo.placeholder}
                    onChange={(e) => setForm((f) => ({ ...f, [campo.nome]: e.target.value }))}
                    className={`h-8 w-full rounded-md border border-border bg-card px-2.5 text-[13px] text-text-strong placeholder:text-placeholder focus:border-action-blue focus:outline-none ${
                      campo.monoespacado ? 'font-mono' : ''
                    }`}
                  />
                )}
              </div>
            ))}

            {/* Status é do componente, não da grade de campos — Representantes.tsx:142-155 */}
            <div className="flex items-center justify-between border-t border-b border-muted py-2.5">
              <span className="text-[13px] font-medium text-text-strong">Status</span>
              <Switch
                aria-label="Status"
                checked={form.status === 'ativo'}
                onCheckedChange={(v) => setForm((f) => ({ ...f, status: v ? 'ativo' : 'inativo' }))}
              />
            </div>

            {blocosDrawer?.(editando)}
          </div>

          <div className="flex flex-shrink-0 items-center justify-end gap-3 border-t border-border bg-card px-6 py-4">
            <button
              type="button"
              onClick={fechar}
              className="h-8 rounded-md border border-border px-4 text-[13px] font-medium text-text-secondary transition-colors hover:bg-surface-subtle"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void salvar()}
              disabled={salvando}
              className="h-8 rounded-md bg-brand-navy-deep px-5 text-[13px] font-semibold text-white transition-colors hover:bg-action-blue disabled:opacity-60"
            >
              {salvando ? 'Salvando…' : rotuloSalvar}
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
