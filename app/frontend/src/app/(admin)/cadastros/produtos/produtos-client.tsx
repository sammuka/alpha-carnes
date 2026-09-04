'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Eye,
  Pencil,
  Plus,
  Power,
  PowerOff,
  Search,
} from 'lucide-react';
import { StatusPill } from '@/components/ui/status-pill';
import { BadgeCount } from '@/components/ui/badge-count';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/ui/page-header';
import { SelectNative } from '@/components/ui/select-native';
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableCellCode,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { UNIDADE_MEDIDA_OPTIONS, type UnidadeMedida } from '@/lib/dominios';
import { detalharErro } from '@/lib/error-message';
import { useErrosPorCampo } from '@/lib/use-erros-campo';
import {
  fluxoOperacional,
  rotuloTipoOperacional,
  TIPOS_OPERACIONAIS,
  type CriarProdutoDto,
  type Paginado,
  type Produto,
  type TipoOperacional,
} from '@/lib/produtos';

type FormProduto = CriarProdutoDto & {
  id?: string;
  ncm?: string;
  cfop?: string;
  origemFiscal?: string;
  cestOpcional?: string;
};

type AbaProdutos = 'gerais' | 'comercial' | 'operacional' | 'estoque' | 'fiscal';

/** Chave de erro (path do Zod no backend) por campo do formulário. */
const CHAVE_ERRO: Record<string, string> = {
  ncm: 'atributosJson.fiscal.ncm',
  cfop: 'atributosJson.fiscal.cfop',
  origemFiscal: 'atributosJson.fiscal.origemFiscal',
  cestOpcional: 'atributosJson.fiscal.cestOpcional',
  // demais campos: a chave é o próprio nome
};
const chaveDe = (campo: string) => CHAVE_ERRO[campo] ?? campo;

function abaDaChave(chave: string): AbaProdutos {
  if (chave.startsWith('atributosJson.fiscal.')) return 'fiscal';
  if (['unidadePreco', 'ativoVenda', 'ativoCompra'].includes(chave)) return 'comercial';
  if (chave === 'podeEstoque') return 'estoque';
  if (
    ['tipoOperacional', 'unidadePedido', 'exigePeso', 'passaBalanca', 'passaDesossa',
     'origemTransformacao', 'saidaTransformacao', 'observacoesOperacionais'].includes(chave)
  ) return 'operacional';
  return 'gerais'; // codigo, categoria, nome, nomeOperacional, status
}

const FORM_VAZIO: FormProduto = {
  codigo: '',
  nome: '',
  nomeOperacional: '',
  categoria: '',
  tipoOperacional: 'peca_inteira_pesavel',
  unidadePedido: 'unidade',
  unidadePreco: 'kg',
  exigePeso: true,
  passaBalanca: false,
  passaDesossa: false,
  origemTransformacao: false,
  saidaTransformacao: false,
  podeEstoque: true,
  ativoVenda: true,
  ativoCompra: false,
  status: 'ativo',
  observacoesOperacionais: '',
  ncm: '',
  cfop: '',
  origemFiscal: '',
  cestOpcional: '',
};

function lerFiscal(p: Produto): {
  ncm: string;
  cfop: string;
  origemFiscal: string;
  cestOpcional: string;
} {
  const fiscal = (p.atributosJson?.fiscal ?? {}) as {
    ncm?: string;
    cfop?: string;
    origemFiscal?: string;
    cestOpcional?: string;
  };
  return {
    ncm: fiscal.ncm ?? '',
    cfop: fiscal.cfop ?? '',
    origemFiscal: fiscal.origemFiscal ?? '',
    cestOpcional: fiscal.cestOpcional ?? '',
  };
}

