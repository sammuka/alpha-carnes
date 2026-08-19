'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Info, Plus, RefreshCw } from 'lucide-react';
import { BadgeCount } from '@/components/ui/badge-count';
import { BadgeProvisorio } from '@/components/ui/badge-provisorio';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DatePickerField } from '@/components/ui/date-picker-field';
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
import { StatusPill, type StatusPillVariant } from '@/components/ui/status-pill';
import {
  Table,
  TableBody,
  TableCell,
  TableCellNum,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  listarOperacoes,
  ROTULO_STATUS_OPERACAO,
  type Operacao,
} from '@/lib/gestao-operacoes';
import { mensagemDeErro } from '@/lib/error-message';

const DIAS_SEMANA = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

type FiltroStatus = 'todos' | Operacao['status'];

function statusVariant(status: Operacao['status']): StatusPillVariant {
  switch (status) {
    case 'aberta':
      return 'pendente';
    case 'em_andamento':
      return 'recebido';
    case 'fechada':
      return 'pendente';
    default:
      return 'pendente';
  }
}

function proximoStatus(atual: Operacao['status']): Operacao['status'] | null {
  if (atual === 'aberta') return 'em_andamento';
  if (atual === 'em_andamento') return 'fechada';
  return null;
}

function rotuloAcaoStatus(proximo: Operacao['status']): string {
  if (proximo === 'em_andamento') return 'Iniciar operação';
  if (proximo === 'fechada') return 'Encerrar';
  return '';
}

