'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Textarea } from '@/components/ui/textarea';
import {
  ehConflitoConcorrente,
  ErroFiscal,
  formatarDataIso,
  mensagemDoErroFiscal,
  rotuloRegime,
  type RegimeVigente,
} from '@/lib/fiscal-empresas';
import { useRetornoFoco } from './use-retorno-foco';
import { justificativaValida, normalizarJustificativa } from '@/lib/justificativa';

/** Descreve uma decisão que exige justificativa: submeter, aprovar, rejeitar, suspender, remover… */
export interface DecisaoPendente {
  titulo: string;
  detalhe: string;
  rotuloConfirmar: string;
  /** Sinaliza ações destrutivas (remover, descartar, suspender, rejeitar). */
  perigosa?: boolean;
  mensagemSucesso: string;
  executar: (justificativa: string, confirmarTroca: boolean) => Promise<unknown>;
  /**
   * Relê o registro após um 409 e devolve `true` se ele ainda existe. A tela passa a usar a versão
   * nova na próxima confirmação; o texto digitado fica no diálogo.
   */
  recarregar?: () => Promise<boolean>;
  /** Texto do aviso quando o servidor responde 404 (registro removido por outro usuário); o reenvio fica bloqueado. */
  mensagemRemovido?: string;
}

interface DecisaoDialogProps {
  decisao: DecisaoPendente | null;
  onFechar: () => void;
  /** Chamado após sucesso, para a tela recarregar lista e detalhe. */
  onConcluido: () => void;
  /** Chamado em 409 de concorrência, para a tela recarregar os dados. */
  onConflito: () => void;
}

interface DesafioTroca {
  fimProposto: string;
  /** Primeiro dia sem regime quando a nova versão já tem fim; nulo se ela fica em aberto. */
  semRegimeAPartirDe: string | null;
}

/** Texto do conflito de vigência devolvido em `REGIME_SOBREPOSTO`. */
function descreverConflito(dados: Record<string, unknown>): string | null {
  const conflito = dados.conflito as (RegimeVigente & { situacao?: string }) | undefined;
  if (!conflito) return null;
  const fim = conflito.vigenciaFim ? formatarDataIso(conflito.vigenciaFim) : 'sem fim';
  return `Conflita com ${rotuloRegime(conflito)} (${formatarDataIso(conflito.vigenciaInicio)} a ${fim}).`;
}

