'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { DesossaPesagemClient } from './desossa-pesagem-client';

function Conteudo() {
  const searchParams = useSearchParams();
  const operacaoId = searchParams.get('operacaoId') ?? undefined;
  return <DesossaPesagemClient operacaoId={operacaoId} />;
}

export function DesossaPesagemShell() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Carregando…</p>}>
      <Conteudo />
    </Suspense>
  );
}
