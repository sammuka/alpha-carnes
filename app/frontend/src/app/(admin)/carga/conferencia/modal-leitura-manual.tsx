'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Textarea } from '@/components/ui/textarea';

export function ModalLeituraManual({
  open,
  codigo,
  onClose,
  onConfirmar,
  pending = false,
}: {
  open: boolean;
  codigo: string;
  onClose: () => void;
  onConfirmar: (motivo: string) => void;
  pending?: boolean;
}) {
  const [motivo, setMotivo] = useState('');

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          onClose();
          setMotivo('');
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Leitura manual — informe o motivo</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-y-1.5 rounded-lg bg-surface-2 p-3 text-xs">
          <div className="col-span-2">
            <span className="text-muted-foreground">Código digitado: </span>
            <span className="font-data font-bold text-foreground">{codigo}</span>
          </div>
        </div>
        <FormField label="Motivo" required htmlFor="motivo-leitura-manual">
          <Textarea
            id="motivo-leitura-manual"
            rows={2}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ex.: leitor indisponível, etiqueta danificada..."
          />
        </FormField>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            Voltar
          </Button>
          <Button
            type="button"
            disabled={!motivo.trim() || pending}
            onClick={() => {
              if (!motivo.trim()) return;
              onConfirmar(motivo.trim());
              setMotivo('');
            }}
          >
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
