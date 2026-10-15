'use client';

import type { Explicacao } from '@/lib/fiscal-simulacoes';

export function ExplicacaoPainel({ explicacao }: { explicacao: Explicacao }) {
  return (
    <div className="grid gap-3 text-sm">
      <ul className="grid gap-1">
        {explicacao.linhas.map((linha) => (
          <li key={linha.rotulo}>{linha.rotulo}: {linha.valor}</li>
        ))}
      </ul>
      <ul className="grid gap-2">
        {explicacao.semAliquota.map((item) => (
          <li key={item.rotulo}>
            <p>{item.rotulo}</p>
            <p>{item.tratamento}</p>
            <p>{item.texto}</p>
          </li>
        ))}
      </ul>
      {explicacao.textoBase && <p>{explicacao.textoBase}</p>}
      <p>{explicacao.referenciaLegal}</p>
    </div>
  );
}
