'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { textoUtil } from '@/lib/fiscal-comum-ui';
import type { OpcaoCombo } from '@/lib/fiscal-enquadramentos';
import { ErroAcaoHomologacao, buscarMemoriasDaRegra } from '@/lib/fiscal-homologacoes';
import { CampoForm } from '../comum/campo-form';
import { useRetornoFoco } from '../empresas/use-retorno-foco';
import { ComboboxBusca } from '../enquadramentos/combobox-busca';

/** Homologação e versão da regra quando o diálogo abriu: só as memórias calculadas dela podem ser vinculadas. */
export interface AlvoCenario {
  regraId: string;
  versao: number;
}

interface Props {
  aberto: boolean;
  alvo: AlvoCenario | null;
  /** Motivo pelo qual o vínculo não pode mais ser enviado (registro removido por outro usuário). */
  bloqueado?: string | null;
  onFechar: () => void;
  /** Relê o registro após um 409 e devolve a versão nova, ou `null` se ele não existe mais. */
  onRecarregar: () => Promise<number | null>;
  /** Lança o erro que o diálogo deve mostrar. */
  onVincular: (simulacaoId: string, justificativa: string, versao: number) => Promise<void>;
}

export function CenarioDialog({ aberto, alvo, bloqueado = null, onFechar, onRecarregar, onVincular }: Props) {
  const retorno = useRetornoFoco(aberto);
  const [memoria, setMemoria] = useState<OpcaoCombo | null>(null);
  const [justificativa, setJustificativa] = useState('');
  const [erros, setErros] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [versao, setVersao] = useState(0);
  const [conflito, setConflito] = useState(false);
  const [recarregando, setRecarregando] = useState(false);
  /** Pedido em voo: o segundo clique não envia de novo. */
  const emVoo = useRef(false);
  const regraId = alvo?.regraId ?? '';
  const buscar = useCallback((termo: string) => buscarMemoriasDaRegra(regraId, termo), [regraId]);

  useEffect(() => {
    if (!aberto) return;
    setMemoria(null);
    setJustificativa('');
    setErros({});
    setErro(null);
    setAviso(null);
    setSalvando(false);
    setConflito(false);
    setVersao(alvo?.versao ?? 0);
    // Só a abertura inicializa: recarga da ficha por evento de outro usuário não apaga o que foi digitado.
  }, [aberto]);

  async function vincular() {
    if (emVoo.current) return;
    const locais: Record<string, string> = {};
    if (!memoria) locais.memoria = 'Escolha a memória calculada.';
    if (textoUtil(justificativa).length < 3) locais.justificativa = 'Informe a justificativa (mínimo de 3 caracteres).';
    setErros(locais);
    setErro(null);
    setAviso(null);
    setConflito(false);
    if (!memoria || Object.keys(locais).length > 0) return;
    emVoo.current = true;
    setSalvando(true);
    try {
      await onVincular(memoria.id, textoUtil(justificativa), versao);
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Falha na operação.');
      setConflito(falha instanceof ErroAcaoHomologacao && falha.conflito);
    } finally {
      emVoo.current = false;
      setSalvando(false);
    }
  }

  async function recarregar() {
    setRecarregando(true);
    try {
      const nova = await onRecarregar();
      setConflito(false);
      if (nova === null) {
        setErro('A homologação não está mais disponível.');
      } else {
        setVersao(nova);
        setErro(null);
        setAviso('Dados recarregados. Revise o que digitou e vincule de novo.');
      }
    } finally {
      setRecarregando(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(abertoAgora) => { if (!abertoAgora && !salvando) onFechar(); }}>
      <DialogContent aria-describedby={undefined} onCloseAutoFocus={retorno}>
        <DialogHeader>
          <DialogTitle>cenários aprovados</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 px-4">
          <CampoForm rotulo="Memória calculada" htmlFor="hom-memoria" erro={erros.memoria}>
            <ComboboxBusca
              id="hom-memoria"
              buscar={buscar}
              value={memoria?.id ?? ''}
              rotulo={memoria?.rotulo ?? ''}
              onChange={(opcao) => { setMemoria(opcao); setErros(({ memoria: _m, ...resto }) => resto); }}
              placeholder="Memória calculada"
              searchPlaceholder="Buscar memória calculada"
            />
          </CampoForm>
          <CampoForm rotulo="Justificativa auditável" htmlFor="justificativa-cenario" erro={erros.justificativa}>
            <textarea
              id="justificativa-cenario"
              maxLength={500}
              className="min-h-20 rounded-md border px-2 py-1 text-sm"
              value={justificativa}
              onChange={(e) => { setJustificativa(e.target.value); setErros(({ justificativa: _j, ...resto }) => resto); }}
            />
          </CampoForm>
          {erro && <p role="alert" className="text-xs text-destructive">{erro}</p>}
          {bloqueado && <p role="alert" className="text-xs text-destructive">{bloqueado}</p>}
          {aviso && <p role="status" className="text-xs text-muted-foreground">{aviso}</p>}
          {conflito && !bloqueado && (
            <Button type="button" variant="secondary" size="sm" className="justify-self-start" loading={recarregando} onClick={() => void recarregar()}>
              Recarregar dados
            </Button>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" disabled={salvando} onClick={onFechar}>Cancelar</Button>
          <Button type="button" loading={salvando} disabled={salvando || Boolean(bloqueado)} onClick={() => void vincular()}>Vincular</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
