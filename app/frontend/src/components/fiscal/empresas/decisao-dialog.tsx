'use client';

import { useEffect, useState } from 'react';
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
import { normalizarJustificativa } from '@/lib/justificativa';

/** Descreve uma decisão que exige justificativa: submeter, aprovar, rejeitar, suspender, remover… */
export interface DecisaoPendente {
  titulo: string;
  detalhe: string;
  rotuloConfirmar: string;
  /** Sinaliza ações destrutivas (remover, descartar, suspender, rejeitar). */
  perigosa?: boolean;
  mensagemSucesso: string;
  executar: (justificativa: string, confirmarTroca: boolean) => Promise<unknown>;
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
  const [desafio, setDesafio] = useState<DesafioTroca | null>(null);
  const retornoFocoTroca = useRetornoFoco(desafio !== null);

  useEffect(() => {
    setJustificativa('');
    setErro(null);
    setErroCampo(null);
    setDesafio(null);
  }, [decisao]);

  const executar = async (confirmarTroca: boolean) => {
    if (!decisao) return;
    // Caracteres de largura zero não contam para o mínimo (o servidor os remove).
    const texto = justificativa.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
    if (texto.length < 3) {
      setErroCampo('Informe a justificativa (mínimo de 3 caracteres).');
      return;
    }
    setErroCampo(null);
    setErro(null);
    setProcessando(true);
    try {
      await decisao.executar(texto, confirmarTroca);
      setDesafio(null);
      toast.success(decisao.mensagemSucesso);
      onConcluido();
      onFechar();
    } catch (falha) {
      if (falha instanceof ErroFiscal && falha.codigo === 'TROCA_REGIME_CONFIRMACAO_NECESSARIA') {
        setDesafio({
          fimProposto: String(falha.dados.fimProposto ?? ''),
          semRegimeAPartirDe: typeof falha.dados.semRegimeAPartirDe === 'string' ? falha.dados.semRegimeAPartirDe : null,
        });
        return;
      }
      setDesafio(null);
      if (ehConflitoConcorrente(falha)) onConflito();
      const conflito = falha instanceof ErroFiscal && falha.codigo === 'REGIME_SOBREPOSTO'
        ? descreverConflito(falha.dados)
        : null;
      setErro([mensagemDoErroFiscal(falha), conflito].filter(Boolean).join(' '));
    } finally {
      setProcessando(false);
    }
  };

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
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onFechar} disabled={processando}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant={decisao?.perigosa ? 'destructive' : 'default'}
              loading={processando}
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
