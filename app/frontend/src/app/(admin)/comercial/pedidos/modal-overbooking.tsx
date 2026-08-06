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
import {
  Table,
  TableBody,
  TableCell,
  TableCellNum,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

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
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Produto</TableHead>
              <TableHead className="text-right">Disponível</TableHead>
              <TableHead className="text-right">Solicitado</TableHead>
              <TableHead className="text-right">Déficit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {challenge.itens.map((item) => (
              <TableRow key={item.itemComercialId}>
                <TableCell className="text-[13px] font-semibold text-foreground">
                  {item.itemComercialId}
                </TableCell>
                <TableCellNum>{item.disponivelAntes}</TableCellNum>
                <TableCellNum>{item.quantidadeSolicitada}</TableCellNum>
                <TableCellNum className="text-danger-fg font-bold">{item.overbookingGerado}</TableCellNum>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>
          <Button type="button" variant="destructive" onClick={onConfirm} disabled={pending}>
            {pending ? 'Confirmando...' : 'Confirmar overbooking'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
