'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ComboboxField } from '@/components/ui/combobox-field';
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { homologacoesApi, type CorpoAbertura, type OpcaoRegra } from '@/lib/fiscal-homologacoes';
import { useRetornoFoco } from '../empresas/use-retorno-foco';

interface Props {
  aberto: boolean;
  erro?: string | null;
  errosCampo?: Record<string, string>;
  onFechar: () => void;
  onSalvar: (corpo: CorpoAbertura) => void;
}

const VAZIO = { regraId: '', descricao: '', justificativa: '' };

export function HomologacaoDrawer({ aberto, erro, errosCampo = {}, onFechar, onSalvar }: Props) {
  const retorno = useRetornoFoco(aberto);
  const [regras, setRegras] = useState<OpcaoRegra[]>([]);
  const [form, setForm] = useState(VAZIO);
  const [aviso, setAviso] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setForm(VAZIO);
    setAviso(null);
    setConfirmar(false);
    void homologacoesApi.regras().then(setRegras).catch(() => setRegras([]));
  }, [aberto]);

  const pendente = form.descricao.trim() !== '' || form.justificativa.trim() !== '' || form.regraId !== '';

  function verificar() {
    const erros: string[] = [];
    if (form.descricao.trim().length < 3) erros.push('Descrição: informe ao menos 3 caracteres.');
    if (form.justificativa.trim().length < 3) erros.push('Justificativa auditável: informe ao menos 3 caracteres.');
    if (!form.regraId) erros.push('Enquadramento fiscal: selecione a versão aprovada.');
    setAviso(erros.length > 0 ? erros.join(' ') : 'Dados verificados.');
  }

  function pedirFechar() {
    if (pendente) setConfirmar(true);
    else onFechar();
  }

  return (
    <Sheet open={aberto} onOpenChange={(abertoAgora) => { if (!abertoAgora) pedirFechar(); }}>
      <SheetContent onCloseAutoFocus={retorno} className="overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Novo registro</SheetTitle>
        </SheetHeader>
        <div className="grid gap-3 px-4 text-sm">
          <label className="grid gap-1 text-xs" htmlFor="enquadramento-fiscal">Enquadramento fiscal
            <ComboboxField
              id="enquadramento-fiscal"
              items={regras.map((regra) => ({ id: regra.id, label: regra.rotulo }))}
              value={form.regraId}
              onChange={(regraId) => setForm((atual) => ({ ...atual, regraId }))}
              placeholder="Selecione"
              searchPlaceholder="Pesquisar enquadramento"
              emptyText="Nenhuma versão aprovada"
            />
          </label>
          {errosCampo.regraId && <span className="text-destructive">{errosCampo.regraId}</span>}
          <label className="grid gap-1 text-xs" htmlFor="descricao-homologacao">Descrição
            <input id="descricao-homologacao" className="h-8 rounded-md border px-2" value={form.descricao} onChange={(e) => setForm((atual) => ({ ...atual, descricao: e.target.value }))} />
          </label>
          {errosCampo.descricao && <span className="text-destructive">{errosCampo.descricao}</span>}
          <label className="grid gap-1 text-xs" htmlFor="justificativa-homologacao">Justificativa auditável
            <textarea id="justificativa-homologacao" className="min-h-20 rounded-md border px-2 py-1" value={form.justificativa} onChange={(e) => setForm((atual) => ({ ...atual, justificativa: e.target.value }))} />
          </label>
          {errosCampo.justificativa && <span className="text-destructive">{errosCampo.justificativa}</span>}
          <p>Usuário</p>
          <p>Início de vigência</p>
          <p>Fim de vigência</p>
          <p>Situação</p>
          <p>Responsável pela aprovação</p>
          {aviso && <p role="status">{aviso}</p>}
          {erro && <p role="alert" className="text-destructive">{erro}</p>}
          {confirmar && (
            <div role="alertdialog" aria-label="Descartar alterações pendentes">
              <p>Há dados pendentes. Descartar as alterações?</p>
              <Button type="button" variant="secondary" onClick={() => setConfirmar(false)}>Continuar editando</Button>
              <Button type="button" variant="secondary" onClick={onFechar}>Descartar</Button>
            </div>
          )}
        </div>
        <SheetFooter className="flex-row flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={pedirFechar}>Cancelar</Button>
          <Button type="button" variant="secondary" onClick={verificar}>Verificar dados</Button>
          <Button type="button" onClick={() => onSalvar(form)}>Salvar rascunho</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
