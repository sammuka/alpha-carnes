'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { GitBranch, Plus } from 'lucide-react';
import { BadgeProvisorio } from '@/components/ui/badge-provisorio';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ComboboxField } from '@/components/ui/combobox-field';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { SelectNative } from '@/components/ui/select-native';
import { StatusPill } from '@/components/ui/status-pill';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
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
import type { PaginadoRegras } from '@/lib/desossa';
import { labelCodigoDescricao } from '@/lib/dominios';
import { mensagemDeErro } from '@/lib/error-message';
import { SimuladorDesdobramento } from './simulador-desdobramento';
import { SimuladorDesossa } from './simulador-desossa';

interface RegraDesdobramento {
  id: string;
  itemCompraId: string;
  itemComercialId: string;
  fatorQuantidade: string;
  status: 'ativo' | 'inativo';
  vigenciaInicio: string;
  vigenciaFim: string | null;
  observacoes: string | null;
  itemCompraCodigo: string;
  itemCompraNome: string;
  itemComercialCodigo: string;
  itemComercialNome: string;
}
interface ItemCompraOpcao { id: string; codigo: string; descricao: string }
interface ItemComercialOpcao { id: string; codigo: string; descricao: string }
interface NovaRegraForm {
  itemCompraId: string;
  itemComercialId: string;
  fator: string;
  vigenciaInicio: string;
  vigenciaFim: string;
  status: 'ativo' | 'inativo';
  observacoes: string;
}

function hojeLocal(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
}

function formVazio(): NovaRegraForm {
  return {
    itemCompraId: '',
    itemComercialId: '',
    fator: '1.000',
    vigenciaInicio: hojeLocal(),
    vigenciaFim: '',
    status: 'ativo',
    observacoes: '',
  };
}

function formatData(iso: string | null | undefined): string {
  if (!iso) return 'Indeterminado';
  return new Date(iso).toLocaleDateString('pt-BR');
}

