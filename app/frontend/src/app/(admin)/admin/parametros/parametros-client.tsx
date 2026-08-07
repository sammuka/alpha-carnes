'use client';

import { useCallback, useEffect, useState } from 'react';
import { Briefcase, Receipt, Settings, type LucideIcon } from 'lucide-react';
import { toast } from 'sonner';
import { BadgeProvisorio, type PendenciaAberta, PENDENCIAS_ABERTAS } from '@/components/ui/badge-provisorio';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
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
        size="sm"
        disabled={salvandoChave === parametro.chave}
        onClick={() => void salvar(parametro)}
      >
        {salvandoChave === parametro.chave ? 'Salvando…' : 'Salvar'}
      </Button>
    ) : null;

  return (
    <div className="space-y-3">
      <PageHeader title="Parâmetros do Sistema" subtitle="Regras gerais de negócio, agrupadas por Comercial, Operação e Fiscal." />

      {erro && (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {erro}
        </p>
      )}

      {GRUPOS.map(({ chave: grupo, icone: Icone }) => {
        const doGrupo = parametros.filter((p) => p.valorJson.grupo === grupo);
        if (doGrupo.length === 0) return null;

        return (
          <section key={grupo}>
            {/* Cabeçalho do grupo — Parametros.tsx:161-164 */}
            <p className="mb-1.5 mt-4 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.05em] text-muted-foreground first:mt-0">
              <Icone className="size-[13px]" />
              {grupo}
            </p>

            {/* Cartões — Parametros.tsx:165 */}
            <div className="grid gap-2.5 sm:grid-cols-2">
              {doGrupo.map((parametro) => (
                <Card key={parametro.id}>
                  <CardContent className="flex items-center gap-3 p-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[13px] font-semibold leading-tight text-foreground">
                          {parametro.valorJson.titulo}
                        </p>
                        {parametro.valorJson.provisorio &&
                          parametro.valorJson.pendencia &&
                          parametro.valorJson.pendencia in PENDENCIAS_ABERTAS && (
                            <BadgeProvisorio pendencia={parametro.valorJson.pendencia as PendenciaAberta} />
                          )}
                      </div>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                        {parametro.valorJson.texto}
                      </p>
                    </div>

                    {parametro.valorJson.tipo === 'toggle' && (
                      <div className="flex items-center gap-2">
                        {botaoSalvar(parametro)}
                        <Switch
                          aria-label={parametro.valorJson.titulo}
                          checked={rascunho[parametro.chave] === true}
                          disabled={!podeGerenciar}
                          onCheckedChange={(v) => setRascunho((r) => ({ ...r, [parametro.chave]: v }))}
                        />
                      </div>
                    )}

                    {parametro.valorJson.tipo === 'texto' && (
                      <div className="flex items-center gap-2">
                        <Input
                          aria-label={parametro.valorJson.titulo}
                          className="w-56"
                          placeholder="Observação / valor definido..."
                          value={String(rascunho[parametro.chave] ?? '')}
                          disabled={!podeGerenciar}
                          onChange={(e) => setRascunho((r) => ({ ...r, [parametro.chave]: e.target.value }))}
                        />
                        {botaoSalvar(parametro)}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
