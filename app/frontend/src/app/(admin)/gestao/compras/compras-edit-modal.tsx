'use client';

import { useCallback, useEffect, useState } from 'react';
import { History } from 'lucide-react';
import { PainelImpacto } from '@/components/gestao/painel-impacto';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type {
  CompraProgramadaDetalhe,
  HistoricoCompraItem,
  ImpactoCompra,
  RespostaEdicaoItem,
} from '@/lib/comercial';
import { mensagemDeErro } from '@/lib/error-message';

interface Props {
  open: boolean;
  compra: CompraProgramadaDetalhe | null;
  itensCompra: Array<{ id: string; nome?: string | null; codigo?: string | null }>;
  onClose: () => void;
  onSalvo: () => void;
}

export function ComprasEditModal({ open, compra, itensCompra, onClose, onSalvo }: Props) {
  const [qtds, setQtds] = useState<Record<string, string>>({});
  const [impacto, setImpacto] = useState<ImpactoCompra | null>(null);
  const [historico, setHistorico] = useState<HistoricoCompraItem[]>([]);
  const [confirmarDeficit, setConfirmarDeficit] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!compra) return;
    const init: Record<string, string> = {};
    for (const it of compra.itens) init[it.id] = it.quantidadeComprada;
    setQtds(init);
    setConfirmarDeficit(false);
    setImpacto(null);
    setErro(null);
    void fetch(`/api/comercial/compras-programadas/${compra.id}/historico`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setHistorico);
  }, [compra]);

  const simularImpacto = useCallback(async () => {
    if (!compra) return;
    const partes = compra.itens.map((it) => `${it.itemCompraId}:${qtds[it.id] ?? it.quantidadeComprada}`);
    const timer = setTimeout(async () => {
      const res = await fetch(
        `/api/comercial/compras-programadas/${compra.id}/impacto?simulacao=${encodeURIComponent(partes.join(','))}`,
      );
      if (res.ok) setImpacto((await res.json()) as ImpactoCompra);
    }, 300);
    return () => clearTimeout(timer);
  }, [compra, qtds]);

  useEffect(() => {
    const cleanup = simularImpacto();
    return () => {
      void cleanup?.then((fn) => fn?.());
    };
  }, [simularImpacto]);

  const montarDescricaoHistorico = (h: HistoricoCompraItem): string => {
    const ant = h.dadosAnteriores as { quantidadeComprada?: string } | null;
    const novo = h.dadosNovos as { quantidadeComprada?: string } | null;
    if (ant?.quantidadeComprada && novo?.quantidadeComprada) {
      return `Quantidade alterada de ${ant.quantidadeComprada} para ${novo.quantidadeComprada}`;
    }
    return `${h.operacao} em ${h.tabela}`;
  };

  const salvar = async (forcarDeficit = false) => {
    if (!compra) return;
    setSalvando(true);
    setErro(null);
    try {
      for (const item of compra.itens) {
        const qtd = qtds[item.id];
        if (!qtd || qtd === item.quantidadeComprada) continue;
        const res = await fetch(`/api/comercial/compras-programadas/${compra.id}/itens/${item.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            quantidadeComprada: Number(qtd),
            confirmarDeficit: forcarDeficit || confirmarDeficit,
          }),
        });
        if (res.status === 409) {
          const body = await res.json();
          if ((body as { codigo?: string }).codigo === 'IMPACTO_CONFIRMACAO_NECESSARIA') {
            setImpacto((body as { impacto: ImpactoCompra }).impacto);
            setConfirmarDeficit(true);
            setErro('Confirme o déficit projetado para prosseguir.');
            setSalvando(false);
            return;
          }
        }
        if (!res.ok) throw new Error(await mensagemDeErro(res));
        const parsed = (await res.json()) as RespostaEdicaoItem;
        setImpacto(parsed.impacto);
      }
      onSalvo();
      onClose();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  };

  if (!compra) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar compra confirmada</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {compra.itens.map((it) => (
            <div key={it.id} className="flex items-center gap-3">
              <span className="flex-1 text-sm font-medium">
                {itensCompra.find((c) => c.id === it.itemCompraId)?.nome ?? it.itemCompraId.slice(0, 8)}
              </span>
              <Input
                type="number"
                step="0.001"
                className="w-28"
                value={qtds[it.id] ?? ''}
                onChange={(e) => setQtds((p) => ({ ...p, [it.id]: e.target.value }))}
              />
            </div>
          ))}
          {impacto && <PainelImpacto impacto={impacto} />}
          <div>
            <div className="mb-2 flex items-center gap-1.5">
              <History className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-bold uppercase text-muted-foreground">Histórico de alterações desta compra</span>
            </div>
            {historico.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma alteração registrada ainda.</p>
            ) : (
              <ul className="max-h-40 divide-y overflow-y-auto rounded-lg border text-xs">
                {historico.map((h) => (
                  <li key={h.id} className="px-3 py-2">
                    <div className="flex justify-between">
                      <span className="font-semibold">{h.usuarioNome ?? '—'}</span>
                      <span className="text-muted-foreground">{new Date(h.dataHora).toLocaleString('pt-BR')}</span>
                    </div>
                    <p className="text-muted-foreground">{montarDescricaoHistorico(h)}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {erro && <p className="text-sm text-destructive">{erro}</p>}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          {confirmarDeficit ? (
            <Button onClick={() => void salvar(true)} disabled={salvando}>Salvar mesmo assim</Button>
          ) : (
            <Button onClick={() => void salvar()} disabled={salvando}>Salvar alteração</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
