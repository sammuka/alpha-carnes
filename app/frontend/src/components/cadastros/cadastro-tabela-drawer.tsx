'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Power, PowerOff, Search } from 'lucide-react';
import { toast } from 'sonner';
import { ComboboxField } from '@/components/ui/combobox-field';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { SelectNative } from '@/components/ui/select-native';
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { StatusPill } from '@/components/ui/status-pill';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableCellCode,
  TableCellNum,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { mensagemDeErro } from '@/lib/error-message';
import { useErrosPorCampo } from '@/lib/use-erros-campo';

export type StatusCadastro = 'ativo' | 'inativo';

export interface ColunaCadastro<T> {
  chave: string;
  titulo: string;
  alinhamento?: 'esquerda' | 'direita';
  /** Célula tipo `mono`/`numero`/`pill` aplica a formatação R2/R10 correspondente. */
  tipo?: 'mono' | 'numero' | 'pill';
  render: (registro: T) => React.ReactNode;
}

export interface CampoCadastro {
  nome: string;
  rotulo: string;
  tipo: 'texto' | 'numero' | 'textarea' | 'select' | 'data' | 'combobox';
  obrigatorio?: boolean;
  placeholder?: string;
  colSpan?: 1 | 2;
  opcoes?: Array<{ valor: string; rotulo: string }>;
  monoespacado?: boolean;
  /** Reformata o valor a cada digitação (ex.: mascararPlaca). Nunca bloqueia colar. */
  mascara?: (valor: string) => string;
  /** Limite físico de digitação — copiar do `.max(N)` do DTO do backend. */
  maxLength?: number;
}

/** Um `select` da barra de filtros. `''` é a opção neutra e não vai para a query. */
export interface FiltroCadastro {
  nome: string;
  rotuloTodos: string;
  opcoes: Array<{ valor: string; rotulo: string }>;
}

