'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, Plus, Save, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { SelectNative } from '@/components/ui/select-native';
import { StatusPill } from '@/components/ui/status-pill';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader } from '@/components/ui/page-header';
import { cn } from '@/lib/cn';
import type { AbaCadastro, CampoConfig, CadastroConfig } from '@/lib/cadastros-config';
import { ABA_LABELS, ABA_ORDEM, CADASTROS } from '@/lib/cadastros-config';
import type { Paginado } from '@/lib/cadastros';
import { detalharErro, extrairMensagemErro } from '@/lib/error-message';
import { useErrosPorCampo } from '@/lib/use-erros-campo';

type Registro = Record<string, unknown> & { id: string };
type FormValor = string | boolean;
type FormState = Record<string, FormValor>;

interface CadastroMasterDetailProps {
  config: Omit<CadastroConfig, 'schema'>;
  tituloPagina: string;
  subtitulo?: string;
  podeGerenciar: boolean;
  filtrosExtras?: React.ReactNode;
  blocoDetalheExtra?: (registroId: string) => React.ReactNode;
}

function formatDocumento(doc: unknown): string {
  const s = String(doc ?? '');
  if (s.length === 11) return s.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  if (s.length === 14) return s.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  return s;
}

function iniciaisDe(nome: string): string {
  const limpo = nome.trim();
  if (!limpo) return '—';
  return limpo.slice(0, 2).toUpperCase();
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
  erro,
  onChange,
}: {
  campo: CampoConfig;
  form: FormState;
  podeGerenciar: boolean;
  erro?: string;
  onChange: (chave: string, valor: FormValor) => void;
}) {
  const chave = chaveFormulario(campo);
  const desabilitado = !podeGerenciar || campo.nome === 'codigo';
  const valor = form[chave];
  const invalido = erro ? true : undefined;

  if (campo.tipo === 'checkbox') {
    return (
      <label className="flex items-center gap-2 text-[13px] sm:col-span-2">
        <input
          id={chave}
          type="checkbox"
          disabled={desabilitado}
          checked={valor === true}
          onChange={(e) => onChange(chave, e.target.checked)}
          className="size-4 rounded border-input"
        />
        {campo.rotulo}
      </label>
    );
  }

  return (
    <FormField
      label={campo.rotulo}
      htmlFor={chave}
      error={erro}
      className={campo.tipo === 'textarea' ? 'sm:col-span-2' : undefined}
    >
      {campo.tipo === 'select' ? (
        <SelectNative
          id={chave}
          disabled={desabilitado}
          aria-invalid={invalido}
          value={typeof valor === 'string' ? valor : ''}
          onChange={(e) => onChange(chave, e.target.value)}
        >
          {campo.opcoes?.map((op) => (
            <option key={op.valor} value={op.valor}>
              {op.rotulo}
            </option>
          ))}
        </SelectNative>
      ) : campo.tipo === 'textarea' ? (
        <Textarea
          id={chave}
          readOnly={desabilitado}
          aria-invalid={invalido}
          maxLength={campo.maxLength}
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
          aria-invalid={invalido}
          maxLength={campo.maxLength}
          placeholder={campo.placeholder}
          value={typeof valor === 'string' ? valor : ''}
          onChange={(e) => onChange(chave, campo.mascara ? campo.mascara(e.target.value) : e.target.value)}
        />
      )}
    </FormField>
  );
}

