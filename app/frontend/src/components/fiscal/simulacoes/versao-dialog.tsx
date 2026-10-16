'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { errosPorCampo, type FalhaSalvar } from '@/lib/fiscal-comum-ui';
import { descontoMaiorQueValor, formatarDinheiroPtBr, validarDinheiro, type CorpoSimulacao, type DetalheSimulacao } from '@/lib/fiscal-simulacoes';
import { CampoForm } from '../comum/campo-form';
import { useRetornoFoco } from '../empresas/use-retorno-foco';

interface Props {
  aberto: boolean;
  origem: DetalheSimulacao | null;
  onFechar: () => void;
  /** Devolve `null` quando gravou; senão a falha que o diálogo exibe. */
  onSalvar: (corpo: CorpoSimulacao & { versao: number }) => Promise<FalhaSalvar | null>;
}

export function VersaoDialog({ aberto, origem, onFechar, onSalvar }: Props) {
  const retornoFoco = useRetornoFoco(aberto);
  const [desconto, setDesconto] = useState('');
  const [competencia, setCompetencia] = useState('');
  const [motivo, setMotivo] = useState('');
  const [erros, setErros] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!aberto || !origem) return;
    setDesconto(formatarDinheiroPtBr(origem.desconto));
    setCompetencia(origem.competencia);
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
    const invalido = validarDinheiro(desconto, { exigirPositivo: false });
    if (invalido) locais.desconto = invalido;
    else if (descontoMaiorQueValor(desconto, origem.valor)) locais.desconto = 'O desconto não pode ser maior que o valor.';
    if (!competencia) locais.competencia = 'Informe a competência.';
    if (motivo.trim().length < 3) locais.justificativa = 'Informe o motivo da alteração (3 a 500 caracteres).';
    setErros(locais);
    setErro(null);
    if (Object.keys(locais).length > 0) return;
    setSalvando(true);
    try {
      const falha = await onSalvar({
        estabelecimentoId: origem.estabelecimentoId ?? '',
        operacaoId: origem.operacaoId ?? '',
        clienteId: origem.clienteId ?? '',
        produtoId: origem.produtoId ?? '',
        ncmId: origem.ncmId ?? '',
        quantidade: origem.quantidade,
        pesoNf: origem.pesoNf,
        valor: origem.valor,
        desconto,
        competencia,
        enquadramentoId: origem.enquadramentoId ?? '',
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
          <DialogTitle>Nova versão</DialogTitle>
        </DialogHeader>
        <form
          noValidate
          className="grid gap-3 px-4 pb-4 text-sm"
          onSubmit={(evento) => {
            evento.preventDefault();
            void enviar();
          }}
        >
          <p>Enquadramento fiscal {origem.enquadramento}</p>
          <CampoForm rotulo="Desconto" htmlFor="versao-desconto" erro={erros.desconto}>
            <input id="versao-desconto" aria-label="Desconto da versão" inputMode="decimal" className="h-8 rounded-md border px-2" value={desconto} onChange={(e) => { setDesconto(e.target.value); limpar('desconto'); }} />
          </CampoForm>
          <CampoForm rotulo="Competência" erro={erros.competencia}>
            <input aria-label="Competência da versão" type="month" className="h-8 rounded-md border px-2" value={competencia} onChange={(e) => { setCompetencia(e.target.value); limpar('competencia'); }} />
          </CampoForm>
          <CampoForm rotulo="Motivo da alteração" htmlFor="versao-motivo" erro={erros.justificativa}>
            <textarea id="versao-motivo" maxLength={500} className="min-h-16 rounded-md border px-2" value={motivo} onChange={(e) => { setMotivo(e.target.value); limpar('justificativa'); }} />
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
