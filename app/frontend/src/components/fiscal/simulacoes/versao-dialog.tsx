'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { CorpoSimulacao, DetalheSimulacao } from '@/lib/fiscal-simulacoes';

interface Props {
  aberto: boolean;
  origem: DetalheSimulacao | null;
  erro?: string | null;
  onFechar: () => void;
  onSalvar: (corpo: CorpoSimulacao & { versao: number }) => Promise<void>;
}

export function VersaoDialog({ aberto, origem, erro, onFechar, onSalvar }: Props) {
  const [desconto, setDesconto] = useState('');
  const [competencia, setCompetencia] = useState('');
  const [motivo, setMotivo] = useState('');

  useEffect(() => {
    if (!aberto || !origem) return;
    setDesconto(origem.desconto);
    setCompetencia(origem.competencia);
    setMotivo('');
  }, [aberto, origem]);

  if (!origem) return null;

  const corpo: CorpoSimulacao & { versao: number } = {
    estabelecimentoId: origem.estabelecimentoId ?? '',
    operacaoId: origem.operacaoId ?? '',
    clienteId: origem.clienteId ?? '',
    produtoId: origem.produtoId ?? '',
    ncmId: origem.ncmId ?? '',
    quantidade: origem.quantidade,
    pesoNf: origem.pesoNf,
    valor: origem.valor,
    desconto,
    competencia,
    enquadramentoId: origem.enquadramentoId ?? '',
    justificativa: motivo.trim(),
    versao: origem.versao,
  };

  return (
    <Dialog open={aberto} onOpenChange={(aberta) => { if (!aberta) onFechar(); }}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Nova versão</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 px-4 pb-4 text-sm">
          <p>Enquadramento fiscal {origem.enquadramento}</p>
          <label className="grid gap-1 text-xs">Desconto
            <input aria-label="Desconto da versão" className="h-8 rounded-md border px-2" value={desconto} onChange={(e) => setDesconto(e.target.value)} />
          </label>
          <label className="grid gap-1 text-xs">Competência
            <input aria-label="Competência da versão" type="month" className="h-8 rounded-md border px-2" value={competencia} onChange={(e) => setCompetencia(e.target.value)} />
          </label>
          <label className="grid gap-1 text-xs" htmlFor="versao-motivo">Motivo da alteração
            <textarea id="versao-motivo" className="min-h-16 rounded-md border px-2" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          </label>
          {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
          <Button type="button" onClick={() => void onSalvar(corpo)}>Salvar rascunho</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
