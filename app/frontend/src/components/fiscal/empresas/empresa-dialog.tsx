'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  ehConflitoConcorrente,
  ErroFiscal,
  fiscalApi,
  mensagemDoErroFiscal,
  normalizarCnpj,
  type Empresa,
} from '@/lib/fiscal-empresas';
import { useRetornoFoco } from './use-retorno-foco';
import { justificativaValida, normalizarJustificativa } from '@/lib/justificativa';

interface EmpresaDialogProps {
  aberto: boolean;
  onFechar: () => void;
  /** Quando informada, o diálogo edita a razão social; senão cadastra uma empresa nova. */
  empresa?: Empresa | null;
  onSalvo: (empresa: Empresa) => void;
  /** Chamado em 409 de concorrência para a tela recarregar os dados. */
  onConflito?: () => void;
}

/** Raiz do CNPJ (8 primeiras posições) com máscara `AA.AAA.AAA`. */
function mascararRaiz(valor: string): string {
  const base = normalizarCnpj(valor).slice(0, 8);
  let saida = base.slice(0, 2);
  if (base.length > 2) saida += `.${base.slice(2, 5)}`;
  if (base.length > 5) saida += `.${base.slice(5, 8)}`;
  return saida;
}

export function EmpresaDialog({ aberto, onFechar, empresa, onSalvo, onConflito }: EmpresaDialogProps) {
  const retornoFoco = useRetornoFoco(aberto);
  const [razaoSocial, setRazaoSocial] = useState('');
  const [cnpjRaiz, setCnpjRaiz] = useState('');
  const [justificativa, setJustificativa] = useState('');
  const [erros, setErros] = useState<Record<string, string>>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setRazaoSocial(empresa?.razaoSocial ?? '');
    setCnpjRaiz(empresa?.cnpjRaiz ?? '');
    setJustificativa('');
    setErros({});
    setErroGeral(null);
  }, [aberto, empresa]);

  const editando = Boolean(empresa);

  const salvar = async (evento: React.FormEvent) => {
    evento.preventDefault();
    const locais: Record<string, string> = {};
    if (!razaoSocial.trim()) locais.razaoSocial = 'Informe a razão social.';
    if (!editando && normalizarCnpj(cnpjRaiz).length !== 8) locais.cnpjRaiz = 'CNPJ raiz deve ter 8 letras ou dígitos.';
    if (!justificativaValida(justificativa)) locais.justificativa = 'Informe o motivo (mínimo de 3 caracteres).';
    setErros(locais);
    setErroGeral(null);
    if (Object.keys(locais).length > 0) return;

    setSalvando(true);
    try {
      const salva = empresa
        ? await fiscalApi.atualizarEmpresa(empresa.id, {
            razaoSocial: razaoSocial.trim(),
            versao: empresa.versao,
            justificativa: normalizarJustificativa(justificativa),
          })
        : await fiscalApi.criarEmpresa({
            razaoSocial: razaoSocial.trim(),
            cnpjRaiz: normalizarCnpj(cnpjRaiz),
            justificativa: normalizarJustificativa(justificativa),
          });
      toast.success(editando ? 'Empresa atualizada.' : 'Empresa cadastrada.');
      onSalvo(salva);
      onFechar();
    } catch (falha) {
      if (falha instanceof ErroFiscal) setErros(falha.porCampo);
      if (ehConflitoConcorrente(falha)) onConflito?.();
      setErroGeral(mensagemDoErroFiscal(falha));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={(aberta) => { if (!aberta) onFechar(); }}>
      <DialogContent onCloseAutoFocus={retornoFoco}>
        <DialogHeader>
          <DialogTitle>{editando ? 'Editar empresa' : 'Nova empresa'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => void salvar(e)} className="flex flex-col gap-3 px-4" noValidate>
          <FormField label="Razão social" required htmlFor="empresa-razao" error={erros.razaoSocial}>
            <Input
              id="empresa-razao"
              value={razaoSocial}
              maxLength={150}
              aria-invalid={'razaoSocial' in erros || undefined}
              onChange={(e) => setRazaoSocial(e.target.value)}
            />
          </FormField>
          <FormField
            label="CNPJ raiz"
            required
            htmlFor="empresa-raiz"
            error={erros.cnpjRaiz}
            help={editando ? 'A raiz do CNPJ não pode ser alterada.' : 'As 8 primeiras posições do CNPJ.'}
          >
            <Input
              id="empresa-raiz"
              value={mascararRaiz(cnpjRaiz)}
              maxLength={10}
              disabled={editando}
              aria-invalid={'cnpjRaiz' in erros || undefined}
              onChange={(e) => setCnpjRaiz(normalizarCnpj(e.target.value).slice(0, 8))}
            />
          </FormField>
          <FormField label="Motivo da alteração" required htmlFor="empresa-motivo" error={erros.justificativa}>
            <Textarea
              id="empresa-motivo"
              rows={3}
              maxLength={500}
              placeholder="Por que este cadastro precisa ser criado/alterado?"
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
              {editando ? 'Salvar empresa' : 'Cadastrar empresa'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