export function RegrasTransformacaoClient({ podeGerenciar }: { podeGerenciar: boolean }) {
  const [regras, setRegras] = useState<RegraDesdobramento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [dialogAberto, setDialogAberto] = useState(false);
  const [itensCompra, setItensCompra] = useState<ItemCompraOpcao[]>([]);
  const [itensComerciais, setItensComerciais] = useState<ItemComercialOpcao[]>([]);
  const [formRegra, setFormRegra] = useState<NovaRegraForm>(formVazio);
  const [salvandoRegra, setSalvandoRegra] = useState(false);
  const [erroRegra, setErroRegra] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const res = await fetch('/api/cadastros/regras-desdobramento?pageSize=100', { cache: 'no-store' });
      if (!res.ok) {
        setErro(await mensagemDeErro(res, 'Erro ao carregar regras'));
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

  const carregarCatalogos = useCallback(async () => {
    const [compraRes, comercialRes] = await Promise.all([
      fetch('/api/cadastros/itens-compra?page=1&pageSize=100&status=ativo', { cache: 'no-store' }),
      fetch('/api/cadastros/itens-comerciais?page=1&pageSize=100&status=ativo', { cache: 'no-store' }),
    ]);
    if (!compraRes.ok) {
      setErroRegra(await mensagemDeErro(compraRes, 'Falha ao carregar itens de compra'));
      return;
    }
    if (!comercialRes.ok) {
      setErroRegra(await mensagemDeErro(comercialRes, 'Falha ao carregar itens comerciais'));
      return;
    }
    setItensCompra(((await compraRes.json()) as { data: ItemCompraOpcao[] }).data);
    setItensComerciais(((await comercialRes.json()) as { data: ItemComercialOpcao[] }).data);
  }, []);

  useEffect(() => {
    void carregar();
    void carregarCatalogos();
  }, [carregar, carregarCatalogos]);

  const somaFatores = useMemo(
    () => regras.reduce((acc, r) => acc + parseFloat(r.fatorQuantidade || '0'), 0),
    [regras],
  );

  const itemCompraSelecionadoId = regras[0]?.itemCompraId ?? null;

  function abrirDialog() {
    setErroRegra(null);
    setFormRegra(formVazio());
    setDialogAberto(true);
  }

  async function salvarRegra() {
    if (!formRegra.itemCompraId || !formRegra.itemComercialId || !formRegra.vigenciaInicio) return;
    setSalvandoRegra(true);
    setErroRegra(null);
    const payload = {
      itemCompraId: formRegra.itemCompraId,
      itemComercialId: formRegra.itemComercialId,
      fatorQuantidade: Number(formRegra.fator),
      vigenciaInicio: formRegra.vigenciaInicio,
      ...(formRegra.vigenciaFim ? { vigenciaFim: formRegra.vigenciaFim } : {}),
      status: formRegra.status,
      ...(formRegra.observacoes.trim() ? { observacoes: formRegra.observacoes.trim() } : {}),
    };
    const res = await fetch('/api/cadastros/regras-desdobramento', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      setErroRegra(await mensagemDeErro(res, 'Falha ao criar regra'));
      setSalvandoRegra(false);
      return;
    }
    setDialogAberto(false);
    setFormRegra(formVazio());
    setSalvandoRegra(false);
    await carregar();
  }

  return (
    <div className="space-y-3">
      <PageHeader title="Regras de Transformação" subtitle="Configuração de conversão de item de compra para itens comerciais">
        {podeGerenciar && (
          <Button variant="secondary" onClick={abrirDialog}>
            Nova regra
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
                <Button variant="secondary" size="sm" disabled={!podeGerenciar} onClick={abrirDialog}>
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {carregando ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                        Carregando regras…
                      </TableCell>
                    </TableRow>
                  ) : regras.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                        Nenhuma regra cadastrada.
                      </TableCell>
                    </TableRow>
                  ) : (
                    regras.map((regra) => (
                      <TableRow key={regra.id} className="group">
                        <TableCell>
                          <p className="text-[13px] font-semibold">
                            {regra.itemComercialCodigo} — {regra.itemComercialNome}
                          </p>
                        </TableCell>
                        <TableCell>
                          <p className="text-[13px] font-semibold">
                            {regra.itemCompraCodigo} — {regra.itemCompraNome}
                          </p>
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
                      </TableRow>
                    ))
                  )}
                </TableBody>
                {!carregando && regras.length > 0 && (
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={5} className="text-right text-muted-foreground">
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
          <AlternativasDesossaTz />
          <SimuladorDesossa />
        </TabsContent>
      </Tabs>

      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova regra</DialogTitle>
          </DialogHeader>
          {erroRegra && (
            <p role="alert" className="text-sm text-destructive">{erroRegra}</p>
          )}
          <div className="grid gap-2.5">
            <FormField label="Item de compra" required htmlFor="regra-item-compra">
              <ComboboxField
                id="regra-item-compra"
                items={itensCompra.map((it) => ({
                  id: it.id,
                  label: labelCodigoDescricao(it.codigo, it.descricao),
                }))}
                value={formRegra.itemCompraId}
                onChange={(itemCompraId) => setFormRegra((s) => ({ ...s, itemCompraId }))}
                placeholder="Selecione"
                searchPlaceholder="Buscar item de compra..."
                emptyText="Nenhum item encontrado."
              />
            </FormField>
            <FormField label="Item comercial" required htmlFor="regra-item-comercial">
              <ComboboxField
                id="regra-item-comercial"
                items={itensComerciais.map((it) => ({
                  id: it.id,
                  label: labelCodigoDescricao(it.codigo, it.descricao),
                }))}
                value={formRegra.itemComercialId}
                onChange={(itemComercialId) => setFormRegra((s) => ({ ...s, itemComercialId }))}
                placeholder="Selecione"
                searchPlaceholder="Buscar item comercial..."
                emptyText="Nenhum item encontrado."
              />
            </FormField>
            <FormField label="Fator" required htmlFor="regra-fator">
              <Input
                id="regra-fator"
                type="number"
                min={0.001}
                step={0.001}
                value={formRegra.fator}
                onChange={(e) => setFormRegra((s) => ({ ...s, fator: e.target.value }))}
              />
            </FormField>
            <FormField label="Vigência inicial" required htmlFor="regra-inicio">
              <Input
                id="regra-inicio"
                type="date"
                value={formRegra.vigenciaInicio}
                onChange={(e) => setFormRegra((s) => ({ ...s, vigenciaInicio: e.target.value }))}
              />
            </FormField>
            <FormField label="Vigência final" htmlFor="regra-fim">
              <Input
                id="regra-fim"
                type="date"
                value={formRegra.vigenciaFim}
                onChange={(e) => setFormRegra((s) => ({ ...s, vigenciaFim: e.target.value }))}
              />
            </FormField>
            <FormField label="Status" htmlFor="regra-status">
              <SelectNative
                id="regra-status"
                value={formRegra.status}
                onChange={(e) => setFormRegra((s) => ({ ...s, status: e.target.value as 'ativo' | 'inativo' }))}
              >
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
              </SelectNative>
            </FormField>
            <FormField label="Observações" htmlFor="regra-obs">
              <Textarea
                id="regra-obs"
                value={formRegra.observacoes}
                onChange={(e) => setFormRegra((s) => ({ ...s, observacoes: e.target.value }))}
              />
            </FormField>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setDialogAberto(false)}>
              Cancelar
            </Button>
            <Button type="button" disabled={salvandoRegra} onClick={() => void salvarRegra()}>
              Salvar regra
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AlternativasDesossaTz() {
  const [nomes, setNomes] = useState<string[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch('/api/desossa/regras-transformacao?pageSize=20', { cache: 'no-store' });
      if (!res.ok) {
        setErro(await mensagemDeErro(res, 'Erro ao carregar alternativas de TZ'));
        return;
      }
      const paginado = (await res.json()) as PaginadoRegras;
      setNomes(paginado.data.map((r) => r.nome));
    })();
  }, []);

  if (erro) {
    return <p className="text-sm text-destructive">{erro}</p>;
  }

  if (nomes.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhuma alternativa de TZ cadastrada. Rode o seed (TZ_A: Coxão-bola + Jacaré; TZ_B: Coxão-bola c/ alcatra + Filé curto).
      </p>
    );
  }

  return (
    <div className="grid gap-2.5 md:grid-cols-2">
      {nomes.map((nome) => (
        <Card key={nome}>
          <CardHeader>
            <CardTitle>{nome}</CardTitle>
            <CardAction>
              <BadgeProvisorio pendencia="P12" />
            </CardAction>
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}
