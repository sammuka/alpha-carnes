'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { errosPorCampo, textoUtil, type FalhaSalvar } from '@/lib/fiscal-comum-ui';
import { formatarPercentualPtBr, normalizarPercentual, type CorpoRegra, type DetalheRegra } from '@/lib/fiscal-regras';
import { CampoForm } from '../comum/campo-form';
import { useRetornoFoco } from '../empresas/use-retorno-foco';

interface Props {
  aberto: boolean;
  /** Cópia da versão de origem, tirada ao abrir: a versão enviada é a que estava aberta nesse momento. */
  origem: DetalheRegra | null;
  /** Motivo pelo qual a versão nova não pode mais ser salva (registro removido por outro usuário). */
  bloqueado?: string | null;
  /** Relê a origem após um 409, troca a versão enviada e devolve `false` se ela não existe mais. */
  onRecarregar?: () => Promise<boolean>;
  onFechar: () => void;
  /** Devolve `null` quando gravou; senão a falha que o diálogo exibe. */
  onSalvar: (corpo: CorpoRegra & { versao: number }) => Promise<FalhaSalvar | null>;
}

export function VersaoDialog({ aberto, origem, bloqueado = null, onRecarregar, onFechar, onSalvar }: Props) {
  const retornoFoco = useRetornoFoco(aberto);
  const [pIcms, setPIcms] = useState('');
  const [inicio, setInicio] = useState('');
  const [fim, setFim] = useState('');
  const [motivo, setMotivo] = useState('');
  const [erros, setErros] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  /** Pedido em voo: o segundo clique não envia de novo. */
  const emVoo = useRef(false);
  const [conflito, setConflito] = useState(false);
  const [recarregando, setRecarregando] = useState(false);
  const [recarregado, setRecarregado] = useState(false);

  useEffect(() => {
    if (!aberto || !origem) return;
    setPIcms(formatarPercentualPtBr(origem.pIcms));
    setInicio(origem.vigenciaInicio);
    setFim(origem.vigenciaFim ?? '');
    setMotivo('');
    setErros({});
    setErro(null);
    setConflito(false);
    setRecarregado(false);
    // Só a abertura inicializa: recarga da ficha por evento de outro usuário não apaga o que foi digitado.
  }, [aberto]);

  if (!origem) return null;

  function limpar(chave: string) {
    setErros(({ [chave]: _removido, ...resto }) => resto);
  }

  async function enviar() {
    if (!origem || emVoo.current) return;
    const locais: Record<string, string> = {};
    if (normalizarPercentual(pIcms) === null) locais.pIcms = 'Informe um percentual de 0,00 a 100,00.';
    if (!inicio) locais.vigenciaInicio = 'Informe o início de vigência.';
    if (fim && inicio && fim < inicio) locais.vigenciaFim = 'Fim de vigência deve ser igual ou posterior ao início.';
    if (textoUtil(motivo).length < 3) locais.justificativa = 'Informe o motivo (3 a 500 caracteres).';
    setErros(locais);
    setErro(null);
    if (Object.keys(locais).length > 0) return;
    setRecarregado(false);
    emVoo.current = true;
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
        justificativa: textoUtil(motivo),
        versao: origem.versao,
      });
      setConflito(Boolean(falha?.conflito));
      if (falha) {
        setErro(falha.mensagem);
        setErros(errosPorCampo(falha.porCampo));
      }
    } finally {
      emVoo.current = false;
      setSalvando(false);
    }
  }

  async function recarregar() {
    if (!onRecarregar) return;
    setRecarregando(true);
    try {
      const existe = await onRecarregar();
      setConflito(false);
      setErro(null);
      setRecarregado(existe);
    } finally {
      setRecarregando(false);
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
          {bloqueado && <p role="alert" className="text-sm text-destructive">{bloqueado}</p>}
          {recarregado && <p role="status" className="text-sm text-muted-foreground">Dados recarregados. Revise o que digitou e salve de novo.</p>}
          {conflito && onRecarregar && !bloqueado && (
            <Button type="button" variant="secondary" size="sm" className="justify-self-start" loading={recarregando} onClick={() => void recarregar()}>Recarregar dados</Button>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onFechar} disabled={salvando}>Cancelar</Button>
            <Button type="submit" loading={salvando} disabled={salvando || Boolean(bloqueado)}>Salvar rascunho</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
