'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Map, MapPin, Plus, Search, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { FilterChip } from '@/components/ui/filter-chip';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/ui/page-header';
import { StatusPill } from '@/components/ui/status-pill';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/cn';
import type { CriarRotaDto, Paginado, ParadaRota, Rota } from '@/lib/rotas';
import { DIAS_SEMANA } from '@/lib/rotas';

type FormRota = CriarRotaDto & { id?: string };

const FORM_VAZIO: FormRota = {
  codigo: '',
  nome: '',
  regiao: '',
  representantePadrao: '',
  caminhaoPadrao: '',
  motoristaPadrao: '',
  observacoes: '',
  status: 'ativo',
  paradas: [],
  diasAtendimento: [],
};

function rotaParaForm(r: Rota): FormRota {
  return {
    id: r.id,
    codigo: r.codigo,
    nome: r.nome,
    regiao: r.regiao ?? '',
    representantePadrao: r.representantePadrao ?? '',
    caminhaoPadrao: r.caminhaoPadrao ?? '',
    motoristaPadrao: r.motoristaPadrao ?? '',
    observacoes: r.observacoes ?? '',
    status: r.status,
    paradas: r.paradas ?? [],
    diasAtendimento: r.diasAtendimento ?? [],
  };
}

function formParaPayload(form: FormRota): CriarRotaDto {
  return {
    codigo: form.codigo.trim(),
    nome: form.nome.trim(),
    regiao: form.regiao?.trim() || undefined,
    representantePadrao: form.representantePadrao?.trim() || undefined,
    caminhaoPadrao: form.caminhaoPadrao?.trim() || undefined,
    motoristaPadrao: form.motoristaPadrao?.trim() || undefined,
    observacoes: form.observacoes?.trim() || undefined,
    status: form.status,
    paradas: form.paradas,
    diasAtendimento: form.diasAtendimento,
  };
}

