'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, Plus, Save, Search, Settings } from 'lucide-react';
import { AlertItem } from '@/components/ui/alert-item';
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
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Representante } from '@/lib/representantes';
import type { Rota } from '@/lib/rotas';

interface DadosFiscais {
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  cep?: string;
  inscricaoEstadual?: string;
  inscricaoMunicipal?: string;
  emailFiscal?: string;
  telefoneFiscal?: string;
}

interface DadosContato {
  nome?: string;
  cargo?: string;
  telefone?: string;
  whatsapp?: string;
  email?: string;
  tipo?: 'compra' | 'financeiro' | 'recebimento' | 'fiscal';
  principal?: boolean;
}

interface Preferencias {
  faixaPesoMin?: number;
  faixaPesoMax?: number;
  perfilGordura?: string;
  necessitaCorteAcerto?: boolean;
}

interface Cliente {
  id: string;
  codigo: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  documentoFiscal: string;
  status: 'ativo' | 'inativo';
  representanteId: string | null;
  representanteNome?: string | null;
  rotaId: string | null;
  rotaNome?: string | null;
  prioridade: 'normal' | 'alta' | null;
  dadosFiscaisJson: DadosFiscais;
  dadosContatoJson: DadosContato;
  preferenciasJson: Preferencias;
  observacoesOperacionais: string | null;
}

interface Paginado<T> {
  data: T[];
  total: number;
  totalAtivos?: number;
  page: number;
  pageSize: number;
}

const CLIENTE_VAZIO: Cliente = {
  id: '',
  codigo: '',
  razaoSocial: '',
  nomeFantasia: '',
  documentoFiscal: '',
  status: 'ativo',
  representanteId: null,
  rotaId: null,
  prioridade: 'normal',
  dadosFiscaisJson: {},
  dadosContatoJson: {},
  preferenciasJson: {},
  observacoesOperacionais: null,
};

