'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { errosPorCampo } from '@/lib/fiscal-comum-ui';
import { formatarPercentualPtBr, normalizarPercentual, type CorpoRegra, type DetalheRegra } from '@/lib/fiscal-regras';
import { CampoForm } from '../comum/campo-form';
import { useRetornoFoco } from '../empresas/use-retorno-foco';
import type { FalhaSalvar } from './regra-drawer';

interface Props {
  aberto: boolean;
  origem: DetalheRegra | null;
  onFechar: () => void;
  /** Devolve `null` quando gravou; senão a falha que o diálogo exibe. */
  onSalvar: (corpo: CorpoRegra & { versao: number }) => Promise<FalhaSalvar | null>;
}

export function VersaoDialog({ aberto, origem, onFechar, onSalvar }: Props) {
  const retornoFoco = useRetornoFoco(aberto);
  const [pIcms, setPIcms] = useState('');
  const [inicio, setInicio] = useState('');
  const [fim, setFim] = useState('');
  const [motivo, setMotivo] = useState('');
  const [erros, setErros] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!aberto || !origem) return;
    setPIcms(formatarPercentualPtBr(origem.pIcms));
    setInicio(origem.vigenciaInicio);
    setFim(origem.vigenciaFim ?? '');
    setMotivo('');
    setErros({});
    setErro(null);
  }, [aberto, origem?.id]);

  if (!origem) return null;

  function limpar(chave: string) {
    setErros(({ [chave]: _removido, ...resto }) => resto);
  }

  async function enviar() {
    if (!origem) return;
    const locais: Record<string, string> = {};
    if (normalizarPercentual(pIcms) === null) locais.pIcms = 'Informe um percentual de 0,00 a 100,00.';
    if (!inicio) locais.vigenciaInicio = 'Informe o início de vigência.';
    if (fim && inicio && fim < inicio) locais.vigenciaFim = 'Fim de vigência deve ser igual ou posterior ao início.';
    if (motivo.trim().length < 3) locais.justificativa = 'Informe o motivo (3 a 500 caracteres).';
    setErros(locais);
    setErro(null);
    if (Object.keys(locais).length > 0) return;
    setSalvando(true);
    try {
      const falha = await onSalvar({
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
      if (falha) {
        setErro(falha.mensagem);
        setErros(errosPorCampo(falha.porCampo));
      }
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(aberta) => { if (!aberta) onFechar(); }}>
      <DialogContent aria-describedby={undefined} onCloseAutoFocus={retornoFoco}>
        <DialogHeader>
          <DialogTitle>Adicionar versão</DialogTitle>
        </DialogHeader>
        <form
          noValidate
          className="grid gap-3 px-4 pb-4"
          onSubmit={(evento) => {
            evento.preventDefault();
            void enviar();
          }}
        >
          <p className="text-sm">Enquadramento fiscal {origem.enquadramentoCodigo}</p>
          <CampoForm rotulo="Alíquota (%)" erro={erros.pIcms}>
            <input aria-label="Alíquota da versão" inputMode="decimal" className="h-8 rounded-md border px-2" value={pIcms} onChange={(e) => { setPIcms(e.target.value); limpar('pIcms'); }} />
          </CampoForm>
          <CampoForm rotulo="Início de vigência" erro={erros.vigenciaInicio}>
            <input aria-label="Início da versão" type="date" className="h-8 rounded-md border px-2" value={inicio} onChange={(e) => { setInicio(e.target.value); limpar('vigenciaInicio'); }} />
          </CampoForm>
          <CampoForm rotulo="Fim de vigência" erro={erros.vigenciaFim}>
            <input aria-label="Fim da versão" type="date" className="h-8 rounded-md border px-2" value={fim} onChange={(e) => { setFim(e.target.value); limpar('vigenciaFim'); }} />
          </CampoForm>
          <CampoForm rotulo="Motivo" erro={erros.justificativa}>
            <textarea aria-label="Motivo da versão" maxLength={500} className="min-h-16 rounded-md border px-2" value={motivo} onChange={(e) => { setMotivo(e.target.value); limpar('justificativa'); }} />
          </CampoForm>
          {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onFechar} disabled={salvando}>Cancelar</Button>
            <Button type="submit" loading={salvando}>Salvar rascunho</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