function produtoParaForm(p: Produto): FormProduto {
  const fiscal = lerFiscal(p);
  return {
    id: p.id,
    codigo: p.codigo,
    nome: p.nome,
    nomeOperacional: p.nomeOperacional ?? '',
    categoria: p.categoria ?? '',
    tipoOperacional: p.tipoOperacional,
    unidadePedido: p.unidadePedido,
    unidadePreco: p.unidadePreco,
    exigePeso: p.exigePeso,
    passaBalanca: p.passaBalanca,
    passaDesossa: p.passaDesossa,
    origemTransformacao: p.origemTransformacao,
    saidaTransformacao: p.saidaTransformacao,
    podeEstoque: p.podeEstoque,
    ativoVenda: p.ativoVenda,
    ativoCompra: p.ativoCompra,
    status: p.status,
    observacoesOperacionais: p.observacoesOperacionais ?? '',
    ...fiscal,
  };
}

function formParaPayload(form: FormProduto): CriarProdutoDto {
  const fiscal = {
    ncm: form.ncm?.trim() || undefined,
    cfop: form.cfop?.trim() || undefined,
    origemFiscal: form.origemFiscal?.trim() || undefined,
    cestOpcional: form.cestOpcional?.trim() || undefined,
  };
  const temFiscal = Object.values(fiscal).some((v) => v !== undefined);

  return {
    codigo: form.codigo.trim(),
    nome: form.nome.trim(),
    nomeOperacional: form.nomeOperacional?.trim() || undefined,
    categoria: form.categoria?.trim() || undefined,
    tipoOperacional: form.tipoOperacional,
    unidadePedido: form.unidadePedido.trim(),
    unidadePreco: form.unidadePreco,
    exigePeso: form.exigePeso,
    passaBalanca: form.passaBalanca,
    passaDesossa: form.passaDesossa,
    origemTransformacao: form.origemTransformacao,
    saidaTransformacao: form.saidaTransformacao,
    podeEstoque: form.podeEstoque,
    ativoVenda: form.ativoVenda,
    ativoCompra: form.ativoCompra,
    status: form.status,
    observacoesOperacionais: form.observacoesOperacionais?.trim() || undefined,
    atributosJson: temFiscal ? { fiscal } : undefined,
  };
}

function TipoBadge({ tipo }: { tipo: TipoOperacional }) {
  const cores: Record<TipoOperacional, string> = {
    peca_inteira_pesavel: 'bg-surface-3 text-fg-secondary',
    derivado_desossa: 'bg-status-pesado-bg text-status-pesado',
    entrada_unidade: 'bg-warning-soft text-warning-fg',
    compra_base: 'bg-success-soft text-success-fg',
  };
  return <BadgeCount className={cores[tipo]}>{rotuloTipoOperacional(tipo)}</BadgeCount>;
}

