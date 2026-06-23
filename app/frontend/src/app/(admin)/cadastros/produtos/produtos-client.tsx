'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Eye,
  Pencil,
  Plus,
  Power,
  PowerOff,
  Search,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  fluxoOperacional,
  rotuloTipoOperacional,
  TIPOS_OPERACIONAIS,
  type CriarProdutoDto,
  type Paginado,
  type Produto,
  type TipoOperacional,
} from '@/lib/produtos';

type FormProduto = CriarProdutoDto & { id?: string };

const FORM_VAZIO: FormProduto = {
  codigo: '',
  nome: '',
  nomeOperacional: '',
  categoria: '',
  tipoOperacional: 'peca_inteira_pesavel',
  unidadePedido: 'Peça',
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
};

function produtoParaForm(p: Produto): FormProduto {
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
  };
}

function formParaPayload(form: FormProduto): CriarProdutoDto {
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
  };
}

function StatusBadge({ status }: { status: string }) {
  const ativo = status === 'ativo';
  return (
    <Badge
      variant="outline"
      className={ativo ? 'border-green-200 bg-green-50 text-green-700' : 'border-muted bg-muted/50 text-muted-foreground'}
    >
      {ativo ? 'Ativo' : 'Inativo'}
    </Badge>
  );
}

function TipoBadge({ tipo }: { tipo: TipoOperacional }) {
  const cores: Record<TipoOperacional, string> = {
    peca_inteira_pesavel: 'border-blue-200 bg-blue-50 text-blue-700',
    derivado_desossa: 'border-violet-200 bg-violet-50 text-violet-700',
    entrada_unidade: 'border-orange-200 bg-orange-50 text-orange-700',
    compra_base: 'border-green-200 bg-green-50 text-green-700',
  };
  return (
    <Badge variant="outline" className={cores[tipo]}>
      {rotuloTipoOperacional(tipo)}
    </Badge>
  );
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
    setDrawerAberto(true);
  };

  const abrirProduto = (p: Produto, leitura = false) => {
    setForm(produtoParaForm(p));
    setSomenteLeitura(leitura);
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
      return;
    }
    setSalvando(true);
    setErro(null);
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
        const body = await res.json().catch(() => ({}));
        setErro((body as { message?: string }).message ?? 'Falha ao salvar produto');
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

  const setCampo = <K extends keyof FormProduto>(key: K, val: FormProduto[K]) =>
    setForm((f) => ({ ...f, [key]: val }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Cadastros & Regras / Produtos</p>
          <h1 className="text-2xl font-bold tracking-tight">Produtos</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Cadastro dos itens comercializáveis e operacionais usados em pedidos, disponibilidade, balança, desossa,
            estoque e faturamento.
          </p>
        </div>
        {podeGerenciar && (
          <Button onClick={abrirNovo}>
            <Plus className="mr-1.5 size-4" />
            Novo Produto
          </Button>
        )}
      </div>

      {erro && (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {erro}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, código ou nome operacional"
            className="pl-8"
          />
        </div>
        <Select value={filtroTipo} onValueChange={setFiltroTipo}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Tipo operacional" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Tipo: Todos</SelectItem>
            {TIPOS_OPERACIONAIS.map((t) => (
              <SelectItem key={t.valor} value={t.valor}>
                {t.rotulo}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Status: Todos</SelectItem>
            <SelectItem value="ativo">Ativo</SelectItem>
            <SelectItem value="inativo">Inativo</SelectItem>
          </SelectContent>
        </Select>
        <span className="ml-auto text-xs text-muted-foreground">
          {produtos.length} produto{produtos.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                {['Código', 'Produto', 'Nome oper.', 'Tipo', 'Un. pedido', 'Un. preço', 'Peso', 'Fluxo', 'Tab. preço', 'Status', 'Ações'].map(
                  (h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold tracking-wide whitespace-nowrap text-muted-foreground uppercase">
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={11} className="px-4 py-12 text-center text-muted-foreground">
                    Carregando...
                  </td>
                </tr>
              ) : produtos.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-12 text-center text-muted-foreground">
                    Nenhum produto encontrado.
                  </td>
                </tr>
              ) : (
                produtos.map((p) => (
                  <tr key={p.id} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-2.5">
                      <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-xs font-bold text-primary">
                        {p.codigo}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-medium whitespace-nowrap">{p.nome}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{p.nomeOperacional ?? '—'}</td>
                    <td className="px-4 py-2.5">
                      <TipoBadge tipo={p.tipoOperacional} />
                    </td>
                    <td className="px-4 py-2.5">{p.unidadePedido}</td>
                    <td className="px-4 py-2.5">{p.unidadePreco}</td>
                    <td className="px-4 py-2.5">
                      {p.exigePeso ? (
                        <span className="text-xs font-semibold text-blue-600">Sim</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Não</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-muted-foreground">{fluxoOperacional(p)}</td>
                    <td className="px-4 py-2.5">
                      {p.ativoVenda ? (
                        <span className="text-xs font-semibold text-green-600">Sim</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Não</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="size-7" title="Visualizar" onClick={() => abrirProduto(p, true)}>
                          <Eye className="size-3.5" />
                        </Button>
                        {podeGerenciar && (
                          <>
                            <Button variant="ghost" size="icon" className="size-7" title="Editar" onClick={() => abrirProduto(p)}>
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              title={p.status === 'ativo' ? 'Inativar' : 'Ativar'}
                              onClick={() => void alternarStatus(p)}
                            >
                              {p.status === 'ativo' ? <PowerOff className="size-3.5" /> : <Power className="size-3.5" />}
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Sheet open={drawerAberto} onOpenChange={setDrawerAberto}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
          <SheetHeader className="border-b px-6 py-4">
            <SheetTitle>{form.id ? `Produto — ${form.codigo}` : 'Novo Produto'}</SheetTitle>
          </SheetHeader>

          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="codigo">Código interno</Label>
                <Input
                  id="codigo"
                  value={form.codigo}
                  disabled={somenteLeitura || !!form.id}
                  onChange={(e) => setCampo('codigo', e.target.value)}
                  placeholder="Ex: TZ, PA"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="categoria">Categoria</Label>
                <Input
                  id="categoria"
                  value={form.categoria ?? ''}
                  disabled={somenteLeitura}
                  onChange={(e) => setCampo('categoria', e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="nome">Nome do produto</Label>
              <Input
                id="nome"
                value={form.nome}
                disabled={somenteLeitura}
                onChange={(e) => setCampo('nome', e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="nomeOperacional">Nome operacional / etiqueta</Label>
              <Input
                id="nomeOperacional"
                value={form.nomeOperacional ?? ''}
                disabled={somenteLeitura}
                onChange={(e) => setCampo('nomeOperacional', e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Tipo operacional</Label>
              <Select
                value={form.tipoOperacional}
                disabled={somenteLeitura}
                onValueChange={(v) => setCampo('tipoOperacional', v as TipoOperacional)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_OPERACIONAIS.map((t) => (
                    <SelectItem key={t.valor} value={t.valor}>
                      {t.rotulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="unidadePedido">Unidade do pedido</Label>
                <Input
                  id="unidadePedido"
                  value={form.unidadePedido}
                  disabled={somenteLeitura}
                  onChange={(e) => setCampo('unidadePedido', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Unidade de preço</Label>
                <Select
                  value={form.unidadePreco}
                  disabled={somenteLeitura}
                  onValueChange={(v) => setCampo('unidadePreco', v as 'kg' | 'unidade')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kg">kg</SelectItem>
                    <SelectItem value="unidade">Unidade</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3 rounded-lg border p-3">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Flags operacionais</p>
              {(
                [
                  ['exigePeso', 'Exige peso final para faturamento'],
                  ['passaBalanca', 'Passa pela balança principal'],
                  ['passaDesossa', 'Passa pela desossa'],
                  ['origemTransformacao', 'É origem de transformação'],
                  ['saidaTransformacao', 'É derivado de transformação'],
                  ['podeEstoque', 'Permite estoque'],
                  ['ativoVenda', 'Ativo para venda / tabela de preços'],
                  ['ativoCompra', 'Ativo para compra'],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className="flex items-center justify-between gap-4">
                  <Label htmlFor={key} className="font-normal">
                    {label}
                  </Label>
                  <Switch
                    id={key}
                    checked={form[key]}
                    disabled={somenteLeitura}
                    onCheckedChange={(v) => setCampo(key, v)}
                  />
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between rounded-lg border px-3 py-2">
              <Label htmlFor="status">Status</Label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{form.status === 'ativo' ? 'Ativo' : 'Inativo'}</span>
                <Switch
                  id="status"
                  checked={form.status === 'ativo'}
                  disabled={somenteLeitura}
                  onCheckedChange={(v) => setCampo('status', v ? 'ativo' : 'inativo')}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="observacoes">Observações operacionais</Label>
              <Textarea
                id="observacoes"
                value={form.observacoesOperacionais ?? ''}
                disabled={somenteLeitura}
                onChange={(e) => setCampo('observacoesOperacionais', e.target.value)}
                rows={3}
              />
            </div>
          </div>

          {!somenteLeitura && podeGerenciar && (
            <SheetFooter className="border-t px-6 py-4">
              <Button variant="outline" onClick={() => setDrawerAberto(false)}>
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
