'use client';

import type { OverbookingChallenge } from '@/lib/comercial';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ModalOverbookingProps {
  open: boolean;
  challenge: OverbookingChallenge;
  onConfirm: () => void;
  onCancel: () => void;
  pending?: boolean;
}

export function ModalOverbooking({
  open,
  challenge,
  onConfirm,
  onCancel,
  pending = false,
}: ModalOverbookingProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirmar overbooking</DialogTitle>
          <DialogDescription>{challenge.message}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {challenge.itens.map((item) => (
            <div key={item.itemComercialId} className="grid grid-cols-3 gap-3 rounded-lg border p-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Disponível</p>
                <p className="font-semibold">{item.disponivelAntes}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Solicitado</p>
                <p className="font-semibold">{item.quantidadeSolicitada}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Déficit</p>
                <p className="font-semibold text-destructive">{item.overbookingGerado}</p>
              </div>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button type="button" onClick={onConfirm} disabled={pending}>
            {pending ? 'Confirmando...' : 'Confirmar overbooking'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
