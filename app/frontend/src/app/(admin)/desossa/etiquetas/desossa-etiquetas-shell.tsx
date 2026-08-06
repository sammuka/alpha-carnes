'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { DesossaEtiquetasClient } from './desossa-etiquetas-client';

function Conteudo() {
  const searchParams = useSearchParams();
  const operacaoId = searchParams.get('operacaoId') ?? undefined;
  return <DesossaEtiquetasClient operacaoId={operacaoId} />;
}

export function DesossaEtiquetasShell() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Carregando…</p>}>
      <Conteudo />
    </Suspense>
  );
}
