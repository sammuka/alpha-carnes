'use client';

import { useEffect, useState } from 'react';
import { BadgeProvisorio } from '@/components/ui/badge-provisorio';
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

interface ModalAdendoProps {
  open: boolean;
  pedido: {
    pedidoId: string;
    status: string;
    produtoId: string;
    quantidadeAtual: string;
  };
  quantidadeAdicionar: number;
  onConfirm: (motivo: string) => void;
  onCancel: () => void;
  pending?: boolean;
}

export function ModalAdendo({
  open,
  pedido,
  quantidadeAdicionar,
  onConfirm,
  onCancel,
  pending = false,
}: ModalAdendoProps) {
  const [motivo, setMotivo] = useState('');

  useEffect(() => {
    if (open) setMotivo('');
  }, [open, pedido.pedidoId]);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle>Registrar adendo</DialogTitle>
            <BadgeProvisorio codigo="P5" />
          </div>
          <DialogDescription>
            Pedido {pedido.pedidoId} já aberto. Quantidade atual: {pedido.quantidadeAtual}.
            Adição solicitada: {quantidadeAdicionar}.
          </DialogDescription>
        </DialogHeader>
        <FormField label="Motivo" required htmlFor="motivo-adendo" help="A política de preço em adendos permanece provisória até a decisão P5.">
          <Textarea
            id="motivo-adendo"
            value={motivo}
            onChange={(event) => setMotivo(event.target.value)}
            placeholder="Descreva a solicitação do cliente"
          />
        </FormField>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>
          <Button
            type="button"
            disabled={pending || motivo.trim().length < 3}
            onClick={() => onConfirm(motivo.trim())}
          >
            {pending ? 'Registrando...' : 'Registrar adendo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
