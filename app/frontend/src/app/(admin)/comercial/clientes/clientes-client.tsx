'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, Info, Plus, Save, Search } from 'lucide-react';
import { AlertItem } from '@/components/ui/alert-item';
import { BadgeCount } from '@/components/ui/badge-count';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/ui/page-header';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SelectNative } from '@/components/ui/select-native';
import { StatusPill } from '@/components/ui/status-pill';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/cn';
import { detalharErro, mensagemDeErro } from '@/lib/error-message';
import { mascararCep, mascararCpfCnpj, mascararTelefone } from '@/lib/masks';
import type { Representante } from '@/lib/representantes';
import type { Rota } from '@/lib/rotas';
import { useErrosPorCampo } from '@/lib/use-erros-campo';

/** Campos que recebem máscara "conforme digita". */
const MASCARA_FISCAL: Partial<Record<keyof DadosFiscais, (v: string) => string>> = {
  cep: mascararCep,
  telefoneFiscal: mascararTelefone,
};
const MASCARA_CONTATO: Partial<Record<keyof DadosContato, (v: string) => string>> = {
  telefone: mascararTelefone,
  whatsapp: mascararTelefone,
};

/** Limites de `json-cadastros.dto.ts` (campos mascarados — cep/telefones — não recebem maxLength). */
const MAXLENGTH_FISCAL: Partial<Record<keyof DadosFiscais, number>> = {
  logradouro: 200,
  numero: 20,
  complemento: 100,
  bairro: 100,
  cidade: 100,
  uf: 2,
  inscricaoEstadual: 30,
  inscricaoMunicipal: 30,
};
const MAXLENGTH_CONTATO: Partial<Record<keyof DadosContato, number>> = {
  nome: 200,
  cargo: 100,
};

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

type AbaClientes = 'gerais' | 'fiscais' | 'contatos' | 'preferencias';

/** Mapeia a chave de erro (issue do Zod) devolvida pelo backend para a aba onde o campo aparece. */
function abaDaChave(chave: string): AbaClientes {
  if (chave.startsWith('dadosFiscaisJson.')) return 'fiscais';
  if (chave.startsWith('dadosContatoJson.')) return 'contatos';
  if (chave.startsWith('preferenciasJson.')) return 'preferencias';
  return 'gerais'; // razaoSocial, nomeFantasia, documentoFiscal, representanteId, rotaId, prioridade, status
}

