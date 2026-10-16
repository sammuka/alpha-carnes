'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { justificativaValida, textoUtil } from '@/lib/fiscal-comum-ui';
import { ErroAcaoHomologacao } from '@/lib/fiscal-homologacoes';
import { CampoForm } from '../comum/campo-form';
import { useRetornoFoco } from '../empresas/use-retorno-foco';

export interface AcaoDecisao {
  rotulo: string;
  perigosa?: boolean;
  /** Recebe a justificativa e a versão do registro vigente no diálogo; lança o erro que ele deve mostrar. */
  executar: (justificativa: string, versao: number) => Promise<void>;
}

/** Decisão que pede a justificativa auditável: aprovar/rejeitar (duas ações) ou publicar e auditar (uma). */
export interface DecisaoPendente {
  titulo: string;
  /** Versão do registro quando o diálogo abriu: é a enviada, mesmo que a ficha mude por evento de outro usuário. */
  versao: number;
  acoes: AcaoDecisao[];
  /** Relê o registro após um 409 e devolve a versão nova, ou `null` se ele não existe mais. */
  recarregar: () => Promise<number | null>;
}

interface Props {
  decisao: DecisaoPendente | null;
  /** Motivo pelo qual a decisão não pode mais ser enviada (registro removido por outro usuário). */
  bloqueado?: string | null;
  onFechar: () => void;
}

export function DecisaoDialog({ decisao, bloqueado = null, onFechar }: Props) {
  const retorno = useRetornoFoco(decisao !== null);
  const [justificativa, setJustificativa] = useState('');
  const [erroCampo, setErroCampo] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [processando, setProcessando] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);
  const [conflito, setConflito] = useState(false);
  const [removido, setRemovido] = useState(false);
  const [recarregando, setRecarregando] = useState(false);
  /** Pedido em voo: o segundo clique não envia de novo. */
  const emVoo = useRef(false);

  useEffect(() => {
    setJustificativa('');
    setErroCampo(null);
    setErro(null);
    setAviso(null);
    setProcessando(null);
    setConflito(false);
    setRemovido(false);
    setVersao(decisao?.versao ?? 0);
    emVoo.current = false;
  }, [decisao]);

  async function executar(acao: AcaoDecisao) {
    if (emVoo.current) return;
    if (!justificativaValida(justificativa)) {
      setErroCampo('Informe a justificativa (mínimo de 3 caracteres).');
      return;
    }
    setErroCampo(null);
    setErro(null);
    setAviso(null);
    setConflito(false);
    emVoo.current = true;
    setProcessando(acao.rotulo);
    try {
      await acao.executar(textoUtil(justificativa), versao);
      onFechar();
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Falha na operação.');
      setConflito(falha instanceof ErroAcaoHomologacao && falha.conflito);
      setRemovido(falha instanceof ErroAcaoHomologacao && falha.removido);
    } finally {
      emVoo.current = false;
      setProcessando(null);
    }
  }

  async function recarregar() {
    if (!decisao) return;
    setRecarregando(true);
    try {
      const nova = await decisao.recarregar();
      setConflito(false);
      if (nova === null) {
        setErro('A homologação não está mais disponível.');
      } else {
        setVersao(nova);
        setErro(null);
        setAviso('Dados recarregados. Revise o que digitou e confirme de novo.');
      }
    } finally {
      setRecarregando(false);
    }
  }

  return (
    <Dialog open={decisao !== null} onOpenChange={(aberto) => { if (!aberto && !processando) onFechar(); }}>
      <DialogContent aria-describedby={undefined} onCloseAutoFocus={retorno}>
        <DialogHeader>
          <DialogTitle>{decisao?.titulo}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 px-4">
          <CampoForm rotulo="Justificativa auditável" htmlFor="justificativa-decisao" erro={erroCampo ?? undefined}>
            <textarea
              id="justificativa-decisao"
              maxLength={500}
              className="min-h-20 rounded-md border px-2 py-1 text-sm"
              value={justificativa}
              onChange={(e) => { setJustificativa(e.target.value); setErroCampo(null); }}
            />
          </CampoForm>
          {erro && !bloqueado && <p role="alert" className="text-xs text-destructive">{erro}</p>}
          {bloqueado && <p role="alert" className="text-xs text-destructive">{bloqueado}</p>}
          {aviso && <p role="status" className="text-xs text-muted-foreground">{aviso}</p>}
          {conflito && !bloqueado && (
            <Button type="button" variant="secondary" size="sm" className="justify-self-start" loading={recarregando} onClick={() => void recarregar()}>
              Recarregar dados
            </Button>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" disabled={processando !== null} onClick={onFechar}>Cancelar</Button>
          {decisao?.acoes.map((acao) => (
            <Button
              key={acao.rotulo}
              type="button"
              variant={acao.perigosa ? 'destructive' : 'default'}
              loading={processando === acao.rotulo}
              disabled={Boolean(bloqueado) || removido || (processando !== null && processando !== acao.rotulo)}
              onClick={() => void executar(acao)}
            >
              {acao.rotulo}
            </Button>
          ))}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