export interface CadastroTabelaDrawerProps<T extends { id: string }> {
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

export function CadastroTabelaDrawer<T extends { id: string }>({
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
  const { erros, setErros, limparCampo, limparTudo } = useErrosPorCampo();

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
    limparTudo();
    setEditando(null);
    setForm({ ...formularioVazio });
    setDrawerAberto(true);
  };

  const abrirEdicao = (registro: T) => {
    limparTudo();
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
      setErros(Object.fromEntries(faltando.map((c) => [c.nome, 'Campo obrigatório.'])));
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
      if (!res.ok) throw new Error(await mensagemDeErro(res, `Falha ao salvar ${substantivoSingular}`));
      toast.success(editando ? 'Registro atualizado.' : 'Registro criado.');
      fechar();
      await carregar();
    } catch (falha) {
      toast.error(falha instanceof Error ? falha.message : 'Erro de conexão com o servidor.');
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
  const classeDrawer = larguraDrawer === 520 ? 'sm:max-w-[520px]' : 'sm:max-w-[460px]';

  function celula(coluna: ColunaCadastro<T>, registro: T) {
    const conteudo = coluna.render(registro);
    if (coluna.tipo === 'mono') return <TableCellCode key={coluna.chave}>{conteudo}</TableCellCode>;
    if (coluna.tipo === 'numero') return <TableCellNum key={coluna.chave}>{conteudo}</TableCellNum>;
    return (
      <TableCell key={coluna.chave} className={coluna.alinhamento === 'direita' ? 'text-right' : undefined}>
        {conteudo}
      </TableCell>
    );
  }

  return (
    <div className="space-y-3">
      {/* Cabeçalho — Caminhoes.tsx:159-171 */}
      <PageHeader title={titulo} subtitle={subtitulo}>
        {podeGerenciar && (
          <Button type="button" onClick={abrirNovo}>
            <Plus /> {rotuloNovo}
          </Button>
        )}
      </PageHeader>

      {bannerTopo}

      {erro && (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-[13px] text-destructive">
          {erro}
        </p>
      )}

      <div className="flex flex-col rounded-lg border border-border bg-card text-card-foreground shadow-1">
        <div className="flex h-[38px] shrink-0 items-center gap-2 border-b border-border px-3">
          {/* Barra de filtros — R6 */}
          <div className="w-[240px]">
            <Input
              adornLeft={<Search />}
              aria-label={placeholderBusca}
              placeholder={placeholderBusca}
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="h-7 text-xs"
            />
          </div>
          {filtros.map((filtro) => (
            <SelectNative
              key={filtro.nome}
              selectSize="sm"
              className="w-[150px]"
              aria-label={filtro.rotuloTodos}
              value={selecao[filtro.nome] ?? ''}
              onChange={(e) => {
                const valor = e.target.value;
                setSelecao((s) => ({ ...s, [filtro.nome]: valor }));
                setPagina(1);
              }}
            >
              <option value="">{filtro.rotuloTodos}</option>
              {filtro.opcoes.map((opcao) => (
                <option key={opcao.valor} value={opcao.valor}>
                  {opcao.rotulo}
                </option>
              ))}
            </SelectNative>
          ))}
          <span className="ml-auto text-xs text-muted-foreground">
            {total} {total === 1 ? substantivoSingular : substantivoPlural}
          </span>
        </div>

        {/* Tabela — Caminhoes.tsx:193-242 */}
        <div className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {colunas.map((coluna) => (
                  <TableHead
                    key={coluna.chave}
                    className={coluna.alinhamento === 'direita' ? 'text-right' : undefined}
                  >
                    {coluna.titulo}
                  </TableHead>
                ))}
                <TableHead>Status</TableHead>
                {podeGerenciar && <TableHead className="text-right">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {carregando && (
                <TableRow>
                  <TableCell colSpan={colunas.length + 1 + (podeGerenciar ? 1 : 0)} className="h-24 text-center text-muted-foreground">
                    Carregando…
                  </TableCell>
                </TableRow>
              )}
              {!carregando && linhas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={colunas.length + 1 + (podeGerenciar ? 1 : 0)} className="h-24 text-center text-muted-foreground">
                    {mensagemVazia}
                  </TableCell>
                </TableRow>
              )}
              {!carregando &&
                linhas.map((registro) => (
                  <TableRow key={registro.id} className="group cursor-pointer" onClick={() => abrirEdicao(registro)}>
                    {colunas.map((coluna) => celula(coluna, registro))}
                    <TableCell>
                      <StatusPill
                        variant={statusDe(registro) === 'ativo' ? 'expedido' : 'pendente'}
                        label={statusDe(registro) === 'ativo' ? 'Ativo' : 'Inativo'}
                      />
                    </TableCell>
                    {podeGerenciar && (
                      <TableCell onClick={(ev) => ev.stopPropagation()}>
                        <div className="flex justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                          <Button
                            type="button"
                            variant="ghost"
                            size="iconSm"
                            title="Editar"
                            aria-label="Editar"
                            onClick={() => abrirEdicao(registro)}
                          >
                            <Pencil />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="iconSm"
                            title={statusDe(registro) === 'ativo' ? 'Inativar' : 'Ativar'}
                            aria-label={statusDe(registro) === 'ativo' ? 'Inativar' : 'Ativar'}
                            onClick={() => void alternarStatus(registro)}
                          >
                            {statusDe(registro) === 'ativo' ? <PowerOff /> : <Power />}
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>

        {/* D41.a — só aparece quando a paginação do backend passa a existir de fato */}
        {total > PAGE_SIZE && (
          <div className="flex items-center justify-end gap-2 border-t border-border px-3 py-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={pagina <= 1}
              onClick={() => setPagina((p) => p - 1)}
            >
              Anterior
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={pagina * PAGE_SIZE >= total}
              onClick={() => setPagina((p) => p + 1)}
            >
              Próxima
            </Button>
          </div>
        )}
      </div>

      {/* Drawer — Caminhoes.tsx:55-126 / Representantes.tsx:90-207 — R8 */}
      <Sheet open={drawerAberto} onOpenChange={(aberto) => { if (!aberto) fechar(); }}>
        <SheetContent side="right" className={`flex max-w-full flex-col gap-0 p-0 ${classeDrawer}`}>
          <SheetHeader className="border-b border-border p-4">
            <SheetTitle className="text-[16px] font-bold">
              {editando ? tituloDrawerEdicao(editando) : tituloDrawerNovo}
            </SheetTitle>
          </SheetHeader>

          <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
            {bannerDrawer}

            <div className="grid grid-cols-1 gap-x-3.5 gap-y-2.5 sm:grid-cols-2">
              {campos.map((campo) => (
                <FormField
                  key={campo.nome}
                  label={campo.rotulo}
                  required={campo.obrigatorio}
                  htmlFor={campo.nome}
                  error={erros[campo.nome]}
                  className={campo.tipo === 'textarea' || campo.colSpan === 2 ? 'sm:col-span-2' : undefined}
                >
                  {campo.tipo === 'textarea' ? (
                    <Textarea
                      id={campo.nome}
                      rows={3}
                      value={form[campo.nome] ?? ''}
                      placeholder={campo.placeholder}
                      maxLength={campo.maxLength}
                      aria-invalid={campo.nome in erros || undefined}
                      onChange={(e) => {
                        limparCampo(campo.nome);
                        setForm((f) => ({ ...f, [campo.nome]: e.target.value }));
                      }}
                    />
                  ) : campo.tipo === 'select' ? (
                    <SelectNative
                      id={campo.nome}
                      value={form[campo.nome] ?? ''}
                      aria-invalid={campo.nome in erros || undefined}
                      onChange={(e) => {
                        limparCampo(campo.nome);
                        setForm((f) => ({ ...f, [campo.nome]: e.target.value }));
                      }}
                    >
                      {campo.placeholder && <option value="">{campo.placeholder}</option>}
                      {(campo.opcoes ?? []).map((opcao) => (
                        <option key={opcao.valor} value={opcao.valor}>
                          {opcao.rotulo}
                        </option>
                      ))}
                    </SelectNative>
                  ) : campo.tipo === 'combobox' ? (
                    <ComboboxField
                      id={campo.nome}
                      items={(campo.opcoes ?? []).map((opcao) => ({
                        id: opcao.valor,
                        label: opcao.rotulo,
                      }))}
                      value={form[campo.nome] ?? ''}
                      onChange={(id) => {
                        limparCampo(campo.nome);
                        setForm((f) => ({ ...f, [campo.nome]: id }));
                      }}
                      placeholder={campo.placeholder ?? '—'}
                      searchPlaceholder={`Buscar ${campo.rotulo.toLowerCase()}`}
                      emptyText="Nenhum registro encontrado"
                      clearable
                    />
                  ) : (
                    <Input
                      id={campo.nome}
                      type={campo.tipo === 'numero' ? 'number' : campo.tipo === 'data' ? 'date' : 'text'}
                      value={form[campo.nome] ?? ''}
                      placeholder={campo.placeholder}
                      maxLength={campo.maxLength}
                      aria-invalid={campo.nome in erros || undefined}
                      onChange={(e) => {
                        const valor = campo.mascara ? campo.mascara(e.target.value) : e.target.value;
                        limparCampo(campo.nome);
                        setForm((f) => ({ ...f, [campo.nome]: valor }));
                      }}
                      className={campo.monoespacado ? 'font-data' : undefined}
                    />
                  )}
                </FormField>
              ))}
            </div>

            {/* Status é do componente, não da grade de campos — Representantes.tsx:142-155 */}
            <div className="flex items-center justify-between border-t border-b border-muted py-2.5">
              <span className="text-[13px] font-medium text-foreground">Status</span>
              <Switch
                aria-label="Status"
                checked={form.status === 'ativo'}
                onCheckedChange={(v) => setForm((f) => ({ ...f, status: v ? 'ativo' : 'inativo' }))}
              />
            </div>

            {blocosDrawer?.(editando)}
          </div>

          <SheetFooter className="flex-row justify-end gap-2 border-t border-border p-4">
            <Button type="button" variant="ghost" onClick={fechar}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => void salvar()} disabled={salvando}>
              {salvando ? 'Salvando…' : rotuloSalvar}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