function formatDataBR(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export function OperacoesClient({ permissoes }: { permissoes: string[] }) {
  const podeGerenciar = permissoes.includes('OPERACOES_GERENCIAR');

  const [operacoes, setOperacoes] = useState<Operacao[]>([]);
  const [filtro, setFiltro] = useState<FiltroStatus>('todos');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [processando, setProcessando] = useState(false);

  const [modalExtra, setModalExtra] = useState(false);
  const [dataExtra, setDataExtra] = useState('');
  const [rotuloExtra, setRotuloExtra] = useState('');
  const [erroExtra, setErroExtra] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const params = filtro === 'todos' ? {} : { status: filtro };
      setOperacoes(await listarOperacoes(params));
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar operações');
    } finally {
      setCarregando(false);
    }
  }, [filtro]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const gerarCadencia = async () => {
    if (!podeGerenciar) return;
    const hoje = new Date();
    const ate = new Date(hoje);
    ate.setDate(ate.getDate() + 14);
    const de = hoje.toISOString().slice(0, 10);
    const ateStr = ate.toISOString().slice(0, 10);
    if (!window.confirm(`Gerar cadência de operações de ${formatDataBR(de)} a ${formatDataBR(ateStr)}?`)) return;
    setProcessando(true);
    setErro(null);
    try {
      const res = await fetch('/api/operacoes/gerar-cadencia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ de, ate: ateStr }),
      });
      if (!res.ok) throw new Error(await mensagemDeErro(res));
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao gerar cadência');
    } finally {
      setProcessando(false);
    }
  };

  const criarExtraordinaria = async () => {
    if (!dataExtra.match(/^\d{4}-\d{2}-\d{2}$/)) {
      setErroExtra('Informe uma data válida (YYYY-MM-DD).');
      return;
    }
    if (!rotuloExtra.trim()) {
      setErroExtra('Informe o rótulo da operação.');
      return;
    }
    setProcessando(true);
    setErroExtra(null);
    try {
      const res = await fetch('/api/operacoes/extraordinaria', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: dataExtra, rotulo: rotuloExtra.trim() }),
      });
      if (!res.ok) throw new Error(await mensagemDeErro(res));
      setModalExtra(false);
      setDataExtra('');
      setRotuloExtra('');
      await carregar();
    } catch (e) {
      setErroExtra(e instanceof Error ? e.message : 'Erro ao criar operação');
    } finally {
      setProcessando(false);
    }
  };

  const alterarStatus = async (id: string, status: Operacao['status']) => {
    setProcessando(true);
    setErro(null);
    try {
      const res = await fetch(`/api/operacoes/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error(await mensagemDeErro(res));
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao alterar status');
    } finally {
      setProcessando(false);
    }
  };

  const filtradas = operacoes;

  return (
    <div className="space-y-3">
      <PageHeader
        title="Operações"
        subtitle="Cada operação representa um dia de compra/venda. Compra Programada e Pedido de Venda sempre se vinculam a uma operação desta lista."
      >
        {podeGerenciar && (
          <>
            <Button variant="secondary" onClick={gerarCadencia} disabled={processando}>
              <RefreshCw />
              Gerar cadência
            </Button>
            <Button onClick={() => setModalExtra(true)} disabled={processando}>
              <Plus />
              Nova Operação Extraordinária
            </Button>
          </>
        )}
      </PageHeader>

      <div className="flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 p-3">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-600" />
        <p className="flex-1 text-xs leading-snug text-sky-900">
          <span className="font-semibold">Geração automática:</span> uma Operação é criada automaticamente para cada dia da cadência configurada (segunda, quarta e sexta — provisório). Para uma data fora dessa cadência, use &quot;Nova Operação Extraordinária&quot;. Ajuste a cadência em Administração / Parâmetros.
        </p>
        <BadgeProvisorio pendencia="P1" className="shrink-0" />
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
        <p className="flex-1 text-xs leading-snug text-amber-900">
          <span className="font-semibold">Ativar a operação não basta para vender:</span> o Pedido de Venda só lista operações que já têm uma <span className="font-semibold">Compra Programada confirmada</span> na mesma data — é ela que gera a disponibilidade virtual dos produtos. Uma operação sem compra aparece com o selo &quot;Sem compra programada&quot; abaixo; use &quot;Registrar compra&quot; para resolver.
        </p>
      </div>

      {erro && (
        <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {erro}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Operações</CardTitle>
          <BadgeCount>{filtradas.length}</BadgeCount>
          <CardAction>
            <SelectNative
              aria-label="Filtrar operações por status"
              selectSize="sm"
              className="w-[150px]"
              value={filtro}
              onChange={(e) => setFiltro(e.target.value as FiltroStatus)}
            >
              <option value="todos">Status: Todas</option>
              <option value="aberta">Aberta</option>
              <option value="em_andamento">Em andamento</option>
              <option value="fechada">Fechada</option>
            </SelectNative>
          </CardAction>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Operação</TableHead>
                <TableHead className="text-right">Data</TableHead>
                <TableHead>Dia da semana</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead className="text-right">Contadores</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {carregando ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-xs text-muted-foreground">
                    Carregando operações…
                  </TableCell>
                </TableRow>
              ) : filtradas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-xs text-muted-foreground">
                    Nenhuma operação encontrada para o filtro aplicado.
                  </TableCell>
                </TableRow>
              ) : (
                filtradas.map((o) => {
                  const proximo = proximoStatus(o.status);
                  return (
                    <TableRow key={o.id} className="group">
                      <TableCell className="whitespace-normal">
                        <p className="text-[13px] font-semibold text-foreground">{o.rotulo}</p>
                        <p className="font-data text-[10px] text-fg-faint">{o.id.slice(0, 8).toUpperCase()}</p>
                      </TableCell>
                      <TableCellNum>{formatDataBR(o.data)}</TableCellNum>
                      <TableCell className="capitalize text-muted-foreground">
                        {DIAS_SEMANA[o.diaSemana] ?? o.diaSemana}
                      </TableCell>
                      <TableCell>
                        {o.extraordinaria ? (
                          <BadgeCount className="bg-status-pesado-bg text-status-pesado">Extraordinária</BadgeCount>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">Cadência automática</span>
                        )}
                      </TableCell>
                      <TableCellNum>
                        {o.comprasProgramadas} compras · {o.pedidosVenda} pedidos · {o.pendenciasOverbookingAbertas} OB
                      </TableCellNum>
                      <TableCell>
                        <StatusPill variant={statusVariant(o.status)} label={ROTULO_STATUS_OPERACAO[o.status]} />
                        {o.status !== 'fechada' && o.comprasProgramadas === 0 && (
                          <div className="mt-1 flex items-center gap-1.5">
                            <span className="whitespace-nowrap text-[10px] font-medium text-amber-700">
                              Sem compra programada
                            </span>
                            <Link
                              href={`/gestao/compras?data=${o.data}`}
                              className="whitespace-nowrap text-[10px] font-semibold text-primary underline-offset-2 hover:underline"
                            >
                              Registrar compra
                            </Link>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {podeGerenciar && proximo && (
                          <div className="flex justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                            <Button
                              variant="secondary"
                              size="sm"
                              disabled={processando}
                              onClick={() => void alterarStatus(o.id, proximo)}
                            >
                              {rotuloAcaoStatus(proximo)}
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={modalExtra} onOpenChange={setModalExtra}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Operação extraordinária</DialogTitle>
          </DialogHeader>
          <p className="px-4 text-xs text-fg-secondary">
            Use esta opção quando precisar de uma Operação fora da cadência fixa (ex.: recebimento em outro dia da semana).
          </p>
          <div className="flex flex-col gap-3 px-4">
            <FormField label="Data da operação" htmlFor="data-extra">
              <DatePickerField id="data-extra" value={dataExtra} onChange={setDataExtra} />
            </FormField>
            <FormField label="Rótulo" htmlFor="rotulo-extra">
              <Input
                id="rotulo-extra"
                value={rotuloExtra}
                onChange={(e) => setRotuloExtra(e.target.value)}
                placeholder="Operação extraordinária — …"
              />
            </FormField>
            {erroExtra && <p className="text-xs text-destructive">{erroExtra}</p>}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setModalExtra(false)}>Cancelar</Button>
            <Button onClick={() => void criarExtraordinaria()} disabled={processando}>Criar Operação</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
