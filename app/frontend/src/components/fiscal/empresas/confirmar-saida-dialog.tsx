'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useRetornoFoco } from './use-retorno-foco';

interface ConfirmarSaidaDialogProps {
  aberto: boolean;
  onAbertoChange: (aberto: boolean) => void;
  onDescartar: () => void;
}

/** Sair de um formulário com dados não salvos exige confirmação. */
export function ConfirmarSaidaDialog({ aberto, onAbertoChange, onDescartar }: ConfirmarSaidaDialogProps) {
  const retornoFoco = useRetornoFoco(aberto);
  return (
    <AlertDialog open={aberto} onOpenChange={onAbertoChange}>
      <AlertDialogContent onCloseAutoFocus={retornoFoco}>
        <AlertDialogHeader>
          <AlertDialogTitle>Descartar alterações?</AlertDialogTitle>
          <AlertDialogDescription>Há dados preenchidos que ainda não foram salvos.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Continuar editando</AlertDialogCancel>
          <AlertDialogAction onClick={onDescartar}>Descartar e sair</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
