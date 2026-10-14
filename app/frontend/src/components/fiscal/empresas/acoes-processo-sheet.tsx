'use client';

import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { SecaoRotulo } from './aba-ficha';

export interface ComandoProcesso {
  titulo: string;
  /** Quando preenchido, o comando fica desabilitado e o texto explica o motivo. */
  indisponivel?: string;
  abrir: () => void;
}

interface AcoesProcessoSheetProps {
  aberto: boolean;
  onFechar: () => void;
  comandos: ComandoProcesso[];
}

const CONDICIONANTES = [
  'Não admitir empresa sem identificação nem regime sobreposto; regras por estabelecimento e competência.',
  'Exceções: CNPJ rejeitado; troca de regime; competência bloqueada.',
];

/** "Ações do processo ▾": comandos de negócio do cadastro fiscal, com as condicionantes de aceite. */
export function AcoesProcessoSheet({ aberto, onFechar, comandos }: AcoesProcessoSheetProps) {
  return (
    <Sheet open={aberto} onOpenChange={(a) => { if (!a) onFechar(); }}>
      <SheetContent className="gap-0 p-0 sm:max-w-[480px]">
        <SheetHeader className="border-b border-border p-4">
          <SheetTitle className="text-[16px] font-bold">Ações e decisões do processo</SheetTitle>
          <SheetDescription className="text-xs">Operações previstas para empresas, estabelecimentos e regime</SheetDescription>
        </SheetHeader>
        <div className="flex-1 space-y-2 overflow-y-auto p-4">
          <SecaoRotulo>Comandos de negócio</SecaoRotulo>
          {comandos.map((comando, i) => (
            <div key={comando.titulo} className="rounded-md border border-border bg-surface-2 p-3">
              <b className="text-[13px]">
                {String(i + 1).padStart(2, '0')} · {comando.titulo}
              </b>
              <p className="my-2 text-[11px] text-muted-foreground">
                {comando.indisponivel ?? 'Confirme permissões, validade, origem e efeitos fiscais antes de registrar.'}
              </p>
              <Button type="button" size="sm" variant="secondary" disabled={!!comando.indisponivel} onClick={comando.abrir}>
                Abrir decisão →
              </Button>
            </div>
          ))}
          <SecaoRotulo>Condicionantes de aceite</SecaoRotulo>
          {CONDICIONANTES.map((texto) => (
            <div key={texto} className="rounded-md border-l-[3px] border-primary bg-surface-2 px-3 py-2.5 text-xs">
              {texto}
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
