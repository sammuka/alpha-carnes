'use client';

import { BadgeProvisorio } from '@/components/ui/badge-provisorio';
import type { Explicacao } from '@/lib/fiscal-simulacoes';

const COM_SELO = new Set(['Início de vigência', 'Fim de vigência']);

export function ExplicacaoPainel({ explicacao }: { explicacao: Explicacao }) {
  return (
    <div className="grid gap-3 text-sm">
      <ul aria-label="Explicação dos tributos" className="grid gap-1">
        {explicacao.linhas.map((linha) => (
          <li key={linha.rotulo} className="flex flex-wrap items-center gap-2">
            {linha.rotulo}: {linha.valor}
            {COM_SELO.has(linha.rotulo) && <BadgeProvisorio codigo="H-E01-10" />}
          </li>
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