function formatarDocumento(documento: string): string {
  if (documento.length === 14) {
    return documento.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
  if (documento.length === 11) {
    return documento.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  return documento;
}

async function mensagemDaFalha(response: Response, fallback: string): Promise<string> {
  const body = await response.json().catch(() => ({})) as { message?: string | string[] };
  if (Array.isArray(body.message)) return body.message.join('; ');
  return body.message ?? fallback;
}

function CampoTexto({
  id,
  label,
  value,
  onChange,
  readOnly,
  type = 'text',
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  type?: 'text' | 'email' | 'number';
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        readOnly={readOnly}
        className={readOnly ? 'bg-muted' : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

export function ClientesClient({ podeGerenciar }: { podeGerenciar: boolean }) {
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'ativo' | 'inativo'>('ativo');
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [totalAtivos, setTotalAtivos] = useState(0);
  const [representantes, setRepresentantes] = useState<Representante[]>([]);
  const [rotas, setRotas] = useState<Rota[]>([]);
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const [form, setForm] = useState<Cliente | null>(null);
  const [novo, setNovo] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);

  const carregarOpcoes = useCallback(async () => {
    const [resRepresentantes, resRotas] = await Promise.all([
      fetch('/api/cadastros/representantes?pageSize=100&status=ativo', { cache: 'no-store' }),
      fetch('/api/cadastros/rotas?pageSize=100&status=ativo', { cache: 'no-store' }),
    ]);
    if (!resRepresentantes.ok) {
      throw new Error(await mensagemDaFalha(resRepresentantes, 'Erro ao carregar representantes'));
    }
    if (!resRotas.ok) {
      throw new Error(await mensagemDaFalha(resRotas, 'Erro ao carregar rotas'));
    }
    const [listaRepresentantes, listaRotas] = await Promise.all([
      resRepresentantes.json() as Promise<Paginado<Representante>>,
      resRotas.json() as Promise<Paginado<Rota>>,
    ]);
    setRepresentantes(listaRepresentantes.data);
    setRotas(listaRotas.data);
  }, []);

  const carregarLista = useCallback(async (termo = '') => {
    const qs = new URLSearchParams();
    if (termo) qs.set('search', termo);
    const response = await fetch(`/api/cadastros/clientes?${qs.toString()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(await mensagemDaFalha(response, 'Erro ao carregar clientes'));
    const paginado = await response.json() as Paginado<Cliente>;
    setClientes(paginado.data);
    setTotalAtivos(paginado.totalAtivos ?? 0);
    setSelecionadoId((atual) => atual ?? paginado.data[0]?.id ?? null);
  }, []);

  const carregarDetalhe = useCallback(async (id: string) => {
    const response = await fetch(`/api/cadastros/clientes/${id}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(await mensagemDaFalha(response, 'Erro ao carregar cliente'));
    const detalhe = await response.json() as Cliente;
    setForm({
      ...detalhe,
      dadosFiscaisJson: detalhe.dadosFiscaisJson ?? {},
      dadosContatoJson: detalhe.dadosContatoJson ?? {},
      preferenciasJson: detalhe.preferenciasJson ?? {},
    });
    setNovo(false);
  }, []);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    Promise.all([carregarLista(), carregarOpcoes()])
      .catch((falha: unknown) => {
        if (ativo) setErro(falha instanceof Error ? falha.message : 'Erro ao carregar clientes');
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, [carregarLista, carregarOpcoes]);

  useEffect(() => {
    if (!selecionadoId || novo) return;
    void carregarDetalhe(selecionadoId).catch((falha: unknown) => {
      setErro(falha instanceof Error ? falha.message : 'Erro ao carregar cliente');
    });
  }, [carregarDetalhe, novo, selecionadoId]);

  const clientesVisiveis = useMemo(
    () => clientes.filter((cliente) => filtroStatus === 'todos' || cliente.status === filtroStatus),
    [clientes, filtroStatus],
  );

  function atualizar<K extends keyof Cliente>(campo: K, valor: Cliente[K]) {
    setForm((atual) => atual ? { ...atual, [campo]: valor } : atual);
  }

  function atualizarJson<T extends 'dadosFiscaisJson' | 'dadosContatoJson' | 'preferenciasJson'>(
    campo: T,
    chave: string,
    valor: unknown,
  ) {
    setForm((atual) => atual ? {
      ...atual,
      [campo]: { ...atual[campo], [chave]: valor },
    } : atual);
  }

  async function buscar(event: React.FormEvent) {
    event.preventDefault();
    setCarregando(true);
    setErro(null);
    setSelecionadoId(null);
    setForm(null);
    try {
      await carregarLista(busca.trim());
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Erro ao buscar clientes');
    } finally {
      setCarregando(false);
    }
  }

  function iniciarNovo() {
    setNovo(true);
    setSelecionadoId(null);
    setForm(CLIENTE_VAZIO);
    setMensagem(null);
    setErro(null);
  }

  async function salvar(event: React.FormEvent) {
    event.preventDefault();
    if (!form || !podeGerenciar) return;
    setSalvando(true);
    setErro(null);
    setMensagem(null);
    const url = novo ? '/api/cadastros/clientes' : `/api/cadastros/clientes/${form.id}`;
    try {
      const response = await fetch(url, {
        method: novo ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codigo: form.codigo,
          razaoSocial: form.razaoSocial,
          nomeFantasia: form.nomeFantasia || undefined,
          documentoFiscal: form.documentoFiscal,
          status: form.status,
          representanteId: form.representanteId || undefined,
          rotaId: form.rotaId,
          prioridade: form.prioridade ?? undefined,
          dadosFiscaisJson: form.dadosFiscaisJson,
          dadosContatoJson: form.dadosContatoJson,
          preferenciasJson: form.preferenciasJson,
          observacoesOperacionais: form.observacoesOperacionais || undefined,
        }),
      });
      if (!response.ok) {
        setErro(await mensagemDaFalha(response, 'Falha ao salvar cliente'));
        return;
      }
      const salvo = await response.json() as Cliente;
      setMensagem('Alterações salvas.');
      await carregarLista(busca.trim());
      setSelecionadoId(salvo.id);
      await carregarDetalhe(salvo.id);
    } catch {
      setErro('Erro de conexão');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="flex h-full min-h-[calc(100vh-8rem)] flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Cadastro de Clientes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gerenciamento de clientes e preferências operacionais
          </p>
        </div>
        <Badge variant="outline" className="border-border bg-muted text-foreground">
          Total: {totalAtivos} ativos
        </Badge>
      </div>

      {erro && (
        <div role="alert" className="rounded-xl border border-destructive/30 px-4">
          <AlertItem
            title="Não foi possível concluir a operação"
            description={erro}
            time=""
            variant="divergencia"
          />
        </div>
      )}
      {mensagem && (
        <p className="rounded-lg border border-primary/20 bg-accent p-3 text-sm text-primary">
          {mensagem}
        </p>
      )}

      <div className="flex min-h-0 flex-1 flex-col gap-6 lg:flex-row">
        <aside className="flex w-full shrink-0 flex-col rounded-xl border border-border bg-card shadow-sm lg:w-[400px]">
          <div className="space-y-4 border-b border-border p-4">
            <form onSubmit={buscar} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={busca}
                  onChange={(event) => setBusca(event.target.value)}
                  className="h-9 pl-9"
                  placeholder="Buscar cliente..."
                />
              </div>
              {podeGerenciar && (
                <Button
                  type="button"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={iniciarNovo}
                  aria-label="Novo cliente"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              )}
            </form>
            <Select value={filtroStatus} onValueChange={(valor) => setFiltroStatus(valor as typeof filtroStatus)}>
              <SelectTrigger aria-label="Filtrar clientes por status" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                <SelectItem value="ativo">Somente Ativos</SelectItem>
                <SelectItem value="inativo">Somente Inativos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1 overflow-auto p-2">
            {carregando ? (
              <p className="p-4 text-center text-sm text-muted-foreground">Carregando…</p>
            ) : clientesVisiveis.length === 0 ? (
              <p className="p-4 text-center text-sm text-muted-foreground">Nenhum cliente encontrado.</p>
            ) : (
              <div className="space-y-1">
                {clientesVisiveis.map((cliente) => (
                  <button
                    key={cliente.id}
                    type="button"
                    onClick={() => {
                      setNovo(false);
                      setSelecionadoId(cliente.id);
                    }}
                    className={`w-full rounded-lg border p-3 text-left transition-colors ${
                      selecionadoId === cliente.id
                        ? 'border-primary bg-accent shadow-sm'
                        : 'border-transparent hover:bg-muted/50'
                    }`}
                  >
                    <div className="mb-1 flex items-start justify-between gap-2">
                      <span className="truncate text-sm font-bold text-foreground">
                        {cliente.nomeFantasia || cliente.razaoSocial}
                      </span>
                      <Badge
                        variant="outline"
                        className={cliente.status === 'ativo'
                          ? 'border-none bg-[var(--color-status-expedido-bg)] text-[10px] uppercase text-[var(--color-status-expedido)]'
                          : 'border-none bg-muted text-[10px] uppercase text-muted-foreground'}
                      >
                        {cliente.status}
                      </Badge>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{cliente.razaoSocial}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatarDocumento(cliente.documentoFiscal)}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col rounded-xl border border-border bg-card shadow-sm">
          {!form ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-muted-foreground">
              <Building2 className="h-12 w-12 opacity-20" />
              <p>Selecione um cliente para visualizar ou editar os detalhes.</p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border p-6">
                <div className="flex gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <Building2 className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-foreground">
                      {form.nomeFantasia || form.razaoSocial || 'Novo cliente'}
                    </h2>
                    <p className="text-sm text-muted-foreground">{form.razaoSocial}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Switch
                      id="cliente-ativo"
                      checked={form.status === 'ativo'}
                      disabled={!podeGerenciar}
                      onCheckedChange={(ativo) => atualizar('status', ativo ? 'ativo' : 'inativo')}
                    />
                    <Label htmlFor="cliente-ativo">Cliente Ativo</Label>
                  </div>
                  {podeGerenciar && (
                    <Button type="submit" form="cliente-form" disabled={salvando} className="gap-2">
                      <Save className="h-4 w-4" />
                      Salvar
                    </Button>
                  )}
                </div>
              </div>

              <form id="cliente-form" onSubmit={salvar} className="flex-1 overflow-auto">
                <Tabs defaultValue="gerais" className="h-full gap-0">
                  <div className="border-b border-border px-6">
                    <TabsList className="h-12 w-full justify-start gap-6 rounded-none bg-transparent p-0">
                      {([
                        ['gerais', 'Dados Gerais'],
                        ['fiscais', 'Dados Fiscais & Endereço'],
                        ['contatos', 'Contatos'],
                        ['preferencias', 'Preferências Operacionais'],
                      ] as const).map(([valor, rotulo]) => (
                        <TabsTrigger
                          key={valor}
                          value={valor}
                          className="h-full rounded-none bg-transparent px-0 font-medium text-muted-foreground data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none"
                        >
                          {rotulo}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </div>

                  <div className="p-6">
                    <TabsContent value="gerais" className="mt-0 space-y-6">
                      <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-accent p-4 text-sm text-primary">
                        <Settings className="mt-0.5 h-5 w-5 shrink-0" />
                        <p>
                          Representante e Rota são herdados <strong>automaticamente</strong> pelo pedido
                          de venda ao selecionar este cliente — não precisam ser escolhidos novamente na venda.
                        </p>
                      </div>
                      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                        <CampoTexto
                          id="nome-fantasia"
                          label="Nome Fantasia"
                          value={form.nomeFantasia ?? ''}
                          onChange={(valor) => atualizar('nomeFantasia', valor)}
                        />
                        <CampoTexto
                          id="razao-social"
                          label="Razão Social"
                          value={form.razaoSocial}
                          onChange={(valor) => atualizar('razaoSocial', valor)}
                        />
                        <CampoTexto
                          id="documento-fiscal"
                          label="CNPJ/CPF"
                          value={form.documentoFiscal}
                          onChange={(valor) => atualizar('documentoFiscal', valor)}
                        />
                        <CampoTexto
                          id="codigo-interno"
                          label="Código Interno"
                          value={form.codigo}
                          readOnly={!novo}
                          onChange={(valor) => atualizar('codigo', valor)}
                        />
                        <div className="space-y-2">
                          <Label>Representante</Label>
                          <Select
                            value={form.representanteId ?? 'sem-vinculo'}
                            disabled={!podeGerenciar}
                            onValueChange={(valor) => atualizar(
                              'representanteId',
                              valor === 'sem-vinculo' ? null : valor,
                            )}
                          >
                            <SelectTrigger aria-label="Representante">
                              <SelectValue placeholder="—" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="sem-vinculo">—</SelectItem>
                              {representantes.map((representante) => (
                                <SelectItem key={representante.id} value={representante.id}>
                                  {representante.nome}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Itinerário / Rota</Label>
                          <Select
                            value={form.rotaId ?? 'sem-rota'}
                            disabled={!podeGerenciar}
                            onValueChange={(valor) => atualizar('rotaId', valor === 'sem-rota' ? null : valor)}
                          >
                            <SelectTrigger aria-label="Itinerário / Rota">
                              <SelectValue placeholder="—" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="sem-rota">—</SelectItem>
                              {rotas.map((rota) => (
                                <SelectItem key={rota.id} value={rota.id}>{rota.nome}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Prioridade Padrão</Label>
                          <Select
                            value={form.prioridade ?? 'normal'}
                            disabled={!podeGerenciar}
                            onValueChange={(valor) => atualizar('prioridade', valor as 'normal' | 'alta')}
                          >
                            <SelectTrigger aria-label="Prioridade Padrão">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="normal">Normal</SelectItem>
                              <SelectItem value="alta">Alta</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="fiscais" className="mt-0">
                      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                        {([
                          ['logradouro', 'Logradouro', 'text'],
                          ['numero', 'Número', 'text'],
                          ['complemento', 'Complemento', 'text'],
                          ['bairro', 'Bairro', 'text'],
                          ['cidade', 'Cidade', 'text'],
                          ['uf', 'UF', 'text'],
                          ['cep', 'CEP', 'text'],
                          ['inscricaoEstadual', 'Inscrição Estadual', 'text'],
                          ['inscricaoMunicipal', 'Inscrição Municipal', 'text'],
                          ['emailFiscal', 'E-mail Fiscal', 'email'],
                          ['telefoneFiscal', 'Telefone Fiscal', 'text'],
                        ] as const).map(([chave, rotulo, tipo]) => (
                          <CampoTexto
                            key={chave}
                            id={`fiscal-${chave}`}
                            label={rotulo}
                            type={tipo}
                            value={form.dadosFiscaisJson[chave] ?? ''}
                            onChange={(valor) => atualizarJson('dadosFiscaisJson', chave, valor)}
                          />
                        ))}
                      </div>
                    </TabsContent>

                    <TabsContent value="contatos" className="mt-0">
                      <div className="rounded-lg border border-border p-4">
                        <div className="mb-4 flex items-center justify-between">
                          <h3 className="font-semibold text-foreground">Contato principal</h3>
                          <div className="flex items-center gap-2">
                            <Switch
                              id="contato-principal"
                              checked={form.dadosContatoJson.principal === true}
                              disabled={!podeGerenciar}
                              onCheckedChange={(valor) => atualizarJson('dadosContatoJson', 'principal', valor)}
                            />
                            <Label htmlFor="contato-principal">Principal</Label>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                          {([
                            ['nome', 'Nome', 'text'],
                            ['cargo', 'Cargo', 'text'],
                            ['telefone', 'Telefone', 'text'],
                            ['whatsapp', 'WhatsApp', 'text'],
                            ['email', 'E-mail', 'email'],
                          ] as const).map(([chave, rotulo, tipo]) => (
                            <CampoTexto
                              key={chave}
                              id={`contato-${chave}`}
                              label={rotulo}
                              type={tipo}
                              value={form.dadosContatoJson[chave] ?? ''}
                              onChange={(valor) => atualizarJson('dadosContatoJson', chave, valor)}
                            />
                          ))}
                          <div className="space-y-2">
                            <Label>Tipo</Label>
                            <Select
                              value={form.dadosContatoJson.tipo ?? 'compra'}
                              disabled={!podeGerenciar}
                              onValueChange={(valor) => atualizarJson('dadosContatoJson', 'tipo', valor)}
                            >
                              <SelectTrigger aria-label="Tipo do contato">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="compra">Compra</SelectItem>
                                <SelectItem value="financeiro">Financeiro</SelectItem>
                                <SelectItem value="recebimento">Recebimento</SelectItem>
                                <SelectItem value="fiscal">Fiscal</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="preferencias" className="mt-0 space-y-6">
                      <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-accent p-4 text-sm text-primary">
                        <Settings className="mt-0.5 h-5 w-5 shrink-0" />
                        <p>
                          Estas regras serão aplicadas <strong>automaticamente</strong> na sugestão de
                          associação de peças e na expedição deste cliente.
                        </p>
                      </div>
                      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                        <CampoTexto
                          id="peso-minimo"
                          label="Faixa de Peso Mínima (kg)"
                          type="number"
                          value={form.preferenciasJson.faixaPesoMin?.toString() ?? ''}
                          onChange={(valor) => atualizarJson(
                            'preferenciasJson',
                            'faixaPesoMin',
                            valor === '' ? undefined : Number(valor),
                          )}
                        />
                        <CampoTexto
                          id="peso-maximo"
                          label="Faixa de Peso Máxima (kg)"
                          type="number"
                          value={form.preferenciasJson.faixaPesoMax?.toString() ?? ''}
                          onChange={(valor) => atualizarJson(
                            'preferenciasJson',
                            'faixaPesoMax',
                            valor === '' ? undefined : Number(valor),
                          )}
                        />
                        <div className="space-y-2">
                          <Label>Perfil de Gordura Aceito</Label>
                          <Select
                            value={form.preferenciasJson.perfilGordura ?? 'qualquer'}
                            disabled={!podeGerenciar}
                            onValueChange={(valor) => atualizarJson('preferenciasJson', 'perfilGordura', valor)}
                          >
                            <SelectTrigger aria-label="Perfil de Gordura Aceito">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="qualquer">Qualquer</SelectItem>
                              <SelectItem value="baixa">Baixa / Média</SelectItem>
                              <SelectItem value="alta">Alta</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Necessita Corte de Acerto?</Label>
                          <div className="flex h-10 items-center gap-2">
                            <Switch
                              id="necessita-corte"
                              checked={form.preferenciasJson.necessitaCorteAcerto === true}
                              disabled={!podeGerenciar}
                              onCheckedChange={(valor) => atualizarJson(
                                'preferenciasJson',
                                'necessitaCorteAcerto',
                                valor,
                              )}
                            />
                            <Label htmlFor="necessita-corte" className="font-normal text-muted-foreground">
                              Sim, enviar para mesa de corte
                            </Label>
                          </div>
                        </div>
                      </div>
                    </TabsContent>
                  </div>
                </Tabs>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
