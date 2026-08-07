'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { GitBranch, Plus, Trash2 } from 'lucide-react';
import { BadgeProvisorio } from '@/components/ui/badge-provisorio';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { StatusPill } from '@/components/ui/status-pill';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableCellNum,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
    <div className="space-y-3">
      <PageHeader title="Regras de Transformação" subtitle="Configuração de conversão de item de compra para itens comerciais">
        {podeGerenciar && (
          <Button variant="secondary" disabled>
            Nova regra (em breve)
          </Button>
        )}
      </PageHeader>

      {erro && (
        <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {erro}
        </div>
      )}

      <Tabs defaultValue="desdobramento">
        <TabsList>
          <TabsTrigger value="desdobramento">Desdobramento de Compra</TabsTrigger>
          <TabsTrigger value="desossa">Transformação de Desossa (TZ)</TabsTrigger>
        </TabsList>

        <TabsContent value="desdobramento" className="space-y-3">
          <Card>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Regras cadastradas no backend (identificadores de item de compra e comercial).
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <GitBranch className="size-4 text-primary" />
              <CardTitle>Itens comerciais (destino)</CardTitle>
              <CardAction>
                <Button variant="secondary" size="sm" disabled={!podeGerenciar}>
                  <Plus /> Adicionar linha
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Item comercial</TableHead>
                    <TableHead>Item compra (origem)</TableHead>
                    <TableHead className="text-right">Fator</TableHead>
                    <TableHead>Vigência</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Observações</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {carregando ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                        Carregando regras…
                      </TableCell>
                    </TableRow>
                  ) : regras.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                        Nenhuma regra cadastrada.
                      </TableCell>
                    </TableRow>
                  ) : (
                    regras.map((regra) => (
                      <TableRow key={regra.id} className="group">
                        <TableCell>
                          <p className="text-[13px] font-semibold text-foreground">{rotuloItemComercial(regra)}</p>
                          <p className="font-data text-[11px] text-muted-foreground">{regra.itemComercialId.slice(0, 8)}…</p>
                        </TableCell>
                        <TableCell>
                          <p className="text-foreground">{rotuloItemCompra(regra)}</p>
                          <p className="font-data text-[11px] text-muted-foreground">{regra.itemCompraId.slice(0, 8)}…</p>
                        </TableCell>
                        <TableCellNum>{regra.fatorQuantidade}</TableCellNum>
                        <TableCell className="text-muted-foreground">
                          {formatData(regra.vigenciaInicio)} — {formatData(regra.vigenciaFim)}
                        </TableCell>
                        <TableCell>
                          <StatusPill
                            variant={regra.status === 'ativo' ? 'expedido' : 'bloqueado'}
                            label={regra.status === 'ativo' ? 'Ativo' : 'Inativo'}
                          />
                        </TableCell>
                        <TableCell className="text-muted-foreground">{regra.observacoes ?? '—'}</TableCell>
                        <TableCell>
                          <div className="flex justify-end opacity-0 transition-opacity group-hover:opacity-100">
                            <Button variant="ghost" size="iconSm" disabled={!podeGerenciar}>
                              <Trash2 />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
                {!carregando && regras.length > 0 && (
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={6} className="text-right text-muted-foreground">
                        Soma dos fatores:
                      </TableCell>
                      <TableCellNum className="text-[var(--color-status-expedido)]">
                        {somaFatores.toFixed(2)}
                      </TableCellNum>
                    </TableRow>
                  </TableFooter>
                )}
              </Table>
            </CardContent>
          </Card>

          <SimuladorDesdobramento itemCompraId={itemCompraSelecionadoId} />
        </TabsContent>

        <TabsContent value="desossa" className="space-y-3">
          <div className="flex items-start gap-3 rounded-lg border border-provisorio-border bg-warning-surface p-3">
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
