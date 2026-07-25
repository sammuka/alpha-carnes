'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { GitBranch, Plus, Trash2 } from 'lucide-react';
import { BadgeProvisorio } from '@/components/ui/badge-provisorio';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { StatusPill } from '@/components/ui/status-pill';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Paginado } from '@/lib/cadastros';
import { SimuladorDesdobramento } from './simulador-desdobramento';
import { SimuladorDesossa } from './simulador-desossa';

interface RegraDesdobramento {
  id: string;
  itemCompraId: string;
  itemComercialId: string;
  itemCompraNome?: string | null;
  itemCompraCodigo?: string | null;
  itemComercialNome?: string | null;
  itemComercialCodigo?: string | null;
  fatorQuantidade: string;
  status: string;
  vigenciaInicio: string;
  vigenciaFim: string | null;
  observacoes?: string | null;
}

function rotuloItemComercial(regra: RegraDesdobramento): string {
  if (regra.itemComercialNome) {
    return regra.itemComercialCodigo
      ? `${regra.itemComercialCodigo} — ${regra.itemComercialNome}`
      : regra.itemComercialNome;
  }
  if (regra.itemComercialCodigo) return regra.itemComercialCodigo;
  return regra.itemComercialId;
}

function rotuloItemCompra(regra: RegraDesdobramento): string {
  if (regra.itemCompraNome) {
    return regra.itemCompraCodigo
      ? `${regra.itemCompraCodigo} — ${regra.itemCompraNome}`
      : regra.itemCompraNome;
  }
  if (regra.itemCompraCodigo) return regra.itemCompraCodigo;
  return regra.itemCompraId;
}

function formatData(iso: string | null | undefined): string {
  if (!iso) return 'Indeterminado';
  return new Date(iso).toLocaleDateString('pt-BR');
}

export function RegrasTransformacaoClient({ podeGerenciar }: { podeGerenciar: boolean }) {
  const [regras, setRegras] = useState<RegraDesdobramento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const res = await fetch('/api/cadastros/regras-desdobramento?pageSize=100', { cache: 'no-store' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setErro((body as { message?: string }).message ?? 'Erro ao carregar regras');
        setRegras([]);
        return;
      }
      const paginado = (await res.json()) as Paginado<RegraDesdobramento>;
      setRegras(paginado.data);
    } catch {
      setErro('Erro de conexão');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const somaFatores = useMemo(
    () => regras.reduce((acc, r) => acc + parseFloat(r.fatorQuantidade || '0'), 0),
    [regras],
  );

  const itemCompraSelecionadoId = regras[0]?.itemCompraId ?? null;

  return (
    <div className="flex max-w-[1664px] flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Regras de Transformação</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Configuração de conversão de item de compra para itens comerciais
          </p>
        </div>
        {podeGerenciar && (
          <Button variant="outline" disabled className="border-primary text-primary">
            Nova regra (em breve)
          </Button>
        )}
      </div>

      {erro && (
        <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {erro}
        </div>
      )}

      <Tabs defaultValue="desdobramento" className="gap-4">
        <TabsList>
          <TabsTrigger value="desdobramento">Desdobramento de Compra</TabsTrigger>
          <TabsTrigger value="desossa">Transformação de Desossa (TZ)</TabsTrigger>
        </TabsList>

        <TabsContent value="desdobramento" className="space-y-6">
          <Card className="rounded-xl border-border shadow-sm">
            <CardContent className="p-5">
              <p className="text-xs font-medium text-muted-foreground">
                Regras cadastradas no backend (identificadores de item de compra e comercial).
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-xl border-border shadow-sm">
            <div className="flex items-center justify-between border-b border-border p-5">
              <div className="flex items-center gap-2">
                <GitBranch className="h-5 w-5 text-primary" />
                <h2 className="text-base font-bold text-foreground">Itens comerciais (destino)</h2>
              </div>
              <Button variant="outline" size="sm" disabled={!podeGerenciar} className="gap-1 border-primary text-primary">
                <Plus className="h-4 w-4" /> Adicionar linha
              </Button>
            </div>
            <div className="overflow-x-auto p-5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
                    <th className="pb-3">Item comercial</th>
                    <th className="pb-3">Item compra (origem)</th>
                    <th className="pb-3 text-center">Fator</th>
                    <th className="pb-3">Vigência</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3">Observações</th>
                    <th className="pb-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {carregando ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-muted-foreground">
                        Carregando regras…
                      </td>
                    </tr>
                  ) : regras.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-muted-foreground">
                        Nenhuma regra cadastrada.
                      </td>
                    </tr>
                  ) : (
                    regras.map((regra) => (
                      <tr key={regra.id}>
                        <td className="py-4">
                          <p className="text-sm font-medium text-foreground">{rotuloItemComercial(regra)}</p>
                          <p className="font-mono text-xs text-muted-foreground">{regra.itemComercialId.slice(0, 8)}…</p>
                        </td>
                        <td className="py-4">
                          <p className="text-sm text-foreground">{rotuloItemCompra(regra)}</p>
                          <p className="font-mono text-xs text-muted-foreground">{regra.itemCompraId.slice(0, 8)}…</p>
                        </td>
                        <td className="py-4 text-center font-bold text-foreground">{regra.fatorQuantidade}</td>
                        <td className="py-4 text-muted-foreground">
                          {formatData(regra.vigenciaInicio)} — {formatData(regra.vigenciaFim)}
                        </td>
                        <td className="py-4">
                          <StatusPill
                            variant={regra.status === 'ativo' ? 'expedido' : 'bloqueado'}
                            label={regra.status === 'ativo' ? 'Ativo' : 'Inativo'}
                          />
                        </td>
                        <td className="py-4 text-muted-foreground">{regra.observacoes ?? '—'}</td>
                        <td className="py-4 text-right">
                          <Button variant="ghost" size="icon" disabled={!podeGerenciar} className="h-8 w-8">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                  {!carregando && regras.length > 0 && (
                    <tr>
                      <td colSpan={7} className="pt-4">
                        <div className="flex justify-end gap-4 text-sm font-medium">
                          <span className="text-muted-foreground">Soma dos fatores:</span>
                          <span className="font-bold text-[var(--color-status-expedido)]">
                            {somaFatores.toFixed(2)}
                          </span>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <SimuladorDesdobramento itemCompraId={itemCompraSelecionadoId} />
        </TabsContent>

        <TabsContent value="desossa" className="space-y-6">
          <div className="flex items-start gap-3 rounded-lg border border-provisorio-border bg-warning-surface p-4">
            <BadgeProvisorio pendencia="P12" />
            <p className="text-sm text-provisorio-text">
              Cada unidade de TZ atende exatamente uma das alternativas abaixo.
            </p>
          </div>
          <SimuladorDesossa />
        </TabsContent>
      </Tabs>
    </div>
  );
}
