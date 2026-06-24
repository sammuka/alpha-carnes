'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Calculator, GitBranch, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { StatusPill } from '@/components/ui/status-pill';
import { Input } from '@/components/ui/input';
import type { Paginado } from '@/lib/cadastros';

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
  const [simQuantidade, setSimQuantidade] = useState('10');

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

  const qtdSim = parseFloat(simQuantidade.replace(',', '.'));
  const simValido = !Number.isNaN(qtdSim) && qtdSim > 0;

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

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="space-y-6 xl:col-span-8">
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
        </div>

        <div className="xl:col-span-4">
          <Card className="h-full rounded-xl border-border border-t-4 border-t-[#8B5CF6] shadow-sm">
            <CardContent className="flex flex-col gap-4 p-5">
              <div className="flex items-center gap-2">
                <Calculator className="h-5 w-5 text-[#8B5CF6]" />
                <h2 className="text-base font-bold text-foreground">Simulador</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                Estime o resultado com base nas regras carregadas (sem inventar dados).
              </p>
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground">Quantidade base de compra</label>
                <Input
                  type="number"
                  min={1}
                  value={simQuantidade}
                  onChange={(e) => setSimQuantidade(e.target.value)}
                  className="max-w-[140px] font-bold"
                />
              </div>
              <div className="mt-2 border-t border-border pt-4">
                <p className="text-xs font-bold uppercase tracking-wider text-[#8B5CF6]">Resultado estimado</p>
                <div className="mt-3 space-y-3 rounded-lg border border-border bg-background p-4">
                  {!simValido || regras.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Informe uma quantidade válida e cadastre regras para simular.
                    </p>
                  ) : (
                    regras.map((regra) => {
                      const fator = parseFloat(regra.fatorQuantidade);
                      const resultado = (qtdSim * fator).toFixed(2);
                      return (
                        <div key={regra.id} className="flex items-center justify-between text-sm">
                          <span className="truncate text-xs text-foreground">
                            {rotuloItemComercial(regra)}
                          </span>
                          <span className="font-bold text-[#8B5CF6]">{resultado}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