export function ProdutosClient({ permissoes }: { permissoes: string[] }) {
  const podeGerenciar = permissoes.includes('PRODUTOS_GERENCIAR');

  const [busca, setBusca] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<string>('todos');
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');
  const [resultado, setResultado] = useState<Paginado<Produto> | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [drawerAberto, setDrawerAberto] = useState(false);
  const [form, setForm] = useState<FormProduto>(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [somenteLeitura, setSomenteLeitura] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState<AbaProdutos>('gerais');
  const { erros, setErros, limparCampo, limparTudo } = useErrosPorCampo();

  const carregar = useCallback(async () => {
    setErro(null);
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: '1', pageSize: '100' });
      if (busca.trim()) params.set('search', busca.trim());
      const res = await fetch(`/api/cadastros/produtos?${params}`, { cache: 'no-store' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setErro((body as { message?: string }).message ?? 'Falha ao carregar produtos');
        return;
      }
      setResultado((await res.json()) as Paginado<Produto>);
    } catch {
      setErro('Erro de conexão');
    } finally {
      setLoading(false);
    }
  }, [busca]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const produtos = (resultado?.data ?? []).filter((p) => {
    if (filtroTipo !== 'todos' && p.tipoOperacional !== filtroTipo) return false;
    if (filtroStatus !== 'todos' && p.status !== filtroStatus) return false;
    return true;
  });

  const abrirNovo = () => {
    setForm({ ...FORM_VAZIO });
    setSomenteLeitura(false);
    setAbaAtiva('gerais');
    limparTudo();
    setDrawerAberto(true);
  };

  const abrirProduto = (p: Produto, leitura = false) => {
    setForm(produtoParaForm(p));
    setSomenteLeitura(leitura);
    setAbaAtiva('gerais');
    limparTudo();
    setDrawerAberto(true);
  };

  const alternarStatus = async (p: Produto) => {
    if (!podeGerenciar) return;
    const novoStatus = p.status === 'ativo' ? 'inativo' : 'ativo';
    try {
      const res = await fetch(`/api/cadastros/produtos/${p.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: novoStatus }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setErro((body as { message?: string }).message ?? 'Falha ao alterar status');
        return;
      }
      void carregar();
    } catch {
      setErro('Erro de conexão');
    }
  };

  const salvar = async () => {
    if (!podeGerenciar || somenteLeitura) return;
    if (!form.codigo.trim() || !form.nome.trim() || !form.unidadePedido.trim()) {
      setErro('Preencha código, nome e unidade do pedido.');
      setErros({
        ...(form.codigo.trim() ? {} : { codigo: 'Campo obrigatório.' }),
        ...(form.nome.trim() ? {} : { nome: 'Campo obrigatório.' }),
        ...(form.unidadePedido.trim() ? {} : { unidadePedido: 'Campo obrigatório.' }),
      });
      return;
    }
    setSalvando(true);
    setErro(null);
    limparTudo();
    try {
      const payload = formParaPayload(form);
      const res = form.id
        ? await fetch(`/api/cadastros/produtos/${form.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch('/api/cadastros/produtos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
      if (!res.ok) {
        const { mensagem, porCampo } = await detalharErro(res, 'Falha ao salvar produto');
        setErro(mensagem);
        setErros(porCampo);
        const primeiraChave = Object.keys(porCampo)[0];
        if (primeiraChave) setAbaAtiva(abaDaChave(primeiraChave));
        return;
      }
      setDrawerAberto(false);
      void carregar();
    } catch {
      setErro('Erro de conexão');
    } finally {
      setSalvando(false);
    }
  };

  const setCampo = <K extends keyof FormProduto>(key: K, val: FormProduto[K]) => {
    limparCampo(chaveDe(String(key)));
    setForm((f) => ({ ...f, [key]: val }));
  };

  const abasComErro = useMemo(() => new Set(Object.keys(erros).map(abaDaChave)), [erros]);

  return (
    <div className="space-y-3">
      <PageHeader title="Produtos" subtitle="Cadastro dos itens comercializáveis e operacionais">
        {podeGerenciar && (
          <Button onClick={abrirNovo}>
            <Plus />
            Novo Produto
          </Button>
        )}
      </PageHeader>

      {erro && (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {erro}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Produtos</CardTitle>
          <BadgeCount>{produtos.length}</BadgeCount>
          <CardAction>
            <div className="w-[240px]">
              <Input
                adornLeft={<Search />}
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por nome, código ou nome operacional"
                className="h-7 text-xs"
              />
            </div>
            <SelectNative
              selectSize="sm"
              className="w-[190px]"
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
            >
              <option value="todos">Tipo: Todos</option>
              {TIPOS_OPERACIONAIS.map((t) => (
                <option key={t.valor} value={t.valor}>
                  {t.rotulo}
                </option>
              ))}
            </SelectNative>
            <SelectNative
              selectSize="sm"
              className="w-[130px]"
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
            >
              <option value="todos">Status: Todos</option>
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
            </SelectNative>
          </CardAction>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Código</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Nome oper.</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Un. pedido</TableHead>
                <TableHead>Un. preço</TableHead>
                <TableHead>Peso</TableHead>
                <TableHead>Fluxo</TableHead>
                <TableHead>Tab. preço</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={11} className="h-24 text-center text-muted-foreground">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : produtos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="h-24 text-center text-muted-foreground">
                    Nenhum produto encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                produtos.map((p) => (
                  <TableRow key={p.id} className="group">
                    <TableCellCode>{p.codigo}</TableCellCode>
                    <TableCell className="text-[13px] font-semibold text-foreground">{p.nome}</TableCell>
                    <TableCell className="text-muted-foreground">{p.nomeOperacional ?? '—'}</TableCell>
                    <TableCell>
                      <TipoBadge tipo={p.tipoOperacional} />
                    </TableCell>
                    <TableCell>{p.unidadePedido}</TableCell>
                    <TableCell>{p.unidadePreco}</TableCell>
                    <TableCell>
                      {p.exigePeso ? (
                        <span className="text-xs font-semibold text-primary-fg">Sim</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Não</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{fluxoOperacional(p)}</TableCell>
                    <TableCell>
                      {p.ativoVenda ? (
                        <span className="text-xs font-semibold text-success-fg">Sim</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Não</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusPill
                        variant={p.status === 'ativo' ? 'expedido' : 'bloqueado'}
                        label={p.status === 'ativo' ? 'Ativo' : 'Inativo'}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                        <Button variant="ghost" size="iconSm" title="Visualizar" onClick={() => abrirProduto(p, true)}>
                          <Eye />
                        </Button>
                        {podeGerenciar && (
                          <>
                            <Button variant="ghost" size="iconSm" title="Editar" onClick={() => abrirProduto(p)}>
                              <Pencil />
                            </Button>
                            <Button
                              variant="ghost"
                              size="iconSm"
                              title={p.status === 'ativo' ? 'Inativar' : 'Ativar'}
                              onClick={() => void alternarStatus(p)}
                            >
                              {p.status === 'ativo' ? <PowerOff /> : <Power />}
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Sheet open={drawerAberto} onOpenChange={setDrawerAberto}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-[520px]">
          <SheetHeader className="border-b border-border p-4">
            <SheetTitle className="text-[16px] font-bold">
              {form.id ? `Produto — ${form.codigo}` : 'Novo Produto'}
            </SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto p-4">
            <Tabs value={abaAtiva} onValueChange={(v) => setAbaAtiva(v as AbaProdutos)}>
              <TabsList>
                <TabsTrigger value="gerais" temErro={abasComErro.has('gerais')}>Gerais</TabsTrigger>
                <TabsTrigger value="comercial" temErro={abasComErro.has('comercial')}>Comercial</TabsTrigger>
                <TabsTrigger value="operacional" temErro={abasComErro.has('operacional')}>Operacional</TabsTrigger>
                <TabsTrigger value="estoque" temErro={abasComErro.has('estoque')}>Estoque</TabsTrigger>
                <TabsTrigger value="fiscal" temErro={abasComErro.has('fiscal')}>Fiscal</TabsTrigger>
              </TabsList>

              <TabsContent value="gerais" forceMount className="space-y-3 data-[state=inactive]:hidden">
                <div className="grid grid-cols-1 gap-x-3.5 gap-y-2.5 sm:grid-cols-2">
                  <FormField label="Código interno" htmlFor="codigo" error={erros[chaveDe('codigo')]}>
                    <Input
                      id="codigo"
                      value={form.codigo}
                      disabled={somenteLeitura || !!form.id}
                      maxLength={50}
                      aria-invalid={chaveDe('codigo') in erros || undefined}
                      onChange={(e) => setCampo('codigo', e.target.value)}
                      placeholder="Ex: TZ, PA"
                    />
                  </FormField>
                  <FormField label="Categoria" htmlFor="categoria" error={erros[chaveDe('categoria')]}>
                    <Input
                      id="categoria"
                      value={form.categoria ?? ''}
                      disabled={somenteLeitura}
                      maxLength={100}
                      aria-invalid={chaveDe('categoria') in erros || undefined}
                      onChange={(e) => setCampo('categoria', e.target.value)}
                    />
                  </FormField>
                  <FormField label="Nome do produto" htmlFor="nome" className="sm:col-span-2" error={erros[chaveDe('nome')]}>
                    <Input
                      id="nome"
                      value={form.nome}
                      disabled={somenteLeitura}
                      maxLength={200}
                      aria-invalid={chaveDe('nome') in erros || undefined}
                      onChange={(e) => setCampo('nome', e.target.value)}
                    />
                  </FormField>
                  <FormField label="Nome operacional / etiqueta" htmlFor="nomeOperacional" className="sm:col-span-2" error={erros[chaveDe('nomeOperacional')]}>
                    <Input
                      id="nomeOperacional"
                      value={form.nomeOperacional ?? ''}
                      disabled={somenteLeitura}
                      maxLength={200}
                      aria-invalid={chaveDe('nomeOperacional') in erros || undefined}
                      onChange={(e) => setCampo('nomeOperacional', e.target.value)}
                    />
                  </FormField>
                </div>

                <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                  <Label htmlFor="status">Status</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{form.status === 'ativo' ? 'Ativo' : 'Inativo'}</span>
                    <Switch
                      id="status"
                      checked={form.status === 'ativo'}
                      disabled={somenteLeitura}
                      aria-invalid={chaveDe('status') in erros || undefined}
                      onCheckedChange={(v) => setCampo('status', v ? 'ativo' : 'inativo')}
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="comercial" forceMount className="space-y-3 data-[state=inactive]:hidden">
                <FormField label="Preço por kg (R$)" htmlFor="precoPorKg" help="Lacuna backend — tabela de preços por kg ainda não exposta pela API.">
                  <Input id="precoPorKg" value="" placeholder="—" disabled readOnly />
                </FormField>

                <FormField label="Unidade de preço" htmlFor="unidadePreco" error={erros[chaveDe('unidadePreco')]}>
                  <SelectNative
                    id="unidadePreco"
                    value={form.unidadePreco}
                    disabled={somenteLeitura}
                    aria-invalid={chaveDe('unidadePreco') in erros || undefined}
                    onChange={(e) => setCampo('unidadePreco', e.target.value as 'kg' | 'unidade')}
                  >
                    <option value="kg">kg</option>
                    <option value="unidade">Unidade</option>
                  </SelectNative>
                </FormField>

                {(
                  [
                    ['ativoVenda', 'Ativo para venda / tabela de preços'],
                    ['ativoCompra', 'Ativo para compra'],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key} className="flex items-center justify-between gap-4">
                    <Label htmlFor={key} className="font-normal normal-case">
                      {label}
                    </Label>
                    <Switch
                      id={key}
                      checked={form[key]}
                      disabled={somenteLeitura}
                      aria-invalid={chaveDe(key) in erros || undefined}
                      onCheckedChange={(v) => setCampo(key, v)}
                    />
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="operacional" forceMount className="space-y-3 data-[state=inactive]:hidden">
                <FormField label="Tipo operacional" htmlFor="tipoOperacional" error={erros[chaveDe('tipoOperacional')]}>
                  <SelectNative
                    id="tipoOperacional"
                    value={form.tipoOperacional}
                    disabled={somenteLeitura}
                    aria-invalid={chaveDe('tipoOperacional') in erros || undefined}
                    onChange={(e) => setCampo('tipoOperacional', e.target.value as TipoOperacional)}
                  >
                    {TIPOS_OPERACIONAIS.map((t) => (
                      <option key={t.valor} value={t.valor}>
                        {t.rotulo}
                      </option>
                    ))}
                  </SelectNative>
                </FormField>

                <FormField label="Unidade do pedido" htmlFor="unidadePedido" error={erros[chaveDe('unidadePedido')]}>
                  <SelectNative
                    id="unidadePedido"
                    value={form.unidadePedido}
                    disabled={somenteLeitura}
                    aria-invalid={chaveDe('unidadePedido') in erros || undefined}
                    onChange={(e) => setCampo('unidadePedido', e.target.value as UnidadeMedida)}
                  >
                    {UNIDADE_MEDIDA_OPTIONS.map((op) => (
                      <option key={op.valor} value={op.valor}>{op.rotulo}</option>
                    ))}
                  </SelectNative>
                </FormField>

                <div className="space-y-2.5 rounded-md border border-border p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.02em] text-fg-secondary">Flags operacionais</p>
                  {(
                    [
                      ['exigePeso', 'Exige peso final para faturamento'],
                      ['passaBalanca', 'Passa pela balança principal'],
                      ['passaDesossa', 'Passa pela desossa'],
                      ['origemTransformacao', 'É origem de transformação'],
                      ['saidaTransformacao', 'É derivado de transformação'],
                    ] as const
                  ).map(([key, label]) => (
                    <div key={key} className="flex items-center justify-between gap-4">
                      <Label htmlFor={key} className="font-normal normal-case">
                        {label}
                      </Label>
                      <Switch
                        id={key}
                        checked={form[key]}
                        disabled={somenteLeitura}
                        aria-invalid={chaveDe(key) in erros || undefined}
                        onCheckedChange={(v) => setCampo(key, v)}
                      />
                    </div>
                  ))}
                </div>

                <FormField label="Observações operacionais" htmlFor="observacoes" error={erros[chaveDe('observacoesOperacionais')]}>
                  <Textarea
                    id="observacoes"
                    value={form.observacoesOperacionais ?? ''}
                    disabled={somenteLeitura}
                    aria-invalid={chaveDe('observacoesOperacionais') in erros || undefined}
                    onChange={(e) => setCampo('observacoesOperacionais', e.target.value)}
                    rows={3}
                  />
                </FormField>
              </TabsContent>

              <TabsContent value="estoque" forceMount className="space-y-3 data-[state=inactive]:hidden">
                <div className="flex items-center justify-between gap-4">
                  <Label htmlFor="podeEstoque" className="font-normal normal-case">
                    Permite estoque
                  </Label>
                  <Switch
                    id="podeEstoque"
                    checked={form.podeEstoque}
                    disabled={somenteLeitura}
                    aria-invalid={chaveDe('podeEstoque') in erros || undefined}
                    onCheckedChange={(v) => setCampo('podeEstoque', v)}
                  />
                </div>
              </TabsContent>

              <TabsContent value="fiscal" forceMount className="space-y-3 data-[state=inactive]:hidden">
                <div className="grid grid-cols-1 gap-x-3.5 gap-y-2.5 sm:grid-cols-2">
                  <FormField label="NCM" htmlFor="ncm" error={erros[chaveDe('ncm')]}>
                    <Input
                      id="ncm"
                      value={form.ncm ?? ''}
                      disabled={!podeGerenciar}
                      placeholder="0201.30.00"
                      maxLength={10}
                      aria-invalid={chaveDe('ncm') in erros || undefined}
                      onChange={(e) => setCampo('ncm', e.target.value)}
                    />
                  </FormField>
                  <FormField label="CFOP" htmlFor="cfop" error={erros[chaveDe('cfop')]}>
                    <Input
                      id="cfop"
                      value={form.cfop ?? ''}
                      disabled={!podeGerenciar}
                      placeholder="5102"
                      maxLength={6}
                      aria-invalid={chaveDe('cfop') in erros || undefined}
                      onChange={(e) => setCampo('cfop', e.target.value)}
                    />
                  </FormField>
                  <FormField label="Origem fiscal" htmlFor="origemFiscal" error={erros[chaveDe('origemFiscal')]}>
                    <Input
                      id="origemFiscal"
                      value={form.origemFiscal ?? ''}
                      disabled={!podeGerenciar}
                      maxLength={60}
                      aria-invalid={chaveDe('origemFiscal') in erros || undefined}
                      onChange={(e) => setCampo('origemFiscal', e.target.value)}
                    />
                  </FormField>
                  <FormField label="CEST (opcional)" htmlFor="cestOpcional" error={erros[chaveDe('cestOpcional')]}>
                    <Input
                      id="cestOpcional"
                      value={form.cestOpcional ?? ''}
                      disabled={!podeGerenciar}
                      maxLength={10}
                      aria-invalid={chaveDe('cestOpcional') in erros || undefined}
                      onChange={(e) => setCampo('cestOpcional', e.target.value)}
                    />
                  </FormField>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {!somenteLeitura && podeGerenciar && (
            <SheetFooter className="flex-row justify-end gap-2 border-t border-border p-4">
              <Button variant="ghost" onClick={() => setDrawerAberto(false)}>
                Cancelar
              </Button>
              <Button onClick={() => void salvar()} disabled={salvando}>
                {salvando ? 'Salvando...' : 'Salvar Produto'}
              </Button>
            </SheetFooter>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
