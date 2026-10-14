'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { DatePickerField } from '@/components/ui/date-picker-field';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { SelectNative } from '@/components/ui/select-native';
import { Textarea } from '@/components/ui/textarea';
import {
  ehConflitoConcorrente,
  ErroFiscal,
  fiscalApi,
  mensagemDoErroFiscal,
  ROTULOS_CRT,
  type CodigoCrt,
  type RegimeVersao,
} from '@/lib/fiscal-empresas';
import { useRetornoFoco } from './use-retorno-foco';

interface RegimeDialogProps {
  aberto: boolean;
  onFechar: () => void;
  estabelecimentoId: string;
  nomeEstabelecimento: string;
  /** Rascunho ou rejeitado em edição; ausente = nova versão de regime. */
  regime?: RegimeVersao | null;
  onSalvo: () => void;
  onConflito: () => void;
}

/** Nova versão (ou edição de rascunho) de regime tributário por vigência. */
export function RegimeDialog({
  aberto,
  onFechar,
  estabelecimentoId,
  nomeEstabelecimento,
  regime,
  onSalvo,
  onConflito,
}: RegimeDialogProps) {
  const retornoFoco = useRetornoFoco(aberto);
  const [crt, setCrt] = useState<CodigoCrt | ''>('');
  const [inicio, setInicio] = useState('');
  const [fim, setFim] = useState('');
  const [justificativa, setJustificativa] = useState('');
  const [erros, setErros] = useState<Record<string, string>>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setCrt(regime?.crt ?? '');
    setInicio(regime?.vigenciaInicio ?? '');
    setFim(regime?.vigenciaFim ?? '');
    setJustificativa('');
    setErros({});
    setErroGeral(null);
  }, [aberto, regime]);

  const salvar = async (evento: React.FormEvent) => {
    evento.preventDefault();
    const locais: Record<string, string> = {};
    if (!crt) locais.crt = 'Selecione o regime tributário.';
    if (!inicio) locais.vigenciaInicio = 'Informe o início da vigência.';
    if (inicio && fim && fim < inicio) locais.vigenciaFim = 'Fim de vigência deve ser igual ou posterior ao início.';
    if (justificativa.trim().length < 3) locais.justificativa = 'Informe o motivo (mínimo de 3 caracteres).';
    setErros(locais);
    setErroGeral(null);
    if (Object.keys(locais).length > 0 || !crt) return;

    setSalvando(true);
    try {
      if (regime) {
        await fiscalApi.atualizarRegime(estabelecimentoId, regime.id, {
          crt,
          vigenciaInicio: inicio,
          ...(fim ? { vigenciaFim: fim } : {}),
          versao: regime.versao,
          justificativa: justificativa.trim(),
        });
      } else {
        await fiscalApi.criarRegime(estabelecimentoId, {
          crt,
          vigenciaInicio: inicio,
          ...(fim ? { vigenciaFim: fim } : {}),
          justificativa: justificativa.trim(),
        });
      }
      toast.success('Versão de regime salva como rascunho.');
      onSalvo();
      onFechar();
    } catch (falha) {
      if (falha instanceof ErroFiscal) setErros(falha.porCampo);
      if (ehConflitoConcorrente(falha)) onConflito();
      setErroGeral(mensagemDoErroFiscal(falha));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={(aberta) => { if (!aberta) onFechar(); }}>
      <DialogContent onCloseAutoFocus={retornoFoco}>
        <DialogHeader>
          <DialogTitle>{regime ? 'Editar versão de regime' : 'Nova versão de regime'}</DialogTitle>
          <DialogDescription>{nomeEstabelecimento}</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => void salvar(e)} className="flex flex-col gap-3 px-4" noValidate>
          <FormField label="Regime tributário" required htmlFor="regime-crt" error={erros.crt}>
            <SelectNative
              id="regime-crt"
              value={crt}
              aria-invalid={'crt' in erros || undefined}
              onChange={(e) => setCrt(e.target.value as CodigoCrt | '')}
            >
              <option value="">Selecione o regime tributário</option>
              {(Object.keys(ROTULOS_CRT) as CodigoCrt[]).map((codigo) => (
                <option key={codigo} value={codigo}>
                  {ROTULOS_CRT[codigo]}
                </option>
              ))}
            </SelectNative>
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Início de vigência" required htmlFor="regime-inicio" error={erros.vigenciaInicio}>
              <DatePickerField id="regime-inicio" value={inicio} onChange={setInicio} className="w-full" />
            </FormField>
            <FormField label="Fim de vigência" htmlFor="regime-fim" error={erros.vigenciaFim}>
              <DatePickerField id="regime-fim" value={fim} onChange={setFim} className="w-full" />
            </FormField>
          </div>
          <FormField label="Motivo da alteração" required htmlFor="regime-motivo" error={erros.justificativa}>
            <Textarea
              id="regime-motivo"
              rows={3}
              maxLength={500}
              placeholder="Por que este regime precisa ser registrado/alterado?"
              value={justificativa}
              aria-invalid={'justificativa' in erros || undefined}
              onChange={(e) => setJustificativa(e.target.value)}
            />
          </FormField>
          {erroGeral && (
            <p role="alert" className="text-xs text-destructive">
              {erroGeral}
            </p>
          )}
          <DialogFooter className="px-0">
            <Button type="button" variant="ghost" onClick={onFechar}>
              Cancelar
            </Button>
            <Button type="submit" loading={salvando}>
              Salvar rascunho
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
