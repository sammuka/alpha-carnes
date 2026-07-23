'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, Plus, Save, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { AbaCadastro, CampoConfig, CadastroConfig } from '@/lib/cadastros-config';
import { ABA_LABELS, ABA_ORDEM, CADASTROS } from '@/lib/cadastros-config';
import type { Paginado } from '@/lib/cadastros';

type Registro = Record<string, unknown> & { id: string };
type FormValor = string | boolean;
type FormState = Record<string, FormValor>;

interface CadastroMasterDetailProps {
  config: Omit<CadastroConfig, 'schema'>;
  tituloPagina: string;
  subtitulo?: string;
  podeGerenciar: boolean;
}

function formatDocumento(doc: unknown): string {
  const s = String(doc ?? '');
  if (s.length === 11) return s.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  if (s.length === 14) return s.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  return s;
}

function chaveFormulario(campo: CampoConfig): string {
  return campo.jsonCampo ? `${campo.jsonCampo}.${campo.nome}` : campo.nome;
}

function lerValorCampo(reg: Registro, campo: CampoConfig): FormValor {
  if (campo.jsonCampo) {
    const json = reg[campo.jsonCampo];
    const obj = json && typeof json === 'object' && !Array.isArray(json) ? (json as Record<string, unknown>) : {};
    const v = obj[campo.nome];
    if (campo.tipo === 'checkbox') return v === true;
    return v == null ? '' : String(v);
  }
  const v = reg[campo.nome];
  if (campo.tipo === 'checkbox') return v === true;
  return v == null ? '' : String(v);
}

function montarPayload(config: Omit<CadastroConfig, 'schema'>, form: FormState): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  const jsonBuckets = new Map<string, Record<string, unknown>>();

  for (const campo of config.campos) {
    const chave = chaveFormulario(campo);
    const valor = form[chave];

    if (campo.jsonCampo) {
      if (!jsonBuckets.has(campo.jsonCampo)) {
        jsonBuckets.set(campo.jsonCampo, {});
      }
      const bucket = jsonBuckets.get(campo.jsonCampo)!;
      if (campo.tipo === 'checkbox') {
        bucket[campo.nome] = valor === true;
      } else {
        bucket[campo.nome] = typeof valor === 'string' ? valor : '';
      }
      continue;
    }

    if (campo.tipo === 'checkbox') {
      payload[campo.nome] = valor === true;
    } else {
      const str = typeof valor === 'string' ? valor : String(valor ?? '');
      if (campo.nome === 'representanteId' && str.trim() === '') {
        continue;
      }
      payload[campo.nome] = str;
    }
  }

  for (const [jsonCampo, obj] of jsonBuckets) {
    payload[jsonCampo] = obj;
  }

  return payload;
}

function CampoFormulario({
  campo,
  form,
  podeGerenciar,
  onChange,
}: {
  campo: CampoConfig;
  form: FormState;
  podeGerenciar: boolean;
  onChange: (chave: string, valor: FormValor) => void;
}) {
  const chave = chaveFormulario(campo);
  const desabilitado = !podeGerenciar || campo.nome === 'codigo';
  const valor = form[chave];

  if (campo.tipo === 'checkbox') {
    return (
      <div className="flex items-center gap-2 sm:col-span-2">
        <input
          id={chave}
          type="checkbox"
          disabled={desabilitado}
          checked={valor === true}
          onChange={(e) => onChange(chave, e.target.checked)}
          className="h-4 w-4 rounded border-input"
        />
        <Label htmlFor={chave} className="cursor-pointer font-normal">
          {campo.rotulo}
        </Label>
      </div>
    );
  }

  return (
    <div className={`space-y-1.5 ${campo.tipo === 'textarea' ? 'sm:col-span-2' : ''}`}>
      <Label htmlFor={chave}>{campo.rotulo}</Label>
      {campo.tipo === 'select' ? (
        <select
          id={chave}
          disabled={desabilitado}
          className="flex h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
          value={typeof valor === 'string' ? valor : ''}
          onChange={(e) => onChange(chave, e.target.value)}
        >
          {campo.opcoes?.map((op) => (
            <option key={op.valor} value={op.valor}>
              {op.rotulo}
            </option>
          ))}
        </select>
      ) : campo.tipo === 'textarea' ? (
        <Textarea
          id={chave}
          readOnly={desabilitado}
          placeholder={campo.placeholder}
          value={typeof valor === 'string' ? valor : ''}
          onChange={(e) => onChange(chave, e.target.value)}
          rows={3}
        />
      ) : (
        <Input
          id={chave}
          type={campo.tipo === 'number' ? 'number' : campo.tipo === 'date' ? 'date' : 'text'}
          readOnly={desabilitado}
          placeholder={campo.placeholder}
          value={typeof valor === 'string' ? valor : ''}
          onChange={(e) => onChange(chave, e.target.value)}
        />
      )}
    </div>
  );
}

