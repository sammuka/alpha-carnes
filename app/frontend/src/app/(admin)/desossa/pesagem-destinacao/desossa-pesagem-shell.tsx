'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { SeletorOperacao } from '@/components/gestao/seletor-operacao';
import { DesossaPesagemClient } from './desossa-pesagem-client';

function Conteudo() {
  const searchParams = useSearchParams();
  const operacaoId = searchParams.get('operacaoId') ?? undefined;
  return (
    <div className="space-y-4">
      <SeletorOperacao />
      <DesossaPesagemClient operacaoId={operacaoId} />
    </div>
  );
}

export function DesossaPesagemShell() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Carregando…</p>}>
      <Conteudo />
    </Suspense>
  );
}
