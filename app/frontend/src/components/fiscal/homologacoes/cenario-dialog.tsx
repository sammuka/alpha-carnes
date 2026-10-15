'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { homologacoesApi, type MemoriaCenario } from '@/lib/fiscal-homologacoes';
import { useRetornoFoco } from '../empresas/use-retorno-foco';

interface Props {
  aberto: boolean;
  enquadramento: string;
  erro?: string | null;
  onFechar: () => void;
  onVincular: (simulacaoId: string, justificativa: string) => void;
}

export function CenarioDialog({ aberto, enquadramento, erro, onFechar, onVincular }: Props) {
  const retorno = useRetornoFoco(aberto);
  const [memorias, setMemorias] = useState<MemoriaCenario[]>([]);
  const [escolha, setEscolha] = useState('');
  const [justificativa, setJustificativa] = useState('Vínculo da memória desta versão.');

  useEffect(() => {
    if (!aberto) return;
    void homologacoesApi.memorias(enquadramento).then((lista) => {
      setMemorias(lista);
      const primeira = lista[0];
      if (primeira) setEscolha(primeira.id);
    }).catch(() => setMemorias([]));
  }, [aberto, enquadramento]);

  return (
    <Dialog open={aberto} onOpenChange={(abertoAgora) => { if (!abertoAgora) onFechar(); }}>
      <DialogContent onCloseAutoFocus={retorno}>
        <DialogHeader>
          <DialogTitle>cenários aprovados</DialogTitle>
        </DialogHeader>
        <label className="grid gap-1 text-xs" htmlFor="memoria-cenario">
          Memória calculada
          <select id="memoria-cenario" aria-label="Memória calculada" className="h-8 rounded-md border px-2" value={escolha} onChange={(e) => setEscolha(e.target.value)}>
            <option value="">Selecione</option>
            {memorias.map((memoria) => (
              <option key={memoria.id} value={memoria.id}>{memoria.rotulo}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs" htmlFor="justificativa-cenario">
          Justificativa auditável
          <textarea id="justificativa-cenario" className="min-h-20 rounded-md border px-2 py-1" value={justificativa} onChange={(e) => setJustificativa(e.target.value)} />
        </label>
        {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={!escolha} onClick={() => onVincular(escolha, justificativa)}>Vincular</Button>
          <Button type="button" variant="secondary" onClick={onFechar}>Cancelar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
