'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { SelectNative } from '@/components/ui/select-native';
import { Textarea } from '@/components/ui/textarea';
import type { MotivoDivergenciaCarga, RomaneioItem } from '@/lib/operacao';

const MOTIVOS: Array<{ value: MotivoDivergenciaCarga; label: string }> = [
  { value: 'peca_ausente', label: 'Peça ausente' },
  { value: 'peca_errada', label: 'Peça errada' },
  { value: 'peso_divergente', label: 'Peso divergente' },
  { value: 'etiqueta_ilegivel', label: 'Etiqueta ilegível' },
  { value: 'avaria', label: 'Avaria' },
  { value: 'outro', label: 'Outro' },
];

export function ModalDivergencia({
  item,
  onClose,
  onConfirmar,
  pending = false,
}: {
  item: RomaneioItem | null;
  onClose: () => void;
  onConfirmar: (motivo: MotivoDivergenciaCarga, observacao: string) => void;
  pending?: boolean;
}) {
  const [motivo, setMotivo] = useState<MotivoDivergenciaCarga | ''>('');
  const [obs, setObs] = useState('');

  return (
    <Dialog
      open={!!item}
      onOpenChange={(v) => {
        if (!v) {
          onClose();
          setMotivo('');
          setObs('');
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Marcar divergência na peça</DialogTitle>
        </DialogHeader>
        {item && (
          <>
            <div className="grid grid-cols-2 gap-y-1.5 rounded-lg bg-surface-2 p-3 text-xs">
              <div>
                <span className="text-muted-foreground">Etiqueta: </span>
                <span className="font-data font-bold text-foreground">{item.etiqueta ?? '—'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Produto: </span>
                <span className="font-semibold text-foreground">{item.produtoNome}</span>
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground">Peso previsto: </span>
                <span className="font-data font-semibold text-foreground">
                  {item.peso == null ? '—' : `${Number(item.peso).toFixed(3).replace('.', ',')} kg`}
                </span>
              </div>
            </div>
            <FormField label="Motivo" required htmlFor="motivo-divergencia">
              <SelectNative
                id="motivo-divergencia"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value as MotivoDivergenciaCarga)}
              >
                <option value="">Selecionar...</option>
                {MOTIVOS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </SelectNative>
            </FormField>
            <FormField label="Observação" htmlFor="obs-divergencia">
              <Textarea id="obs-divergencia" rows={2} value={obs} onChange={(e) => setObs(e.target.value)} />
            </FormField>
          </>
        )}
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            Voltar
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!motivo || pending}
            onClick={() => {
              if (!motivo) return;
              onConfirmar(motivo, obs);
              setMotivo('');
              setObs('');
            }}
          >
            Confirmar Divergência
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
