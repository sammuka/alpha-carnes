'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
            <div className="grid grid-cols-2 gap-y-1.5 rounded-lg bg-muted/30 p-3 text-xs">
              <div>
                <span className="text-muted-foreground">Etiqueta: </span>
                <span className="font-bold text-foreground">{item.etiqueta ?? '—'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Produto: </span>
                <span className="font-semibold text-foreground">{item.produtoNome}</span>
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground">Peso previsto: </span>
                <span className="font-semibold text-foreground">
                  {item.peso == null ? '—' : `${Number(item.peso).toFixed(3).replace('.', ',')} kg`}
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="motivo-divergencia">
                Motivo <span className="text-destructive">*</span>
              </Label>
              <Select value={motivo} onValueChange={(v) => setMotivo(v as MotivoDivergenciaCarga)}>
                <SelectTrigger id="motivo-divergencia">
                  <SelectValue placeholder="Selecionar..." />
                </SelectTrigger>
                <SelectContent>
                  {MOTIVOS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="obs-divergencia">Observação</Label>
              <Textarea id="obs-divergencia" rows={2} value={obs} onChange={(e) => setObs(e.target.value)} />
            </div>
          </>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
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
