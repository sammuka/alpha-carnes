'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { Diferenca, LinhaSimulacao } from '@/lib/fiscal-simulacoes';

interface Props {
  aberto: boolean;
  versoes: LinhaSimulacao[];
  diferencas: Diferenca[];
  onFechar: () => void;
  onComparar: (id: string) => void;
}

export function CompararDialog({ aberto, versoes, diferencas, onFechar, onComparar }: Props) {
  const [com, setCom] = useState('');
  return (
    <Dialog open={aberto} onOpenChange={(aberta) => { if (!aberta) onFechar(); }}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Comparar versões</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 px-4 pb-4 text-sm">
          <label className="grid gap-1 text-xs">Outra versão
            <select aria-label="Outra versão" className="h-8 rounded-md border px-2" value={com} onChange={(e) => setCom(e.target.value)}>
              <option value="">Selecione</option>
              {versoes.map((versao) => (
                <option key={versao.id} value={versao.id}>{versao.cliente} · {versao.produto}</option>
              ))}
            </select>
          </label>
          <Button type="button" variant="secondary" onClick={() => com && onComparar(com)}>Comparar versões</Button>
          <ul>
            {diferencas.map((item) => (
              <li key={item.campo}>{item.campo}: {item.antes} → {item.depois}</li>
            ))}
          </ul>
          <Button type="button" variant="secondary" onClick={onFechar}>Cancelar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