function formatarDocumento(documento: string): string {
  if (documento.length === 14) {
    return documento.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
  if (documento.length === 11) {
    return documento.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  return documento;
}

function iniciaisDe(nome: string): string {
  const limpo = nome.trim();
  if (!limpo) return '—';
  return limpo.slice(0, 2).toUpperCase();
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
  const [abaAtiva, setAbaAtiva] = useState<AbaClientes>('gerais');
  const { erros, setErros, limparCampo, limparTudo } = useErrosPorCampo();

  const carregarOpcoes = useCallback(async () => {
    const [resRepresentantes, resRotas] = await Promise.all([
      fetch('/api/cadastros/representantes?pageSize=100&status=ativo', { cache: 'no-store' }),
      fetch('/api/cadastros/rotas?pageSize=100&status=ativo', { cache: 'no-store' }),
    ]);
    if (!resRepresentantes.ok) {
      throw new Error(await mensagemDeErro(resRepresentantes, 'Erro ao carregar representantes'));
    }
    if (!resRotas.ok) {
      throw new Error(await mensagemDeErro(resRotas, 'Erro ao carregar rotas'));
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
    if (!response.ok) throw new Error(await mensagemDeErro(response, 'Erro ao carregar clientes'));
    const paginado = await response.json() as Paginado<Cliente>;
    setClientes(paginado.data);
    setTotalAtivos(paginado.totalAtivos ?? 0);
    setSelecionadoId((atual) => atual ?? paginado.data[0]?.id ?? null);
  }, []);

  const carregarDetalhe = useCallback(async (id: string) => {
    const response = await fetch(`/api/cadastros/clientes/${id}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(await mensagemDeErro(response, 'Erro ao carregar cliente'));
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
    limparTudo();
  }

  async function salvar(event: React.FormEvent) {
    event.preventDefault();
    if (!form || !podeGerenciar) return;
    setSalvando(true);
    setErro(null);
    setMensagem(null);
    limparTudo();
    const url = novo ? '/api/cadastros/clientes' : `/api/cadastros/clientes/${form.id}`;
    try {
      const response = await fetch(url, {
        method: novo ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
        const { mensagem: mensagemErro, porCampo } = await detalharErro(response, 'Falha ao salvar cliente');
        setErro(mensagemErro);
        setErros(porCampo);
        const primeiraChave = Object.keys(porCampo)[0];
        if (primeiraChave) setAbaAtiva(abaDaChave(primeiraChave));
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

  const abasComErro = useMemo(() => new Set(Object.keys(erros).map(abaDaChave)), [erros]);

  return (
    <div className="space-y-3">
      <PageHeader
        title="Cadastro de Clientes"
        subtitle="Gerenciamento de clientes e preferências operacionais"
      >
        <BadgeCount className="h-[22px] px-2 text-[11px]">{totalAtivos} ativos</BadgeCount>
        {podeGerenciar && (
          <Button type="button" onClick={iniciarNovo}>
            <Plus />
            Novo cliente
          </Button>
        )}
      </PageHeader>

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

      <div className="grid items-start gap-2.5 lg:grid-cols-[320px_1fr]">
        {/* MASTER */}
        <Card>
          <CardContent className="flex gap-1.5 p-2.5 pb-1.5">
            <form onSubmit={buscar} className="flex-1">
              <Input
                value={busca}
                onChange={(event) => setBusca(event.target.value)}
                adornLeft={<Search />}
                placeholder="Buscar cliente..."
                className="h-7 text-xs"
              />
            </form>
            <SelectNative
              aria-label="Filtrar clientes por status"
              selectSize="sm"
              className="w-[110px]"
              value={filtroStatus}
              onChange={(event) => setFiltroStatus(event.target.value as typeof filtroStatus)}
            >
              <option value="ativo">Ativos</option>
              <option value="todos">Todos</option>
              <option value="inativo">Inativos</option>
            </SelectNative>
          </CardContent>
          <div className="max-h-[560px] overflow-y-auto overflow-x-hidden">
            {carregando ? (
              <p className="p-4 text-center text-xs text-muted-foreground">Carregando…</p>
            ) : clientesVisiveis.length === 0 ? (
              <p className="p-4 text-center text-xs text-muted-foreground">Nenhum cliente encontrado.</p>
            ) : (
              clientesVisiveis.map((cliente) => (
                <button
                  key={cliente.id}
                  type="button"
                  onClick={() => {
                    setNovo(false);
                    setSelecionadoId(cliente.id);
                    limparTudo();
                  }}
                  className={cn(
                    'block w-full border-b border-border px-3 py-2 text-left transition-colors duration-100 hover:bg-surface-2',
                    selecionadoId === cliente.id && 'bg-primary-soft shadow-[inset_2px_0_0_var(--color-primary)]',
                  )}
                >
                  <span className="flex items-center gap-2">
                    <b className="min-w-0 flex-1 truncate text-[13px] font-semibold">
                      {cliente.nomeFantasia || cliente.razaoSocial}
                    </b>
                    <StatusPill
                      variant={cliente.status === 'ativo' ? 'expedido' : 'pendente'}
                      label={cliente.status === 'ativo' ? 'Ativo' : 'Inativo'}
                      className="h-[17px] text-[10px]"
                    />
                  </span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {cliente.razaoSocial} · <span className="font-data">{formatarDocumento(cliente.documentoFiscal)}</span>
                  </span>
                </button>
              ))
            )}
          </div>
        </Card>

        {/* DETAIL */}
        <Card>
          {!form ? (
            <CardContent>
              <EmptyState
                icon={<Building2 />}
                title="Selecione um cliente para visualizar ou editar os detalhes."
              />
            </CardContent>
          ) : (
            <>
              <CardContent className="flex items-center gap-3 border-b border-border p-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-[13px] font-bold text-primary-fg">
                  {iniciaisDe(form.nomeFantasia || form.razaoSocial || 'Novo cliente')}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[16px] font-bold text-foreground">
                    {form.nomeFantasia || form.razaoSocial || 'Novo cliente'}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {form.razaoSocial}
                  </p>
                </div>
                <label className="flex items-center gap-2 text-[13px] font-semibold">
                  <Switch
                    id="cliente-ativo"
                    checked={form.status === 'ativo'}
                    disabled={!podeGerenciar}
                    onCheckedChange={(ativo) => atualizar('status', ativo ? 'ativo' : 'inativo')}
                  />
                  Cliente ativo
                </label>
                {podeGerenciar && (
                  <Button type="submit" form="cliente-form" disabled={salvando}>
                    <Save />
                    Salvar
                  </Button>
                )}
              </CardContent>

              <form id="cliente-form" onSubmit={salvar}>
                <Tabs value={abaAtiva} onValueChange={(valor) => setAbaAtiva(valor as AbaClientes)}>
                  <div className="px-3">
                    <TabsList>
                      {([
                        ['gerais', 'Dados Gerais'],
                        ['fiscais', 'Dados Fiscais & Endereço'],
                        ['contatos', 'Contatos'],
                        ['preferencias', 'Preferências Operacionais'],
                      ] as const).map(([valor, rotulo]) => (
                        <TabsTrigger key={valor} value={valor} temErro={abasComErro.has(valor)}>
                          {rotulo}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </div>

                  <CardContent>
                    <TabsContent value="gerais" className="space-y-3">
                      <div className="flex gap-2 rounded-md border border-primary-soft-border bg-info-soft px-3 py-2 text-xs text-info-fg">
                        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                        <span>
                          <b>Representante e Rota são herdados automaticamente</b> pelo pedido de venda ao
                          selecionar este cliente — não precisam ser escolhidos novamente na venda.
                        </span>
                      </div>
                      <div className="grid grid-cols-1 gap-x-3.5 gap-y-2.5 sm:grid-cols-2">
                        <FormField label="Nome Fantasia/Marca" htmlFor="nome-fantasia" error={erros.nomeFantasia}>
                          <Input
                            id="nome-fantasia"
                            value={form.nomeFantasia ?? ''}
                            maxLength={200}
                            aria-invalid={'nomeFantasia' in erros || undefined}
                            onChange={(event) => {
                              limparCampo('nomeFantasia');
                              atualizar('nomeFantasia', event.target.value);
                            }}
                          />
                        </FormField>
                        <FormField label="Razão Social" htmlFor="razao-social" error={erros.razaoSocial}>
                          <Input
                            id="razao-social"
                            value={form.razaoSocial}
                            maxLength={200}
                            aria-invalid={'razaoSocial' in erros || undefined}
                            onChange={(event) => {
                              limparCampo('razaoSocial');
                              atualizar('razaoSocial', event.target.value);
                            }}
                          />
                        </FormField>
                        <FormField label="CNPJ/CPF" htmlFor="documento-fiscal" error={erros.documentoFiscal}>
                          <Input
                            id="documento-fiscal"
                            value={mascararCpfCnpj(form.documentoFiscal)}
                            aria-invalid={'documentoFiscal' in erros || undefined}
                            onChange={(event) => {
                              limparCampo('documentoFiscal');
                              atualizar('documentoFiscal', mascararCpfCnpj(event.target.value));
                            }}
                          />
                        </FormField>
                        <FormField label="Representante" htmlFor="representante" error={erros.representanteId}>
                          <Select
                            value={form.representanteId ?? 'sem-vinculo'}
                            disabled={!podeGerenciar}
                            onValueChange={(valor) => {
                              limparCampo('representanteId');
                              atualizar('representanteId', valor === 'sem-vinculo' ? null : valor);
                            }}
                          >
                            <SelectTrigger
                              id="representante"
                              aria-label="Representante"
                              aria-invalid={'representanteId' in erros || undefined}
                            >
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
                        </FormField>
                        <FormField label="Itinerário / Rota" htmlFor="itinerario-rota" error={erros.rotaId}>
                          <Select
                            value={form.rotaId ?? 'sem-rota'}
                            disabled={!podeGerenciar}
                            onValueChange={(valor) => {
                              limparCampo('rotaId');
                              atualizar('rotaId', valor === 'sem-rota' ? null : valor);
                            }}
                          >
                            <SelectTrigger
                              id="itinerario-rota"
                              aria-label="Itinerário / Rota"
                              aria-invalid={'rotaId' in erros || undefined}
                            >
                              <SelectValue placeholder="—" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="sem-rota">—</SelectItem>
                              {rotas.map((rota) => (
                                <SelectItem key={rota.id} value={rota.id}>{rota.nome}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormField>
                        <FormField label="Prioridade Padrão" htmlFor="prioridade-padrao" error={erros.prioridade}>
                          <Select
                            value={form.prioridade ?? 'normal'}
                            disabled={!podeGerenciar}
                            onValueChange={(valor) => {
                              limparCampo('prioridade');
                              atualizar('prioridade', valor as 'normal' | 'alta');
                            }}
                          >
                            <SelectTrigger
                              id="prioridade-padrao"
                              aria-label="Prioridade Padrão"
                              aria-invalid={'prioridade' in erros || undefined}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="normal">Normal</SelectItem>
                              <SelectItem value="alta">Alta</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormField>
                      </div>
                    </TabsContent>

                    <TabsContent value="fiscais">
                      <div className="grid grid-cols-1 gap-x-3.5 gap-y-2.5 sm:grid-cols-2">
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
                        ] as const).map(([chave, rotulo, tipo]) => {
                          const chaveErro = `dadosFiscaisJson.${chave}`;
                          return (
                            <FormField key={chave} label={rotulo} htmlFor={`fiscal-${chave}`} error={erros[chaveErro]}>
                              <Input
                                id={`fiscal-${chave}`}
                                type={tipo}
                                value={form.dadosFiscaisJson[chave] ?? ''}
                                maxLength={MAXLENGTH_FISCAL[chave]}
                                aria-invalid={chaveErro in erros || undefined}
                                onChange={(event) => {
                                  const mascara = MASCARA_FISCAL[chave];
                                  const valor = mascara ? mascara(event.target.value) : event.target.value;
                                  limparCampo(chaveErro);
                                  atualizarJson('dadosFiscaisJson', chave, valor);
                                }}
                              />
                            </FormField>
                          );
                        })}
                      </div>
                    </TabsContent>

                    <TabsContent value="contatos">
                      <div className="rounded-lg border border-border p-3">
                        <div className="mb-2.5 flex items-center justify-between">
                          <h3 className="text-[13px] font-semibold text-foreground">Contato principal</h3>
                          <label className="flex items-center gap-2 text-[13px] font-semibold">
                            <Switch
                              id="contato-principal"
                              checked={form.dadosContatoJson.principal === true}
                              disabled={!podeGerenciar}
                              aria-invalid={'dadosContatoJson.principal' in erros || undefined}
                              onCheckedChange={(valor) => {
                                limparCampo('dadosContatoJson.principal');
                                atualizarJson('dadosContatoJson', 'principal', valor);
                              }}
                            />
                            Principal
                          </label>
                        </div>
                        <div className="grid grid-cols-1 gap-x-3.5 gap-y-2.5 sm:grid-cols-2">
                          {([
                            ['nome', 'Nome', 'text'],
                            ['cargo', 'Cargo', 'text'],
                            ['telefone', 'Telefone', 'text'],
                            ['whatsapp', 'WhatsApp', 'text'],
                            ['email', 'E-mail', 'email'],
                          ] as const).map(([chave, rotulo, tipo]) => {
                            const chaveErro = `dadosContatoJson.${chave}`;
                            return (
                              <FormField key={chave} label={rotulo} htmlFor={`contato-${chave}`} error={erros[chaveErro]}>
                                <Input
                                  id={`contato-${chave}`}
                                  type={tipo}
                                  value={form.dadosContatoJson[chave] ?? ''}
                                  maxLength={MAXLENGTH_CONTATO[chave]}
                                  aria-invalid={chaveErro in erros || undefined}
                                  onChange={(event) => {
                                    const mascara = MASCARA_CONTATO[chave];
                                    const valor = mascara ? mascara(event.target.value) : event.target.value;
                                    limparCampo(chaveErro);
                                    atualizarJson('dadosContatoJson', chave, valor);
                                  }}
                                />
                              </FormField>
                            );
                          })}
                          <FormField label="Tipo" htmlFor="contato-tipo" error={erros['dadosContatoJson.tipo']}>
                            <Select
                              value={form.dadosContatoJson.tipo ?? 'compra'}
                              disabled={!podeGerenciar}
                              onValueChange={(valor) => {
                                limparCampo('dadosContatoJson.tipo');
                                atualizarJson('dadosContatoJson', 'tipo', valor);
                              }}
                            >
                              <SelectTrigger
                                id="contato-tipo"
                                aria-label="Tipo do contato"
                                aria-invalid={'dadosContatoJson.tipo' in erros || undefined}
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="compra">Compra</SelectItem>
                                <SelectItem value="financeiro">Financeiro</SelectItem>
                                <SelectItem value="recebimento">Recebimento</SelectItem>
                                <SelectItem value="fiscal">Fiscal</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormField>
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="preferencias" className="space-y-3">
                      <div className="flex gap-2 rounded-md border border-primary-soft-border bg-info-soft px-3 py-2 text-xs text-info-fg">
                        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                        <span>
                          Estas regras serão aplicadas <b>automaticamente</b> na sugestão de associação de
                          peças e na expedição deste cliente.
                        </span>
                      </div>
                      <div className="grid grid-cols-1 gap-x-3.5 gap-y-2.5 sm:grid-cols-2">
                        <FormField
                          label="Faixa de Peso Mínima (kg)"
                          htmlFor="peso-minimo"
                          error={erros['preferenciasJson.faixaPesoMin']}
                        >
                          <Input
                            id="peso-minimo"
                            type="number"
                            adornRight="kg"
                            value={form.preferenciasJson.faixaPesoMin?.toString() ?? ''}
                            aria-invalid={'preferenciasJson.faixaPesoMin' in erros || undefined}
                            onChange={(event) => {
                              limparCampo('preferenciasJson.faixaPesoMin');
                              atualizarJson(
                                'preferenciasJson',
                                'faixaPesoMin',
                                event.target.value === '' ? undefined : Number(event.target.value),
                              );
                            }}
                          />
                        </FormField>
                        <FormField
                          label="Faixa de Peso Máxima (kg)"
                          htmlFor="peso-maximo"
                          error={erros['preferenciasJson.faixaPesoMax']}
                        >
                          <Input
                            id="peso-maximo"
                            type="number"
                            adornRight="kg"
                            value={form.preferenciasJson.faixaPesoMax?.toString() ?? ''}
                            aria-invalid={'preferenciasJson.faixaPesoMax' in erros || undefined}
                            onChange={(event) => {
                              limparCampo('preferenciasJson.faixaPesoMax');
                              atualizarJson(
                                'preferenciasJson',
                                'faixaPesoMax',
                                event.target.value === '' ? undefined : Number(event.target.value),
                              );
                            }}
                          />
                        </FormField>
                        <FormField
                          label="Perfil de Gordura Aceito"
                          htmlFor="perfil-gordura"
                          error={erros['preferenciasJson.perfilGordura']}
                        >
                          <Select
                            value={form.preferenciasJson.perfilGordura ?? 'qualquer'}
                            disabled={!podeGerenciar}
                            onValueChange={(valor) => {
                              limparCampo('preferenciasJson.perfilGordura');
                              atualizarJson('preferenciasJson', 'perfilGordura', valor);
                            }}
                          >
                            <SelectTrigger
                              id="perfil-gordura"
                              aria-label="Perfil de Gordura Aceito"
                              aria-invalid={'preferenciasJson.perfilGordura' in erros || undefined}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="qualquer">Qualquer</SelectItem>
                              <SelectItem value="baixa">Baixa / Média</SelectItem>
                              <SelectItem value="alta">Alta</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormField>
                        <FormField label="Necessita Corte de Acerto?" htmlFor="necessita-corte">
                          <div className="flex h-8 items-center gap-2">
                            <Switch
                              id="necessita-corte"
                              checked={form.preferenciasJson.necessitaCorteAcerto === true}
                              disabled={!podeGerenciar}
                              aria-invalid={'preferenciasJson.necessitaCorteAcerto' in erros || undefined}
                              onCheckedChange={(valor) => {
                                limparCampo('preferenciasJson.necessitaCorteAcerto');
                                atualizarJson('preferenciasJson', 'necessitaCorteAcerto', valor);
                              }}
                            />
                            <Label htmlFor="necessita-corte" className="font-normal normal-case text-muted-foreground">
                              Sim, enviar para mesa de corte
                            </Label>
                          </div>
                        </FormField>
                      </div>
                    </TabsContent>
                  </CardContent>
                </Tabs>
              </form>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