export function DecisaoDialog({ decisao, onFechar, onConcluido, onConflito }: DecisaoDialogProps) {
  const retornoFoco = useRetornoFoco(decisao !== null);
  const [justificativa, setJustificativa] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [erroCampo, setErroCampo] = useState<string | null>(null);
  const [processando, setProcessando] = useState(false);
  /** Pedido em voo: o segundo clique não envia de novo. */
  const emVoo = useRef(false);
  const [conflito, setConflito] = useState(false);
  const [removido, setRemovido] = useState(false);
  const [recarregando, setRecarregando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [desafio, setDesafio] = useState<DesafioTroca | null>(null);
  const retornoFocoTroca = useRetornoFoco(desafio !== null);

  useEffect(() => {
    setJustificativa('');
    setErro(null);
    setErroCampo(null);
    setDesafio(null);
    setConflito(false);
    setRemovido(false);
    setAviso(null);
  }, [decisao]);

  const executar = async (confirmarTroca: boolean) => {
    if (!decisao || emVoo.current) return;
    const texto = normalizarJustificativa(justificativa);
    if (!justificativaValida(texto)) {
      setErroCampo('Informe a justificativa (mínimo de 3 caracteres).');
      return;
    }
    setErroCampo(null);
    setErro(null);
    setAviso(null);
    setConflito(false);
    emVoo.current = true;
    setProcessando(true);
    try {
      await decisao.executar(texto, confirmarTroca);
      setDesafio(null);
      toast.success(decisao.mensagemSucesso);
      onConcluido();
      onFechar();
    } catch (falha) {
      if ((falha as { status?: number }).status === 404 && decisao.mensagemRemovido) {
        setDesafio(null);
        setRemovido(true);
        setErro(decisao.mensagemRemovido);
        return;
      }
      if (falha instanceof ErroFiscal && falha.codigo === 'TROCA_REGIME_CONFIRMACAO_NECESSARIA') {
        setDesafio({
          fimProposto: String(falha.dados.fimProposto ?? ''),
          semRegimeAPartirDe: typeof falha.dados.semRegimeAPartirDe === 'string' ? falha.dados.semRegimeAPartirDe : null,
        });
        return;
      }
      setDesafio(null);
      if (ehConflitoConcorrente(falha)) onConflito();
      if ((falha as { codigo?: string | null }).codigo === 'CONFLITO_CONCORRENTE') setConflito(true);
      const conflito = falha instanceof ErroFiscal && falha.codigo === 'REGIME_SOBREPOSTO'
        ? descreverConflito(falha.dados)
        : null;
      setErro([mensagemDoErroFiscal(falha), conflito].filter(Boolean).join(' '));
    } finally {
      emVoo.current = false;
      setProcessando(false);
    }
  };

  async function recarregar() {
    if (!decisao?.recarregar) return;
    setRecarregando(true);
    try {
      const existe = await decisao.recarregar();
      setConflito(false);
      if (existe) {
        setErro(null);
        setAviso('Dados recarregados. Revise o que digitou e confirme de novo.');
      } else {
        setErro('O registro não está mais disponível.');
      }
    } finally {
      setRecarregando(false);
    }
  }

  return (
    <>
      <Dialog open={decisao !== null} onOpenChange={(aberto) => { if (!aberto && !processando) onFechar(); }}>
        <DialogContent onCloseAutoFocus={retornoFoco}>
          <DialogHeader>
            <DialogTitle>{decisao?.titulo}</DialogTitle>
            <DialogDescription>{decisao?.detalhe}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 px-4">
            <FormField label="Justificativa" required htmlFor="decisao-justificativa" error={erroCampo}>
              <Textarea
                id="decisao-justificativa"
                rows={3}
                maxLength={500}
                placeholder="Registre a razão para a decisão"
                value={justificativa}
                aria-invalid={erroCampo !== null || undefined}
                onChange={(e) => {
                  setJustificativa(e.target.value);
                  setErroCampo(null);
                }}
              />
            </FormField>
            {erro && (
              <p role="alert" className="text-xs text-destructive">
                {erro}
              </p>
            )}
            {aviso && <p role="status" className="text-xs text-muted-foreground">{aviso}</p>}
            {conflito && decisao?.recarregar && (
              <Button type="button" variant="secondary" size="sm" className="justify-self-start" loading={recarregando} onClick={() => void recarregar()}>
                Recarregar dados
              </Button>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onFechar} disabled={processando}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant={decisao?.perigosa ? 'destructive' : 'default'}
              loading={processando}
              disabled={processando || removido}
              onClick={() => void executar(false)}
            >
              {decisao?.rotuloConfirmar}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Challenge 409: a troca de regime só segue com confirmação explícita. */}
      <AlertDialog open={desafio !== null} onOpenChange={(aberto) => { if (!aberto) setDesafio(null); }}>
        <AlertDialogContent onCloseAutoFocus={retornoFocoTroca}>
          <AlertDialogHeader>
            <AlertDialogTitle>Troca de regime tributário</AlertDialogTitle>
            <AlertDialogDescription>
              Encerrar o regime atual em {formatarDataIso(desafio?.fimProposto)} e submeter a troca?
              {desafio?.semRegimeAPartirDe && (
                <>
                  {' '}
                  Atenção: a partir de {formatarDataIso(desafio.semRegimeAPartirDe)} o estabelecimento ficará sem regime vigente.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button type="button" loading={processando} onClick={() => void executar(true)}>
              Encerrar e submeter
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
