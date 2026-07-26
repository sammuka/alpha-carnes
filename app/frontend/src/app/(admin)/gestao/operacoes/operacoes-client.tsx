'use client';

import { useCallback, useEffect, useState } from 'react';
import { Calendar, Info, Plus, RefreshCw } from 'lucide-react';
import { BadgeProvisorio } from '@/components/ui/badge-provisorio';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StatusPill, type StatusPillVariant } from '@/components/ui/status-pill';
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
      return 'expedido';
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
    <div className="flex h-full flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="mb-0.5 text-[11px] font-medium text-muted-foreground">Gestão / Operações</p>
          <h1 className="text-xl font-bold text-foreground">Operações</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Cada operação representa um dia de compra/venda. Compra Programada e Pedido de Venda sempre se vinculam a uma operação desta lista.
          </p>
        </div>
        {podeGerenciar && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={gerarCadencia} disabled={processando}>
              <RefreshCw className="mr-1.5 h-4 w-4" />
              Gerar cadência
            </Button>
            <Button onClick={() => setModalExtra(true)} disabled={processando}>
              <Plus className="mr-1.5 h-4 w-4" />
              Nova Operação Extraordinária
            </Button>
          </div>
        )}
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 p-3">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-600" />
        <p className="flex-1 text-xs leading-snug text-sky-900">
          <span className="font-semibold">Geração automática:</span> uma Operação é criada automaticamente para cada dia da cadência configurada (segunda, quarta e sexta — provisório). Para uma data fora dessa cadência, use &quot;Nova Operação Extraordinária&quot;. Ajuste a cadência em Administração / Parâmetros.
        </p>
        <BadgeProvisorio pendencia="P1" className="shrink-0" />
      </div>

      {erro && (
        <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {erro}
        </div>
      )}

      <div className="flex items-center gap-3">
        <select
          value={filtro}
          onChange={(e) => setFiltro(e.target.value as FiltroStatus)}
          className="h-8 rounded-md border border-border bg-card px-2.5 text-xs text-foreground"
        >
          <option value="todos">Status: Todas</option>
          <option value="aberta">Aberta</option>
          <option value="em_andamento">Em andamento</option>
          <option value="fechada">Fechada</option>
        </select>
        <span className="ml-auto text-xs text-muted-foreground">{filtradas.length} operação(ões)</span>
      </div>

      <div className="flex-1 overflow-y-auto rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="sticky top-0 border-b border-border bg-muted/30">
              {['Operação', 'Data', 'Dia da semana', 'Origem', 'Contadores', 'Status', 'Ações'].map((h) => (
                <th key={h} className="whitespace-nowrap px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {carregando ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                  Carregando operações…
                </td>
              </tr>
            ) : filtradas.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                  Nenhuma operação encontrada para o filtro aplicado.
                </td>
              </tr>
            ) : (
              filtradas.map((o) => {
                const proximo = proximoStatus(o.status);
                return (
                  <tr key={o.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-2.5">
                      <p className="font-semibold text-primary">{o.rotulo}</p>
                      <p className="font-mono text-[10px] text-muted-foreground">{o.id.slice(0, 8)}</p>
                    </td>
                    <td className="px-4 py-2.5">{formatDataBR(o.data)}</td>
                    <td className="px-4 py-2.5 capitalize">{DIAS_SEMANA[o.diaSemana] ?? o.diaSemana}</td>
                    <td className="px-4 py-2.5">
                      {o.extraordinaria ? (
                        <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[11px] font-semibold text-violet-700">
                          Extraordinária
                        </span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">Cadência automática</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {o.comprasProgramadas} compras · {o.pedidosVenda} pedidos · {o.pendenciasOverbookingAbertas} OB
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusPill variant={statusVariant(o.status)} label={ROTULO_STATUS_OPERACAO[o.status]} />
                    </td>
                    <td className="px-4 py-2.5">
                      {podeGerenciar && proximo && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={processando}
                          onClick={() => void alterarStatus(o.id, proximo)}
                        >
                          {rotuloAcaoStatus(proximo)}
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={modalExtra} onOpenChange={setModalExtra}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Operação extraordinária</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Use esta opção quando precisar de uma Operação fora da cadência fixa (ex.: recebimento em outro dia da semana).
          </p>
          <div className="space-y-3">
            <div>
              <Label htmlFor="data-extra">Data da operação</Label>
              <div className="relative mt-1">
                <Calendar className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="data-extra" type="date" className="pl-9" value={dataExtra} onChange={(e) => setDataExtra(e.target.value)} />
              </div>
            </div>
            <div>
              <Label htmlFor="rotulo-extra">Rótulo</Label>
              <Input id="rotulo-extra" className="mt-1" value={rotuloExtra} onChange={(e) => setRotuloExtra(e.target.value)} placeholder="Operação extraordinária — …" />
            </div>
            {erroExtra && <p className="text-xs text-destructive">{erroExtra}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalExtra(false)}>Cancelar</Button>
            <Button onClick={() => void criarExtraordinaria()} disabled={processando}>Criar Operação</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
