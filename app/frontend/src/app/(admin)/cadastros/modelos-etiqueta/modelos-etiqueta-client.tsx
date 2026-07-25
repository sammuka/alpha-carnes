'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { BadgeProvisorio } from '@/components/ui/badge-provisorio';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { mensagemDeErro } from '@/lib/error-message';
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
    <div className="flex h-full flex-col gap-5">
      <div>
        <p className="mb-0.5 text-[11px] font-medium text-text-muted">Cadastros &amp; Regras / Modelos de Etiqueta</p>
        <h1 className="text-[20px] font-bold text-text-strong">Modelos de Etiqueta</h1>
        <p className="mt-0.5 text-[12px] text-text-secondary">
          Configure os campos exibidos em cada modelo de etiqueta usado na operação.
        </p>
      </div>

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

      <div className="flex min-h-0 flex-1 gap-5">
        {/* Lista de modelos — :165-187 */}
        <div className="flex w-[260px] flex-shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-card">
          <div className="border-b border-muted px-4 py-3">
            <p className="text-[12px] font-bold text-text-strong">Modelos</p>
          </div>
          <div className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
            {modelos.length === 0 && (
              <p className="px-3 py-2 text-[13px] text-text-muted">Nenhum modelo cadastrado.</p>
            )}
            {modelos.map((modelo) => {
              const ativo = selecionado?.id === modelo.id;
              const ativos = CAMPOS_ETIQUETA.filter((c) => modelo.campos[c.chave]).length;
              return (
                <button
                  key={modelo.id}
                  type="button"
                  onClick={() => setSelecionado(modelo)}
                  className={`rounded-lg px-3 py-2.5 text-left transition-colors ${
                    ativo
                      ? 'border border-action-blue-ring bg-action-blue-bg'
                      : 'border border-transparent hover:bg-surface-subtle'
                  }`}
                >
                  <p className={`text-[13px] font-semibold ${ativo ? 'text-action-blue-hover' : 'text-text-strong'}`}>
                    {modelo.nome}
                  </p>
                  <p className="mt-0.5 text-[11px] text-text-muted">
                    {ativos} de {CAMPOS_ETIQUETA.length} campos ativos
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Campos configuráveis — :190-207 */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-muted px-4 py-3">
            <p className="text-[12px] font-bold text-text-strong">
              Campos configuráveis{selecionado ? ` — ${selecionado.nome}` : ''}
            </p>
            {podeGerenciar && selecionado && (
              <button
                type="button"
                onClick={() => void salvar()}
                disabled={salvando}
                className="h-8 rounded-md bg-brand-navy-deep px-4 text-[13px] font-semibold text-white transition-colors hover:bg-action-blue disabled:opacity-60"
              >
                {salvando ? 'Salvando…' : 'Salvar Modelo'}
              </button>
            )}
          </div>
          {!selecionado || !campos ? (
            <p className="p-4 text-[13px] text-text-muted">Selecione um modelo.</p>
          ) : (
            <div className="grid flex-1 grid-cols-2 gap-2 overflow-y-auto p-4">
              {CAMPOS_ETIQUETA.map((campo) => (
                <Label
                  key={campo.chave}
                  htmlFor={`campo-${campo.chave}`}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-[13px] font-normal text-text-ink transition-colors hover:bg-surface-subtle"
                >
                  <Checkbox
                    id={`campo-${campo.chave}`}
                    checked={campos[campo.chave]}
                    disabled={!podeGerenciar}
                    onCheckedChange={(v) => setCampos((c) => (c ? { ...c, [campo.chave]: v === true } : c))}
                  />
                  {campo.rotulo}
                </Label>
              ))}
            </div>
          )}
        </div>

        {/* Preview ao vivo — :210-217, com D18.a */}
        <div className="flex w-[380px] flex-shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-card">
          <div className="border-b border-muted px-4 py-3">
            <p className="text-[12px] font-bold text-text-strong">Preview ao vivo</p>
          </div>
          <div className="flex flex-1 items-start justify-center overflow-y-auto p-4">
            <div className="w-full rounded-xl border-2 border-action-blue bg-surface-subtle p-4 font-mono text-[12px] text-text-ink">
              <p className="mb-3 text-[9px] font-black tracking-[0.2em] text-text-muted uppercase">
                ALFA CARNES
              </p>
              {marcados.length === 0 ? (
                <p className="text-text-muted">Nenhum campo selecionado.</p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {marcados.map((campo) => (
                    <li key={campo.chave}>{campo.rotulo}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
