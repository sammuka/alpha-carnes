'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { ListaDiferencas } from '../comum/abas-fiscais';
import { useRetornoFoco } from '../empresas/use-retorno-foco';
import type { Diferenca } from '@/lib/fiscal-homologacoes';

interface Props {
  aberto: boolean;
  carregar: () => Promise<Diferenca[]>;
  onFechar: () => void;
}

/** Diff da versão em revisão: carrega ao abrir; o erro e o estado de carga ficam dentro do diálogo. */
export function DiffDialog({ aberto, carregar, onFechar }: Props) {
  const retorno = useRetornoFoco(aberto);
  const [diferencas, setDiferencas] = useState<Diferenca[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const carregarRef = useRef(carregar);
  carregarRef.current = carregar;

  useEffect(() => {
    if (!aberto) return;
    let ativo = true;
    setDiferencas(null);
    setErro(null);
    carregarRef.current()
      .then((lista) => { if (ativo) setDiferencas(lista); })
      .catch((falha: unknown) => { if (ativo) setErro(falha instanceof Error ? falha.message : 'Falha na operação.'); });
    return () => { ativo = false; };
  }, [aberto]);

  return (
    <Dialog open={aberto} onOpenChange={(abertoAgora) => { if (!abertoAgora) onFechar(); }}>
      <DialogContent aria-describedby={undefined} onCloseAutoFocus={retorno}>
        <DialogHeader>
          <DialogTitle>Revisar diff</DialogTitle>
        </DialogHeader>
        <div className="grid gap-2 px-4 text-sm">
          {diferencas === null && !erro && <Skeleton className="h-16" aria-label="Carregando o diff" />}
          {erro && <p role="alert" className="text-xs text-destructive">{erro}</p>}
          {diferencas && <ListaDiferencas diferencas={diferencas} />}
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onFechar}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
