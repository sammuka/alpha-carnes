'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Map, MapPin, MoveVertical, Plus, Search, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
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
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-4">
      <div>
        <p className="mb-1 text-xs font-medium text-muted-foreground">Cadastros & Regras / Rotas</p>
        <h1 className="text-2xl font-bold tracking-tight">Rotas / Itinerários</h1>
      </div>

      {erro && (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {erro}
        </p>
      )}

      <div className="flex min-h-0 flex-1 gap-6">
        <Card className="flex w-1/3 min-w-[280px] flex-col overflow-hidden py-0">
          <div className="flex flex-col gap-4 border-b p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Itinerários / Rotas</h2>
              {podeGerenciar && (
                <Button size="sm" onClick={iniciarNova}>
                  <Plus className="mr-1 size-4" />
                  Novo
                </Button>
              )}
            </div>
            <div className="relative">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar rota..."
                className="pl-9"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
          </div>

          <div className="flex-1 space-y-2 overflow-auto bg-muted/30 p-2">
            {loading ? (
              <p className="p-4 text-center text-sm text-muted-foreground">Carregando...</p>
            ) : rotas.length === 0 ? (
              <p className="p-4 text-center text-sm text-muted-foreground">Nenhuma rota cadastrada.</p>
            ) : (
              rotas.map((rota) => (
                <button
                  key={rota.id}
                  type="button"
                  onClick={() => selecionar(rota)}
                  className={`w-full rounded-md border p-4 text-left transition-colors ${
                    selecionada?.id === rota.id
                      ? 'border-primary bg-background shadow-sm'
                      : 'border-transparent bg-background hover:border-border'
                  }`}
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <span className="text-sm font-bold">{rota.nome}</span>
                    <Badge
                      variant="outline"
                      className={
                        rota.status === 'ativo'
                          ? 'border-green-200 bg-green-50 text-green-700'
                          : 'border-muted bg-muted/50 text-muted-foreground'
                      }
                    >
                      {rota.status === 'ativo' ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <MapPin className="size-3" />
                      {rota.regiao ?? rota.codigo}
                    </span>
                    <span>{rota.codigo}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </Card>

        <Card className="flex flex-1 flex-col overflow-hidden py-0">
          {painelAtivo ? (
            <>
              <div className="flex items-center justify-between border-b bg-muted/30 p-6">
                <div className="flex items-center gap-4">
                  <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
                    <Map className="size-6 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">{modoNovo ? 'Nova Rota' : form.nome}</h2>
                    {!modoNovo && form.id && (
                      <p className="text-sm text-muted-foreground">
                        Código: {form.codigo} · {form.id.slice(0, 8)}
                      </p>
                    )}
                  </div>
                </div>
                {podeGerenciar && (
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={cancelar}>
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
              </div>

              <div className="flex-1 space-y-6 overflow-auto p-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <Label htmlFor="nome">Nome da Rota</Label>
                    <Input
                      id="nome"
                      value={form.nome}
                      disabled={!podeGerenciar}
                      onChange={(e) => setCampo('nome', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="codigo">Código Rápido</Label>
                    <Input
                      id="codigo"
                      value={form.codigo}
                      disabled={!podeGerenciar || (!modoNovo && !!form.id)}
                      onChange={(e) => setCampo('codigo', e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <Label htmlFor="regiao">Região</Label>
                    <Input
                      id="regiao"
                      value={form.regiao ?? ''}
                      disabled={!podeGerenciar}
                      onChange={(e) => setCampo('regiao', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="representante">Representante padrão</Label>
                    <Input
                      id="representante"
                      value={form.representantePadrao ?? ''}
                      disabled={!podeGerenciar}
                      onChange={(e) => setCampo('representantePadrao', e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <Label htmlFor="caminhao">Caminhão padrão</Label>
                    <Input
                      id="caminhao"
                      value={form.caminhaoPadrao ?? ''}
                      disabled={!podeGerenciar}
                      onChange={(e) => setCampo('caminhaoPadrao', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="motorista">Motorista padrão</Label>
                    <Input
                      id="motorista"
                      value={form.motoristaPadrao ?? ''}
                      disabled={!podeGerenciar}
                      onChange={(e) => setCampo('motoristaPadrao', e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-lg border px-4 py-3">
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

                <div className="space-y-1.5">
                  <Label htmlFor="observacoes">Observações</Label>
                  <Textarea
                    id="observacoes"
                    value={form.observacoes ?? ''}
                    disabled={!podeGerenciar}
                    onChange={(e) => setCampo('observacoes', e.target.value)}
                    rows={4}
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-border pb-2">
                    <h3 className="text-sm font-bold tracking-wider text-foreground uppercase">
                      Sequência de Paradas / Bairros
                    </h3>
                    <span className="text-xs text-muted-foreground">
                      {form.paradas.length} {form.paradas.length === 1 ? 'parada' : 'paradas'}
                    </span>
                  </div>

                  {form.paradas.length === 0 && (
                    <p className="rounded-md border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                      Nenhuma parada cadastrada nesta rota.
                    </p>
                  )}

                  {form.paradas.map((parada, indice) => (
                    <div key={parada.ordem} className="flex items-center gap-3 rounded-md border border-border bg-muted/30 p-3">
                      <MoveVertical className="size-4 cursor-grab text-muted-foreground" />
                      <span className="flex size-6 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
                        {indice + 1}
                      </span>
                      <Input
                        aria-label={`Parada ${indice + 1}`}
                        className="flex-1 bg-card"
                        value={parada.descricao}
                        disabled={!podeGerenciar}
                        onChange={(e) => atualizarParada(indice, e.target.value)}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Subir parada"
                        disabled={!podeGerenciar || indice === 0}
                        onClick={() => moverParada(indice, -1)}
                      >
                        <ArrowUp className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Descer parada"
                        disabled={!podeGerenciar || indice === form.paradas.length - 1}
                        onClick={() => moverParada(indice, 1)}
                      >
                        <ArrowDown className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Remover parada"
                        disabled={!podeGerenciar}
                        onClick={() => removerParada(indice)}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  ))}

                  {podeGerenciar && (
                    <Button
                      type="button"
                      variant="outline"
                      className="mt-2 w-full border-dashed text-muted-foreground"
                      onClick={adicionarParada}
                    >
                      <Plus className="mr-2 size-4" />
                      Adicionar Parada
                    </Button>
                  )}
                </div>

                <div className="space-y-3">
                  <h3 className="border-b border-border pb-2 text-sm font-bold tracking-wider text-foreground uppercase">
                    Dias de Atendimento
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {DIAS_SEMANA.map((dia) => {
                      const marcado = form.diasAtendimento.includes(dia.valor);
                      return (
                        <Button
                          key={dia.valor}
                          type="button"
                          variant={marcado ? 'default' : 'outline'}
                          size="sm"
                          aria-pressed={marcado}
                          disabled={!podeGerenciar}
                          onClick={() => alternarDia(dia.valor)}
                        >
                          {dia.rotulo}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center text-muted-foreground">
              <Map className="mb-4 size-16 opacity-20" />
              <p>Selecione uma rota para visualizar ou editar</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
