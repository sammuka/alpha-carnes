import type { ReactNode } from 'react';
import { BadgeProvisorio } from '@/components/ui/badge-provisorio';

interface Props {
  rotulo: string;
  /** Pendência provisória que acompanha o campo (por exemplo, H-E01-10). */
  selo?: string;
  /** Erro do servidor ou da validação local, exibido junto do campo. */
  erro?: string;
  htmlFor?: string;
  children: ReactNode;
}

/** Campo de formulário das telas fiscais: rótulo, selo provisório, controle e erro do campo. */
export function CampoForm({ rotulo, selo, erro, htmlFor, children }: Props) {
  return (
    <div className="grid gap-1 text-xs">
      <span className="inline-flex items-center gap-2">
        <label htmlFor={htmlFor}>{rotulo}</label>
        {selo && <BadgeProvisorio codigo={selo} />}
      </span>
      {children}
      {erro && <p role="alert" className="text-[11px] font-medium text-destructive">{erro}</p>}
    </div>
  );
}
