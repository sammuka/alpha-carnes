'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { codigoFiscalValido, normalizarCest, normalizarCfop, normalizarNcm } from '@/lib/fiscal-enquadramentos';
import { useRetornoFoco } from '../empresas/use-retorno-foco';

interface Props {
  aberto: boolean;
  tipo: 'cfops' | 'ncms' | null;
  onFechar: () => void;
  onConfirmar: (corpo: { codigo: string; descricao: string; justificativa: string }) => void | Promise<void>;
}

const AVISO = 'Cadastro manual. A tabela oficial completa não está carregada; confira o código na documentação fiscal.';

export function CodigoFiscalDialog({ aberto, tipo, onFechar, onConfirmar }: Props) {
  const retornoFoco = useRetornoFoco(aberto);
  const [codigo, setCodigo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const titulo = tipo === 'ncms' ? 'Classificação fiscal (NCM)' : 'Operação fiscal (CFOP)';

  useEffect(() => {
    if (!aberto) return;
    setCodigo('');
    setDescricao('');
    setMotivo('');
    setErro(null);
  }, [aberto, tipo]);

  return (
    <Dialog open={aberto} onOpenChange={(aberta) => { if (!aberta) onFechar(); }}>
      <DialogContent onCloseAutoFocus={retornoFoco} aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
        </DialogHeader>
        <form
          className="grid gap-3 px-4 pb-4"
          onSubmit={(evento) => {
            evento.preventDefault();
            if (!tipo) return;
            const normalizado = tipo === 'ncms' ? normalizarNcm(codigo) : normalizarCfop(codigo);
            if (!codigoFiscalValido(tipo, normalizado)) {
              setErro(tipo === 'ncms' ? 'NCM deve ter 8 dígitos.' : 'CFOP deve ter 4 dígitos.');
              return;
            }
            setErro(null);
            void Promise.resolve(onConfirmar({
              codigo: normalizado,
              descricao: descricao.trim(),
              justificativa: motivo.trim(),
            })).catch((falha: unknown) => {
              setErro(falha instanceof Error ? falha.message : 'Falha na operação.');
            });
          }}
        >
          <p className="text-xs text-muted-foreground">{AVISO}</p>
          <label className="grid gap-1 text-xs">Código
            <input aria-label="Código" className="h-8 rounded-md border px-2" value={codigo} onChange={(e) => setCodigo(e.target.value)} />
          </label>
          <label className="grid gap-1 text-xs">Descrição
            <input aria-label="Descrição" className="h-8 rounded-md border px-2" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </label>
          <label className="grid gap-1 text-xs">Motivo
            <textarea aria-label="Motivo do código" className="min-h-16 rounded-md border px-2" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          </label>
          {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onFechar}>Cancelar</Button>
            <Button type="submit">Salvar rascunho</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function mascaraCest(valor: string): string {
  return normalizarCest(valor);
}