export function CadastroMasterDetail({
  config,
  tituloPagina,
  subtitulo,
  podeGerenciar,
  filtrosExtras,
  blocoDetalheExtra,
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
  const { erros, setErros, limparCampo, limparTudo } = useErrosPorCampo();

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
        setErro(extrairMensagemErro(body, 'Erro ao carregar lista'));
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
    limparTudo();
    try {
      const res = await fetch(`/api/cadastros/${config.recurso}/${id}`, { cache: 'no-store' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setErro(extrairMensagemErro(body, 'Erro ao carregar registro'));
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
    limparTudo();
    try {
      const payload = montarPayload(config, form);
      const res = await fetch(`/api/cadastros/${config.recurso}/${detalhe.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const { mensagem: msgErro, porCampo } = await detalharErro(res, 'Falha ao salvar');
        setErro(msgErro);
        setErros(porCampo);
        if (usaAbas) {
          const abaComErro = abasPresentes.find((aba) =>
            (camposPorAba.get(aba) ?? []).some((c) => chaveFormulario(c) in porCampo),
          );
          if (abaComErro) setAbaAtiva(abaComErro);
        }
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
    limparCampo(chave);
    setForm((f) => ({ ...f, [chave]: valor }));
  }

  function renderCampos(campos: CampoConfig[]) {
    return (
      <div className="grid grid-cols-1 gap-x-3.5 gap-y-2.5 sm:grid-cols-2">
        {campos.map((campo) => (
          <CampoFormulario
            key={chaveFormulario(campo)}
            campo={campo}
            form={form}
            podeGerenciar={podeGerenciar}
            erro={erros[chaveFormulario(campo)]}
            onChange={handleCampoChange}
          />
        ))}
      </div>
    );
  }

  const ativos = lista.filter((r) => r.status === 'ativo').length;

  return (
    <div className="space-y-3">
      <PageHeader title={tituloPagina} subtitle={subtitulo}>
        <span className="text-xs text-muted-foreground">
          Total: {total} {total === 1 ? 'registro' : 'registros'}
          {lista.length > 0 && ` · ${ativos} ativo(s)`}
        </span>
      </PageHeader>

      {erro && (
        <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {erro}
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
          <CardContent className="flex flex-col gap-1.5 p-2.5 pb-1.5">
            <form onSubmit={handleBusca} className="flex gap-1.5">
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                adornLeft={<Search />}
                placeholder="Buscar..."
                className="h-7 text-xs"
              />
              {podeGerenciar && (
                <Button type="button" size="iconSm" variant="secondary" asChild>
                  <a href={`/cadastros/${config.recurso}/novo`} aria-label="Novo">
                    <Plus />
                  </a>
                </Button>
              )}
            </form>
            {filtrosExtras}
          </CardContent>
          <div className="max-h-[560px] overflow-y-auto overflow-x-hidden">
            {carregando ? (
              <p className="p-4 text-center text-xs text-muted-foreground">Carregando…</p>
            ) : lista.length === 0 ? (
              <p className="p-4 text-center text-xs text-muted-foreground">Nenhum registro encontrado.</p>
            ) : (
              lista.map((item) => {
                const ativo = item.status === 'ativo';
                const label = String(item.nomeFantasia ?? item.razaoSocial ?? item.codigo ?? item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelecionadoId(item.id)}
                    className={cn(
                      'block w-full border-b border-border px-3 py-2 text-left transition-colors duration-100 hover:bg-surface-2',
                      selecionadoId === item.id && 'bg-primary-soft shadow-[inset_2px_0_0_var(--color-primary)]',
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <b className="min-w-0 flex-1 truncate text-[13px] font-semibold">{label}</b>
                      <StatusPill
                        variant={ativo ? 'expedido' : 'pendente'}
                        label={String(item.status ?? '—')}
                        className="h-[17px] text-[10px]"
                      />
                    </span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      <span className="font-data">{formatDocumento(item.documentoFiscal)}</span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </Card>

        {/* DETAIL */}
        <Card>
          {!detalhe ? (
            <CardContent>
              <EmptyState
                icon={<Building2 />}
                title="Selecione um registro para visualizar ou editar."
              />
            </CardContent>
          ) : (
            <>
              <CardContent className="flex items-center gap-3 border-b border-border p-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-[13px] font-bold text-primary-fg">
                  {iniciaisDe(String(detalhe.nomeFantasia ?? detalhe.razaoSocial ?? detalhe.codigo ?? ''))}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[16px] font-bold text-foreground">
                    {String(detalhe.nomeFantasia ?? detalhe.razaoSocial ?? detalhe.codigo)}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{String(detalhe.razaoSocial ?? '')}</p>
                </div>
                {podeGerenciar && (
                  <Button type="submit" form="cadastro-md-form" disabled={salvando}>
                    <Save />
                    Salvar
                  </Button>
                )}
              </CardContent>
              <form id="cadastro-md-form" onSubmit={handleSalvar}>
                <CardContent>
                  {config.secoes ? (
                    <div className="grid grid-cols-2 gap-6">
                      {([1, 2] as const).map((coluna) => (
                        <div key={coluna} className="space-y-4">
                          {config.secoes
                            ?.filter((secao) => secao.coluna === coluna)
                            .map((secao) => {
                              const Icone = secao.icone;
                              return (
                                <section key={secao.chave} className="space-y-3">
                                  <h3 className="flex items-center gap-2 border-b border-border pb-2 text-[13px] font-bold text-foreground">
                                    <Icone className="size-4 text-muted-foreground" />
                                    {secao.titulo}
                                  </h3>
                                  {renderCampos(config.campos.filter((campo) => campo.secao === secao.chave))}
                                </section>
                              );
                            })}
                          {coluna === 2 && selecionadoId && blocoDetalheExtra?.(selecionadoId)}
                        </div>
                      ))}
                    </div>
                  ) : usaAbas ? (
                    <Tabs value={abaAtiva} onValueChange={setAbaAtiva}>
                      <TabsList>
                        {abasPresentes.map((aba) => (
                          <TabsTrigger
                            key={aba}
                            value={aba}
                            temErro={(camposPorAba.get(aba) ?? []).some((c) => chaveFormulario(c) in erros)}
                          >
                            {ABA_LABELS[aba]}
                          </TabsTrigger>
                        ))}
                      </TabsList>
                      {abasPresentes.map((aba) => (
                        <TabsContent key={aba} value={aba}>
                          {renderCampos(camposPorAba.get(aba) ?? [])}
                        </TabsContent>
                      ))}
                    </Tabs>
                  ) : (
                    renderCampos(camposPorAba.get('default') ?? config.campos)
                  )}
                </CardContent>
              </form>
            </>
          )}
        </Card>
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
