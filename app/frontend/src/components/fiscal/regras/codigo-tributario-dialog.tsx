'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { errosPorCampo, justificativaValida, textoUtil } from '@/lib/fiscal-comum-ui';
import { ErroRegra } from '@/lib/fiscal-regras';
import { CampoForm } from '../comum/campo-form';
import { useRetornoFoco } from '../empresas/use-retorno-foco';

interface Props {
  aberto: boolean;
  tipo: 'beneficio' | 'classificacao' | null;
  onFechar: () => void;
  onConfirmar: (corpo: { codigo: string; descricao: string; justificativa: string }) => Promise<void>;
}

const AVISO = 'Cadastro manual. A tabela oficial completa não está carregada; confira o código na documentação fiscal.';

export function CodigoTributarioDialog({ aberto, tipo, onFechar, onConfirmar }: Props) {
  const retornoFoco = useRetornoFoco(aberto);
  const [codigo, setCodigo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [motivo, setMotivo] = useState('');
  const [erros, setErros] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  /** Pedido em voo: o segundo clique não envia de novo. */
  const emVoo = useRef(false);

  useEffect(() => {
    if (!aberto) return;
    setCodigo('');
    setDescricao('');
    setMotivo('');
    setErros({});
    setErro(null);
  }, [aberto, tipo]);

  function limpar(chave: string) {
    setErros(({ [chave]: _removido, ...resto }) => resto);
  }

  async function confirmar() {
    if (emVoo.current) return;
    const locais: Record<string, string> = {};
    if (!codigo.trim()) locais.codigo = 'Informe o código.';
    if (!descricao.trim()) locais.descricao = 'Informe a descrição.';
    if (!justificativaValida(motivo)) locais.justificativa = 'Informe o motivo (3 a 500 caracteres).';
    setErros(locais);
    if (Object.keys(locais).length > 0) return;
    emVoo.current = true;
    setSalvando(true);
    setErro(null);
    try {
      await onConfirmar({ codigo: codigo.trim(), descricao: descricao.trim(), justificativa: textoUtil(motivo) });
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Falha na operação.');
      if (falha instanceof ErroRegra) setErros(errosPorCampo(falha.porCampo));
    } finally {
      emVoo.current = false;
      setSalvando(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(aberta) => { if (!aberta && !salvando) onFechar(); }}>
      <DialogContent onCloseAutoFocus={retornoFoco} aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{tipo === 'classificacao' ? 'Classificação IBS/CBS' : 'Benefício fiscal'}</DialogTitle>
        </DialogHeader>
        <form
          noValidate
          className="grid gap-3 px-4 pb-4"
          onSubmit={(evento) => {
            evento.preventDefault();
            void confirmar();
          }}
        >
          <p className="text-xs text-muted-foreground">{AVISO}</p>
          <CampoForm rotulo="Código" erro={erros.codigo}>
            <input aria-label="Código do cadastro manual" className="h-8 rounded-md border px-2" value={codigo} onChange={(e) => { setCodigo(e.target.value); limpar('codigo'); }} />
          </CampoForm>
          <CampoForm rotulo="Descrição" erro={erros.descricao}>
            <input aria-label="Descrição do cadastro manual" className="h-8 rounded-md border px-2" value={descricao} onChange={(e) => { setDescricao(e.target.value); limpar('descricao'); }} />
          </CampoForm>
          <CampoForm rotulo="Motivo" erro={erros.justificativa}>
            <textarea aria-label="Motivo do cadastro manual" maxLength={500} className="min-h-16 rounded-md border px-2" value={motivo} onChange={(e) => { setMotivo(e.target.value); limpar('justificativa'); }} />
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
