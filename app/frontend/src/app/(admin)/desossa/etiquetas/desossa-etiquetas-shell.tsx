'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { SeletorOperacao } from '@/components/gestao/seletor-operacao';
import { DesossaEtiquetasClient } from './desossa-etiquetas-client';

function Conteudo() {
  const searchParams = useSearchParams();
  const operacaoId = searchParams.get('operacaoId') ?? undefined;
  return (
    <div className="space-y-4">
      <SeletorOperacao />
      <DesossaEtiquetasClient operacaoId={operacaoId} />
    </div>
  );
}

export function DesossaEtiquetasShell() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Carregando…</p>}>
      <Conteudo />
    </Suspense>
  );
}