export function CadastroMasterDetail({
  config,
  tituloPagina,
  subtitulo,
  podeGerenciar,
}: CadastroMasterDetailProps) {
  const [busca, setBusca] = useState('');
  const [lista, setLista] = useState<Registro[]>([]);
  const [total, setTotal] = useState(0);
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<Registro | null>(null);
  const [form, setForm] = useState<FormState>({});
  const [abaAtiva, setAbaAtiva] = useState<string>('gerais');
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);

  const usaAbas = useMemo(() => config.campos.some((c) => c.aba != null), [config.campos]);

  const abasPresentes = useMemo(() => {
    const set = new Set<AbaCadastro>();
    for (const campo of config.campos) {
      if (campo.aba) set.add(campo.aba);
    }
    return ABA_ORDEM.filter((a) => set.has(a));
  }, [config.campos]);

  const camposPorAba = useMemo(() => {
    const map = new Map<AbaCadastro | 'default', CampoConfig[]>();
    for (const campo of config.campos) {
      const aba = campo.aba ?? 'default';
      const listaCampos = map.get(aba) ?? [];
      listaCampos.push(campo);
      map.set(aba, listaCampos);
    }
    return map;
  }, [config.campos]);

  const carregarLista = useCallback(async (search?: string) => {
    setCarregando(true);
    setErro(null);
    try {
      const qs = new URLSearchParams();
      if (search) qs.set('search', search);
      const res = await fetch(`/api/cadastros/${config.recurso}?${qs.toString()}`, { cache: 'no-store' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setErro((body as { message?: string }).message ?? 'Erro ao carregar lista');
        setLista([]);
        return;
      }
      const paginado = (await res.json()) as Paginado<Registro>;
      setLista(paginado.data);
      setTotal(paginado.total);
    } catch {
      setErro('Erro de conexão');
    } finally {
      setCarregando(false);
    }
  }, [config.recurso]);

  const carregarDetalhe = useCallback(async (id: string) => {
    setErro(null);
    try {
      const res = await fetch(`/api/cadastros/${config.recurso}/${id}`, { cache: 'no-store' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setErro((body as { message?: string }).message ?? 'Erro ao carregar registro');
        return;
      }
      const reg = (await res.json()) as Registro;
      setDetalhe(reg);
      const valores: FormState = {};
      for (const campo of config.campos) {
        valores[chaveFormulario(campo)] = lerValorCampo(reg, campo);
      }
      setForm(valores);
    } catch {
      setErro('Erro de conexão');
    }
  }, [config.campos, config.recurso]);

  useEffect(() => {
    void carregarLista();
  }, [carregarLista]);

  useEffect(() => {
    const primeiro = lista[0];
    if (!selecionadoId && primeiro) {
      setSelecionadoId(primeiro.id);
    }
  }, [lista, selecionadoId]);

  useEffect(() => {
    if (selecionadoId) void carregarDetalhe(selecionadoId);
  }, [selecionadoId, carregarDetalhe]);

  useEffect(() => {
    if (abasPresentes.length > 0 && !abasPresentes.includes(abaAtiva as AbaCadastro)) {
      setAbaAtiva(abasPresentes[0]!);
    }
  }, [abasPresentes, abaAtiva]);

  async function handleBusca(e: React.FormEvent) {
    e.preventDefault();
    setSelecionadoId(null);
    await carregarLista(busca.trim() || undefined);
  }

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault();
    if (!detalhe || !podeGerenciar) return;
    setSalvando(true);
    setMensagem(null);
    setErro(null);
    try {
      const payload = montarPayload(config, form);
      const res = await fetch(`/api/cadastros/${config.recurso}/${detalhe.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setErro((body as { message?: string }).message ?? 'Falha ao salvar');
        return;
      }
      setMensagem('Alterações salvas.');
      await carregarLista(busca.trim() || undefined);
      await carregarDetalhe(detalhe.id);
    } catch {
      setErro('Erro de conexão');
    } finally {
      setSalvando(false);
    }
  }

  function handleCampoChange(chave: string, valor: FormValor) {
    setForm((f) => ({ ...f, [chave]: valor }));
  }

  function renderCampos(campos: CampoConfig[]) {
    return (
      <div className="grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2">
        {campos.map((campo) => (
          <CampoFormulario
            key={chaveFormulario(campo)}
            campo={campo}
            form={form}
            podeGerenciar={podeGerenciar}
            onChange={handleCampoChange}
          />
        ))}
      </div>
    );
  }

  const ativos = lista.filter((r) => r.status === 'ativo').length;

  return (
    <div className="flex h-full min-h-[calc(100vh-8rem)] flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{tituloPagina}</h1>
          {subtitulo && <p className="mt-1 text-sm text-muted-foreground">{subtitulo}</p>}
        </div>
        <Badge variant="outline" className="border-border bg-card text-foreground">
          Total: {total} {total === 1 ? 'registro' : 'registros'}
          {lista.length > 0 && ` · ${ativos} ativo(s)`}
        </Badge>
      </div>

      {erro && (
        <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {erro}
        </div>
      )}
      {mensagem && (
        <div className="rounded-xl border border-[var(--color-status-expedido)]/30 bg-[var(--color-status-expedido-bg)] p-3 text-sm text-[var(--color-status-expedido)]">
          {mensagem}
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col gap-6 lg:flex-row">
        <div className="flex w-full shrink-0 flex-col rounded-xl border border-border bg-card shadow-sm lg:w-[400px]">
          <div className="space-y-3 border-b border-border p-4">
            <form onSubmit={handleBusca} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="h-9 pl-9"
                  placeholder="Buscar..."
                />
              </div>
              {podeGerenciar && (
                <Button type="button" size="icon" className="h-9 w-9 shrink-0" asChild>
                  <a href={`/cadastros/${config.recurso}/novo`} aria-label="Novo">
                    <Plus className="h-4 w-4" />
                  </a>
                </Button>
              )}
            </form>
          </div>
          <div className="flex-1 overflow-auto p-2">
            {carregando ? (
              <p className="p-4 text-center text-sm text-muted-foreground">Carregando…</p>
            ) : lista.length === 0 ? (
              <p className="p-4 text-center text-sm text-muted-foreground">Nenhum registro encontrado.</p>
            ) : (
              <div className="space-y-1">
                {lista.map((item) => {
                  const ativo = item.status === 'ativo';
                  const label =
                    String(item.nomeFantasia ?? item.razaoSocial ?? item.codigo ?? item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelecionadoId(item.id)}
                      className={`w-full rounded-lg border p-3 text-left transition-colors ${
                        selecionadoId === item.id
                          ? 'border-primary bg-accent shadow-sm'
                          : 'border-transparent hover:bg-muted/50'
                      }`}
                    >
                      <div className="mb-1 flex items-start justify-between gap-2">
                        <span
                          className={`truncate text-sm font-bold ${
                            selecionadoId === item.id ? 'text-primary' : 'text-foreground'
                          }`}
                        >
                          {label}
                        </span>
                        <Badge
                          variant="outline"
                          className={`shrink-0 border-none text-[10px] uppercase ${
                            ativo
                              ? 'bg-[var(--color-status-expedido-bg)] text-[var(--color-status-expedido)]'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {String(item.status ?? '—')}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDocumento(item.documentoFiscal)}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col rounded-xl border border-border bg-card shadow-sm">
          {!detalhe ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-muted-foreground">
              <Building2 className="h-12 w-12 opacity-20" />
              <p className="text-sm">Selecione um registro para visualizar ou editar.</p>
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
                      {String(detalhe.nomeFantasia ?? detalhe.razaoSocial ?? detalhe.codigo)}
                    </h2>
                    <p className="text-sm text-muted-foreground">{String(detalhe.razaoSocial ?? '')}</p>
                  </div>
                </div>
                {podeGerenciar && (
                  <Button
                    type="submit"
                    form="cadastro-md-form"
                    disabled={salvando}
                    className="gap-2"
                    style={{ background: 'var(--color-primary)' }}
                  >
                    <Save className="h-4 w-4" />
                    Salvar
                  </Button>
                )}
              </div>
              <form id="cadastro-md-form" onSubmit={handleSalvar} className="flex-1 overflow-auto p-6">
                {usaAbas ? (
                  <Tabs value={abaAtiva} onValueChange={setAbaAtiva} className="gap-4">
                    <TabsList>
                      {abasPresentes.map((aba) => (
                        <TabsTrigger key={aba} value={aba}>
                          {ABA_LABELS[aba]}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                    {abasPresentes.map((aba) => (
                      <TabsContent key={aba} value={aba} className="mt-4">
                        {renderCampos(camposPorAba.get(aba) ?? [])}
                      </TabsContent>
                    ))}
                  </Tabs>
                ) : (
                  renderCampos(camposPorAba.get('default') ?? config.campos)
                )}
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function getCadastroConfigSemSchema(recurso: string) {
  const config = CADASTROS[recurso];
  if (!config) return null;
  const { schema: _s, ...rest } = config;
  void _s;
  return rest;
}
