'use client';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { Diferenca } from '@/lib/fiscal-homologacoes';
import { useRetornoFoco } from '../empresas/use-retorno-foco';

interface Props {
  aberto: boolean;
  diferencas: Diferenca[];
  onFechar: () => void;
}

export function DiffDialog({ aberto, diferencas, onFechar }: Props) {
  const retorno = useRetornoFoco(aberto);
  return (
    <Dialog open={aberto} onOpenChange={(abertoAgora) => { if (!abertoAgora) onFechar(); }}>
      <DialogContent onCloseAutoFocus={retorno}>
        <DialogHeader>
          <DialogTitle>Revisar diff</DialogTitle>
        </DialogHeader>
        <ul className="grid gap-1 text-sm">
          {diferencas.map((item) => (
            <li key={item.campo}>
              {item.campo}: {item.antes == null ? item.depois : `${item.antes} → ${item.depois}`}
            </li>
          ))}
        </ul>
        <Button type="button" variant="secondary" onClick={onFechar}>Cancelar</Button>
      </DialogContent>
    </Dialog>
  );
}
