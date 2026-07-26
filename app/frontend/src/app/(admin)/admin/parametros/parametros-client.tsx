'use client';

import { useCallback, useEffect, useState } from 'react';
import { Briefcase, Receipt, Settings, type LucideIcon } from 'lucide-react';
import { toast } from 'sonner';
import { BadgeProvisorio, type PendenciaAberta, PENDENCIAS_ABERTAS } from '@/components/ui/badge-provisorio';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { mensagemDeErro } from '@/lib/error-message';

interface ValorParametro {
  grupo: string;
  tipo: 'toggle' | 'texto' | 'info';
  titulo: string;
  texto: string;
  valor?: boolean | string;
  provisorio: boolean;
  pendencia: string | null;
}

interface Parametro {
  id: string;
  chave: string;
  valorJson: ValorParametro;
}

/** Ícone por grupo — Parametros.tsx:68-72, sem substituição. */
const GRUPOS: Array<{ chave: string; icone: LucideIcon }> = [
  { chave: 'Comercial', icone: Briefcase },
  { chave: 'Operação', icone: Settings },
  { chave: 'Fiscal', icone: Receipt },
];

export function ParametrosClient({ podeGerenciar }: { podeGerenciar: boolean }) {
  const [parametros, setParametros] = useState<Parametro[]>([]);
  const [rascunho, setRascunho] = useState<Record<string, boolean | string>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [salvandoChave, setSalvandoChave] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      const res = await fetch('/api/admin/parametros?page=1&pageSize=100', { cache: 'no-store' });
      if (!res.ok) {
        setErro(await mensagemDeErro(res));
        return;
      }
      const dados = (await res.json()) as { data: Parametro[] };
      setParametros(dados.data);
      setRascunho(
        Object.fromEntries(
          dados.data
            .filter((p) => p.valorJson.valor !== undefined)
            .map((p) => [p.chave, p.valorJson.valor as boolean | string]),
        ),
      );
    } catch {
      setErro('Erro de conexão com o servidor.');
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const salvar = async (parametro: Parametro) => {
    setSalvandoChave(parametro.chave);
    try {
      const res = await fetch(`/api/admin/parametros/chave/${encodeURIComponent(parametro.chave)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          valorJson: { ...parametro.valorJson, valor: rascunho[parametro.chave] },
        }),
      });
      if (!res.ok) {
        toast.error(await mensagemDeErro(res));
        return;
      }
      toast.success('Parâmetro salvo.');
      await carregar();
    } catch {
      toast.error('Erro de conexão com o servidor.');
    } finally {
      setSalvandoChave(null);
    }
  };

  /** D23.a — o protótipo não persiste; sem este botão o cartão seria inerte. */
  const botaoSalvar = (parametro: Parametro) =>
    podeGerenciar ? (
      <Button
        variant="outline"
        size="sm"
        className="h-8 text-[12px]"
        disabled={salvandoChave === parametro.chave}
        onClick={() => void salvar(parametro)}
      >
        {salvandoChave === parametro.chave ? 'Salvando…' : 'Salvar'}
      </Button>
    ) : null;

  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto">
      {/* Cabeçalho — Parametros.tsx:151-155, literal */}
      <div>
        <p className="mb-0.5 text-[11px] font-medium text-text-muted">Administração / Parâmetros</p>
        <h1 className="text-[20px] font-bold text-text-strong">Parâmetros do Sistema</h1>
        <p className="mt-0.5 text-[12px] text-text-secondary">
          Regras gerais de negócio, agrupadas por Comercial, Operação e Fiscal.
        </p>
      </div>

      {erro && (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {erro}
        </p>
      )}

      {GRUPOS.map(({ chave: grupo, icone: Icone }) => {
        const doGrupo = parametros.filter((p) => p.valorJson.grupo === grupo);
        if (doGrupo.length === 0) return null;

        return (
          <section key={grupo} className="flex flex-col gap-3">
            {/* Cabeçalho do grupo — Parametros.tsx:161-164 */}
            <div className="flex items-center gap-2">
              <Icone className="size-4 text-action-blue" />
              <p className="text-[13px] font-bold tracking-wide text-text-strong uppercase">{grupo}</p>
            </div>

            {/* Cartões — Parametros.tsx:165, grid de 2 colunas */}
            <div className="grid grid-cols-2 gap-4">
              {doGrupo.map((parametro) => (
                <div
                  key={parametro.id}
                  className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[13px] leading-tight font-bold text-text-strong">
                      {parametro.valorJson.titulo}
                    </p>
                    {parametro.valorJson.provisorio &&
                      parametro.valorJson.pendencia &&
                      parametro.valorJson.pendencia in PENDENCIAS_ABERTAS && (
                        <BadgeProvisorio pendencia={parametro.valorJson.pendencia as PendenciaAberta} />
                      )}
                  </div>
                  <p className="text-[12px] leading-relaxed text-text-secondary">
                    {parametro.valorJson.texto}
                  </p>

                  {parametro.valorJson.tipo === 'toggle' && (
                    <div className="mt-1 flex items-center justify-between gap-3 border-t border-muted pt-2">
                      <span className="text-[12px] font-medium text-text-ink">
                        {rascunho[parametro.chave] === true ? 'Ativado' : 'Desativado'}
                      </span>
                      <div className="flex items-center gap-2">
                        {botaoSalvar(parametro)}
                        <Switch
                          className="h-5 w-9"
                          aria-label={parametro.valorJson.titulo}
                          checked={rascunho[parametro.chave] === true}
                          disabled={!podeGerenciar}
                          onCheckedChange={(v) => setRascunho((r) => ({ ...r, [parametro.chave]: v }))}
                        />
                      </div>
                    </div>
                  )}

                  {parametro.valorJson.tipo === 'texto' && (
                    <div className="mt-1 flex items-center gap-2 border-t border-muted pt-2">
                      <Input
                        aria-label={parametro.valorJson.titulo}
                        className="h-8 flex-1 text-[13px]"
                        placeholder="Observação / valor definido..."
                        value={String(rascunho[parametro.chave] ?? '')}
                        disabled={!podeGerenciar}
                        onChange={(e) => setRascunho((r) => ({ ...r, [parametro.chave]: e.target.value }))}
                      />
                      {botaoSalvar(parametro)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