export function RotasClient({ permissoes }: { permissoes: string[] }) {
  const podeGerenciar = permissoes.includes('ROTAS_GERENCIAR');

  const [busca, setBusca] = useState('');
  const [rotas, setRotas] = useState<Rota[]>([]);
  const [selecionada, setSelecionada] = useState<Rota | null>(null);
  const [form, setForm] = useState<FormRota>(FORM_VAZIO);
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [modoNovo, setModoNovo] = useState(false);

  const carregar = useCallback(async () => {
    setErro(null);
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: '1', pageSize: '100' });
      if (busca.trim()) params.set('search', busca.trim());
      const res = await fetch(`/api/cadastros/rotas?${params}`, { cache: 'no-store' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setErro((body as { message?: string }).message ?? 'Falha ao carregar rotas');
        return;
      }
      const resultado = (await res.json()) as Paginado<Rota>;
      setRotas(resultado.data);
    } catch {
      setErro('Erro de conexão');
    } finally {
      setLoading(false);
    }
  }, [busca]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const selecionar = (r: Rota) => {
    setSelecionada(r);
    setForm(rotaParaForm(r));
    setModoNovo(false);
  };

  const iniciarNova = () => {
    setSelecionada(null);
    setForm({ ...FORM_VAZIO });
    setModoNovo(true);
  };

  const cancelar = () => {
    if (selecionada) {
      setForm(rotaParaForm(selecionada));
    } else {
      setForm({ ...FORM_VAZIO });
      setModoNovo(false);
    }
  };

  const setCampo = <K extends keyof FormRota>(key: K, val: FormRota[K]) =>
    setForm((f) => ({ ...f, [key]: val }));

  const renumerar = (lista: ParadaRota[]) =>
    lista.map((parada, indice) => ({ ordem: indice + 1, descricao: parada.descricao }));

  const adicionarParada = () =>
    setCampo('paradas', renumerar([...form.paradas, { ordem: form.paradas.length + 1, descricao: '' }]));

  const atualizarParada = (indice: number, descricao: string) =>
    setCampo(
      'paradas',
      form.paradas.map((parada, i) => (i === indice ? { ...parada, descricao } : parada)),
    );

  const removerParada = (indice: number) =>
    setCampo('paradas', renumerar(form.paradas.filter((_, i) => i !== indice)));

  const moverParada = (indice: number, delta: number) => {
    const destino = indice + delta;
    if (destino < 0 || destino >= form.paradas.length) return;
    const lista = [...form.paradas];
    const atual = lista[indice];
    const outro = lista[destino];
    if (!atual || !outro) return;
    lista[indice] = outro;
    lista[destino] = atual;
    setCampo('paradas', renumerar(lista));
  };

  const alternarDia = (dia: string) =>
    setCampo(
      'diasAtendimento',
      form.diasAtendimento.includes(dia)
        ? form.diasAtendimento.filter((d) => d !== dia)
        : [...form.diasAtendimento, dia],
    );

  const salvar = async () => {
    if (!podeGerenciar) return;
    if (!form.codigo.trim() || !form.nome.trim()) {
      setErro('Preencha código e nome da rota.');
      return;
    }
    if (form.paradas.some((parada) => parada.descricao.trim() === '')) {
      setErro('Informe a descrição de todas as paradas.');
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const payload = formParaPayload(form);
      const res = form.id
        ? await fetch(`/api/cadastros/rotas/${form.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch('/api/cadastros/rotas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setErro((body as { message?: string }).message ?? 'Falha ao salvar rota');
        return;
      }
      const salva = (await res.json()) as Rota;
      setSelecionada(salva);
      setForm(rotaParaForm(salva));
      setModoNovo(false);
      void carregar();
    } catch {
      setErro('Erro de conexão');
    } finally {
      setSalvando(false);
    }
  };

  const excluir = async () => {
    if (!podeGerenciar || !form.id) return;
    if (!window.confirm('Deseja remover esta rota?')) return;
    setErro(null);
    try {
      const res = await fetch(`/api/cadastros/rotas/${form.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setErro((body as { message?: string }).message ?? 'Falha ao remover rota');
        return;
      }
      setSelecionada(null);
      setForm({ ...FORM_VAZIO });
      setModoNovo(false);
      void carregar();
    } catch {
      setErro('Erro de conexão');
    }
  };

  const painelAtivo = modoNovo || !!selecionada;

  return (
    <div className="space-y-3">
      <PageHeader title="Rotas / Itinerários">
        {podeGerenciar && (
          <Button size="sm" onClick={iniciarNova}>
            <Plus />
            Novo
          </Button>
        )}
      </PageHeader>

      {erro && (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {erro}
        </p>
      )}

      <div className="grid items-start gap-2.5 lg:grid-cols-[320px_1fr]">
        {/* MASTER */}
        <Card>
          <CardContent className="flex gap-1.5 p-2.5 pb-1.5">
            <Input
              adornLeft={<Search />}
              placeholder="Buscar rota..."
              className="h-7 text-xs"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </CardContent>
          <div className="max-h-[560px] overflow-y-auto overflow-x-hidden">
            {loading ? (
              <p className="p-4 text-center text-xs text-muted-foreground">Carregando...</p>
            ) : rotas.length === 0 ? (
              <p className="p-4 text-center text-xs text-muted-foreground">Nenhuma rota cadastrada.</p>
            ) : (
              rotas.map((rota) => (
                <button
                  key={rota.id}
                  type="button"
                  onClick={() => selecionar(rota)}
                  className={cn(
                    'block w-full border-b border-border px-3 py-2 text-left transition-colors duration-100 hover:bg-surface-2',
                    selecionada?.id === rota.id && 'bg-primary-soft shadow-[inset_2px_0_0_var(--color-primary)]',
                  )}
                >
                  <span className="flex items-center gap-2">
                    <b className="min-w-0 flex-1 truncate text-[13px] font-semibold">{rota.nome}</b>
                    <StatusPill
                      variant={rota.status === 'ativo' ? 'expedido' : 'pendente'}
                      label={rota.status === 'ativo' ? 'Ativo' : 'Inativo'}
                      className="h-[17px] text-[10px]"
                    />
                  </span>
                  <span className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1 truncate">
                      <MapPin className="size-3 shrink-0" />
                      {rota.regiao ?? rota.codigo}
                    </span>
                    <span className="font-data">{rota.codigo}</span>
                  </span>
                </button>
              ))
            )}
          </div>
        </Card>

        {/* DETAIL */}
        <Card>
          {!painelAtivo ? (
            <CardContent>
              <EmptyState icon={<Map />} title="Selecione uma rota para visualizar ou editar" />
            </CardContent>
          ) : (
            <>
              <CardContent className="flex items-center gap-3 border-b border-border p-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-fg">
                  <Map className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[16px] font-bold text-foreground">{modoNovo ? 'Nova Rota' : form.nome}</div>
                  {!modoNovo && form.id && (
                    <p className="truncate text-xs text-muted-foreground">
                      Código: {form.codigo} · <span className="font-data">{form.id.slice(0, 8)}</span>
                    </p>
                  )}
                </div>
                {podeGerenciar && (
                  <div className="flex gap-2">
                    <Button variant="ghost" onClick={cancelar}>
                      Cancelar
                    </Button>
                    {form.id && (
                      <Button variant="destructive" onClick={() => void excluir()}>
                        Remover
                      </Button>
                    )}
                    <Button onClick={() => void salvar()} disabled={salvando}>
                      {salvando ? 'Salvando...' : 'Salvar Alterações'}
                    </Button>
                  </div>
                )}
              </CardContent>

              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 gap-x-3.5 gap-y-2.5 sm:grid-cols-2">
                  <FormField label="Nome da Rota" htmlFor="nome">
                    <Input
                      id="nome"
                      value={form.nome}
                      disabled={!podeGerenciar}
                      onChange={(e) => setCampo('nome', e.target.value)}
                    />
                  </FormField>
                  <FormField label="Código Rápido" htmlFor="codigo">
                    <Input
                      id="codigo"
                      value={form.codigo}
                      disabled={!podeGerenciar || (!modoNovo && !!form.id)}
                      onChange={(e) => setCampo('codigo', e.target.value)}
                    />
                  </FormField>
                  <FormField label="Região" htmlFor="regiao">
                    <Input
                      id="regiao"
                      value={form.regiao ?? ''}
                      disabled={!podeGerenciar}
                      onChange={(e) => setCampo('regiao', e.target.value)}
                    />
                  </FormField>
                  <FormField label="Representante padrão" htmlFor="representante">
                    <Input
                      id="representante"
                      value={form.representantePadrao ?? ''}
                      disabled={!podeGerenciar}
                      onChange={(e) => setCampo('representantePadrao', e.target.value)}
                    />
                  </FormField>
                  <FormField label="Caminhão padrão" htmlFor="caminhao">
                    <Input
                      id="caminhao"
                      value={form.caminhaoPadrao ?? ''}
                      disabled={!podeGerenciar}
                      onChange={(e) => setCampo('caminhaoPadrao', e.target.value)}
                    />
                  </FormField>
                  <FormField label="Motorista padrão" htmlFor="motorista">
                    <Input
                      id="motorista"
                      value={form.motoristaPadrao ?? ''}
                      disabled={!podeGerenciar}
                      onChange={(e) => setCampo('motoristaPadrao', e.target.value)}
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
                      disabled={!podeGerenciar}
                      onCheckedChange={(v) => setCampo('status', v ? 'ativo' : 'inativo')}
                    />
                  </div>
                </div>

                <FormField label="Observações" htmlFor="observacoes">
                  <Textarea
                    id="observacoes"
                    value={form.observacoes ?? ''}
                    disabled={!podeGerenciar}
                    onChange={(e) => setCampo('observacoes', e.target.value)}
                    rows={4}
                  />
                </FormField>

                <div className="space-y-2">
                  <div className="flex items-center justify-between border-b border-border pb-2">
                    <h3 className="text-[11px] font-bold uppercase tracking-[0.04em] text-muted-foreground">
                      Sequência de Paradas / Bairros
                    </h3>
                    <span className="text-xs text-muted-foreground">
                      {form.paradas.length} {form.paradas.length === 1 ? 'parada' : 'paradas'}
                    </span>
                  </div>

                  {form.paradas.length === 0 && (
                    <EmptyState title="Nenhuma parada cadastrada nesta rota." />
                  )}

                  {form.paradas.map((parada, indice) => (
                    <div key={parada.ordem} className="flex items-center gap-2 rounded-md border border-border bg-surface-2 p-2">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-3 text-[11px] font-bold text-fg-secondary">
                        {indice + 1}
                      </span>
                      <Input
                        aria-label={`Parada ${indice + 1}`}
                        className="flex-1"
                        value={parada.descricao}
                        disabled={!podeGerenciar}
                        onChange={(e) => atualizarParada(indice, e.target.value)}
                      />
                      <Button
                        variant="ghost"
                        size="iconSm"
                        aria-label="Subir parada"
                        disabled={!podeGerenciar || indice === 0}
                        onClick={() => moverParada(indice, -1)}
                      >
                        <ArrowUp />
                      </Button>
                      <Button
                        variant="ghost"
                        size="iconSm"
                        aria-label="Descer parada"
                        disabled={!podeGerenciar || indice === form.paradas.length - 1}
                        onClick={() => moverParada(indice, 1)}
                      >
                        <ArrowDown />
                      </Button>
                      <Button
                        variant="ghost"
                        size="iconSm"
                        aria-label="Remover parada"
                        disabled={!podeGerenciar}
                        onClick={() => removerParada(indice)}
                      >
                        <Trash2 className="text-destructive" />
                      </Button>
                    </div>
                  ))}

                  {podeGerenciar && (
                    <Button type="button" variant="secondary" size="sm" className="w-full" onClick={adicionarParada}>
                      <Plus />
                      Adicionar Parada
                    </Button>
                  )}
                </div>

                <div className="space-y-2">
                  <h3 className="border-b border-border pb-2 text-[11px] font-bold uppercase tracking-[0.04em] text-muted-foreground">
                    Dias de Atendimento
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {DIAS_SEMANA.map((dia) => {
                      const marcado = form.diasAtendimento.includes(dia.valor);
                      return (
                        <FilterChip
                          key={dia.valor}
                          active={marcado}
                          disabled={!podeGerenciar}
                          onClick={() => alternarDia(dia.valor)}
                        >
                          {dia.rotulo}
                        </FilterChip>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
