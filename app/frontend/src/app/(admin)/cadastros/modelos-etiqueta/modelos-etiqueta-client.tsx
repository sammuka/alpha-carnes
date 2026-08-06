'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { BadgeProvisorio } from '@/components/ui/badge-provisorio';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { PageHeader } from '@/components/ui/page-header';
import { mensagemDeErro } from '@/lib/error-message';
import { cn } from '@/lib/cn';
import { CAMPOS_ETIQUETA, type CampoEtiqueta, type ModeloEtiqueta } from '@/lib/modelos-etiqueta';

export function ModelosEtiquetaClient({ podeGerenciar }: { podeGerenciar: boolean }) {
  const [modelos, setModelos] = useState<ModeloEtiqueta[]>([]);
  const [selecionado, setSelecionado] = useState<ModeloEtiqueta | null>(null);
  const [campos, setCampos] = useState<Record<CampoEtiqueta, boolean> | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      const res = await fetch('/api/cadastros/modelos-etiqueta?page=1&pageSize=50', { cache: 'no-store' });
      if (!res.ok) {
        setErro(await mensagemDeErro(res));
        return;
      }
      const dados = (await res.json()) as { data: ModeloEtiqueta[] };
      setModelos(dados.data);
      setSelecionado((atual) => dados.data.find((m) => m.id === atual?.id) ?? dados.data[0] ?? null);
    } catch {
      setErro('Erro de conexão com o servidor.');
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    setCampos(selecionado ? { ...selecionado.campos } : null);
  }, [selecionado]);

  const salvar = async () => {
    if (!selecionado || !campos) return;
    setSalvando(true);
    try {
      const res = await fetch(`/api/cadastros/modelos-etiqueta/${selecionado.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campos }),
      });
      if (!res.ok) {
        toast.error(await mensagemDeErro(res));
        return;
      }
      toast.success('Modelo atualizado.');
      await carregar();
    } catch {
      toast.error('Erro de conexão com o servidor.');
    } finally {
      setSalvando(false);
    }
  };

  const marcados = campos ? CAMPOS_ETIQUETA.filter((c) => campos[c.chave]) : [];

  return (
    <div className="space-y-3">
      <PageHeader title="Modelos de Etiqueta" subtitle="Configure os campos exibidos em cada modelo de etiqueta usado na operação." />

      {/* Banner P9 — ModelosEtiqueta.tsx:158-161 */}
      <div className="flex items-start gap-2 rounded-lg border border-provisorio-border bg-warning-surface p-3">
        <AlertTriangle className="mt-0.5 size-3.5 flex-shrink-0 text-warning-ink" />
        <p className="text-[12px] leading-snug text-provisorio-text">
          Modelo físico/campos finais da etiqueta pendentes de definição.
        </p>
        <BadgeProvisorio pendencia="P9" />
      </div>

      {erro && (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-[13px] text-destructive">
          {erro}
        </p>
      )}

      <div className="grid gap-2.5 xl:grid-cols-[280px_1fr_320px]">
        {/* Lista de modelos — :165-187 */}
        <Card>
          <CardHeader>
            <CardTitle>Modelos</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 p-2">
            {modelos.length === 0 && (
              <p className="px-3 py-2 text-[13px] text-muted-foreground">Nenhum modelo cadastrado.</p>
            )}
            {modelos.map((modelo) => {
              const ativo = selecionado?.id === modelo.id;
              const ativos = CAMPOS_ETIQUETA.filter((c) => modelo.campos[c.chave]).length;
              return (
                <button
                  key={modelo.id}
                  type="button"
                  onClick={() => setSelecionado(modelo)}
                  className={cn(
                    'rounded-md px-3 py-2 text-left transition-colors duration-100',
                    ativo ? 'bg-primary-soft shadow-[inset_2px_0_0_var(--color-primary)]' : 'hover:bg-surface-2',
                  )}
                >
                  <p className={cn('text-[13px] font-semibold', ativo ? 'text-primary-fg' : 'text-foreground')}>
                    {modelo.nome}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {ativos} de {CAMPOS_ETIQUETA.length} campos ativos
                  </p>
                </button>
              );
            })}
          </CardContent>
        </Card>

        {/* Campos configuráveis — :190-207 */}
        <Card>
          <CardHeader>
            <CardTitle>
              Campos configuráveis{selecionado ? ` — ${selecionado.nome}` : ''}
            </CardTitle>
            {podeGerenciar && selecionado && (
              <div className="ml-auto">
                <Button size="sm" onClick={() => void salvar()} disabled={salvando}>
                  {salvando ? 'Salvando…' : 'Salvar Modelo'}
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {!selecionado || !campos ? (
              <p className="text-[13px] text-muted-foreground">Selecione um modelo.</p>
            ) : (
              <div className="grid grid-cols-2 gap-1.5">
                {CAMPOS_ETIQUETA.map((campo) => (
                  <label
                    key={campo.chave}
                    htmlFor={`campo-${campo.chave}`}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-[13px] transition-colors duration-100 hover:bg-surface-2"
                  >
                    <Checkbox
                      id={`campo-${campo.chave}`}
                      checked={campos[campo.chave]}
                      disabled={!podeGerenciar}
                      onCheckedChange={(v) => setCampos((c) => (c ? { ...c, [campo.chave]: v === true } : c))}
                    />
                    {campo.rotulo}
                  </label>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Preview ao vivo — :210-217, com D18.a */}
        <Card>
          <CardHeader>
            <CardTitle>Preview ao vivo</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="w-full rounded-md border-2 border-primary bg-surface-2 p-3 font-data text-[12px] text-foreground">
              <span className="mb-2.5 block text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                ALFA CARNES
              </span>
              {marcados.length === 0 ? (
                <span className="block text-muted-foreground">Nenhum campo selecionado.</span>
              ) : (
                marcados.map((campo) => <span key={campo.chave} className="block">{campo.rotulo}</span>)
              )}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
