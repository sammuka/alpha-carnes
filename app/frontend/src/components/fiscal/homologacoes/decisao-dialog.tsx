'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useRetornoFoco } from '../empresas/use-retorno-foco';

interface Props {
  aberto: boolean;
  erro?: string | null;
  onFechar: () => void;
  onAprovar: (justificativa: string) => void;
  onRejeitar: (justificativa: string) => void;
}

export function DecisaoDialog({ aberto, erro, onFechar, onAprovar, onRejeitar }: Props) {
  const retorno = useRetornoFoco(aberto);
  const [justificativa, setJustificativa] = useState('Decisão de usuário diferente de quem submeteu.');
  return (
    <Dialog open={aberto} onOpenChange={(abertoAgora) => { if (!abertoAgora) onFechar(); }}>
      <DialogContent onCloseAutoFocus={retorno}>
        <DialogHeader>
          <DialogTitle>Aprovar/rejeitar</DialogTitle>
        </DialogHeader>
        <label className="grid gap-1 text-xs" htmlFor="justificativa-decisao">
          Justificativa auditável
          <textarea id="justificativa-decisao" className="min-h-20 rounded-md border px-2 py-1" value={justificativa} onChange={(e) => setJustificativa(e.target.value)} />
        </label>
        {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => onAprovar(justificativa)}>Aprovar</Button>
          <Button type="button" variant="destructive" onClick={() => onRejeitar(justificativa)}>Rejeitar</Button>
          <Button type="button" variant="secondary" onClick={onFechar}>Cancelar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
