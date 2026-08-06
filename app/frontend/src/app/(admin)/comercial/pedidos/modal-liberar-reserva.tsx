'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Textarea } from '@/components/ui/textarea';

interface ModalLiberarReservaProps {
  open: boolean;
  pedidoId: string;
  onConfirm: (justificativa: string) => void;
  onCancel: () => void;
  pending?: boolean;
}

export function ModalLiberarReserva({
  open,
  pedidoId,
  onConfirm,
  onCancel,
  pending = false,
}: ModalLiberarReservaProps) {
  const [justificativa, setJustificativa] = useState('');

  useEffect(() => {
    if (open) setJustificativa('');
  }, [open, pedidoId]);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Liberar reserva</DialogTitle>
          <DialogDescription>
            A ação cancela o rascunho {pedidoId}, libera suas reservas e fica registrada na auditoria.
          </DialogDescription>
        </DialogHeader>
        <FormField label="Justificativa" required htmlFor="justificativa-reserva" help="Mínimo de 10 caracteres.">
          <Textarea
            id="justificativa-reserva"
            value={justificativa}
            onChange={(event) => setJustificativa(event.target.value)}
            placeholder="Mínimo de 10 caracteres"
          />
        </FormField>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>
          <Button
            type="button"
            variant="destructive"
            disabled={pending || justificativa.trim().length < 10}
            onClick={() => onConfirm(justificativa.trim())}
          >
            {pending ? 'Liberando...' : 'Confirmar liberação'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
