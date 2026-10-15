'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatarPercentualPtBr, type CorpoRegra, type DetalheRegra } from '@/lib/fiscal-regras';

interface Props {
  aberto: boolean;
  origem: DetalheRegra | null;
  erro: string | null;
  onFechar: () => void;
  onSalvar: (corpo: CorpoRegra & { versao: number }) => Promise<void>;
}

export function VersaoDialog({ aberto, origem, erro, onFechar, onSalvar }: Props) {
  const [pIcms, setPIcms] = useState('');
  const [inicio, setInicio] = useState('');
  const [fim, setFim] = useState('');
  const [motivo, setMotivo] = useState('');

  useEffect(() => {
    if (!aberto || !origem) return;
    setPIcms(formatarPercentualPtBr(origem.pIcms));
    setInicio(origem.vigenciaInicio);
    setFim(origem.vigenciaFim ?? '');
    setMotivo('');
  }, [aberto, origem]);

  if (!origem) return null;

  return (
    <Dialog open={aberto} onOpenChange={(aberta) => { if (!aberta) onFechar(); }}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Adicionar versão</DialogTitle>
        </DialogHeader>
        <form
          className="grid gap-3 px-4 pb-4"
          onSubmit={(evento) => {
            evento.preventDefault();
            void onSalvar({
              enquadramentoId: origem.enquadramentoId,
              operacaoId: origem.operacaoId,
              cfopId: origem.cfopId,
              icmsCst: origem.icmsCst,
              pRedBc: formatarPercentualPtBr(origem.pRedBc),
              pIcms,
              beneficioFiscalId: origem.beneficioFiscalId,
              ipiCst: origem.ipiCst,
              pisCst: origem.pisCst,
              ibsCst: origem.ibsCst,
              classificacaoIbsCbsId: origem.classificacaoIbsCbsId,
              vigenciaInicio: inicio,
              vigenciaFim: fim || null,
              justificativa: motivo.trim(),
              versao: origem.versao,
            });
          }}
        >
          <p className="text-sm">Enquadramento fiscal {origem.codigo}</p>
          <label className="grid gap-1 text-xs">Alíquota (%)
            <input aria-label="Alíquota da versão" inputMode="decimal" className="h-8 rounded-md border px-2" value={pIcms} onChange={(e) => setPIcms(e.target.value)} />
          </label>
          <label className="grid gap-1 text-xs">Início de vigência
            <input aria-label="Início da versão" type="date" className="h-8 rounded-md border px-2" value={inicio} onChange={(e) => setInicio(e.target.value)} />
          </label>
          <label className="grid gap-1 text-xs">Fim de vigência
            <input aria-label="Fim da versão" type="date" className="h-8 rounded-md border px-2" value={fim} onChange={(e) => setFim(e.target.value)} />
          </label>
          <label className="grid gap-1 text-xs">Motivo
            <textarea aria-label="Motivo da versão" className="min-h-16 rounded-md border px-2" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
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
