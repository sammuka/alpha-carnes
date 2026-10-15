'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import type { CorpoSimulacao, OpcaoCombo } from '@/lib/fiscal-simulacoes';
import { useRetornoFoco } from '../empresas/use-retorno-foco';

interface Props {
  aberto: boolean;
  estabelecimentos: OpcaoCombo[];
  operacoes: OpcaoCombo[];
  clientes: OpcaoCombo[];
  produtos: OpcaoCombo[];
  ncms: OpcaoCombo[];
  enquadramentos: OpcaoCombo[];
  erro?: string | null;
  onFechar?: () => void;
  onSalvar?: (corpo: CorpoSimulacao) => Promise<string | null>;
}

const VAZIO: CorpoSimulacao = {
  estabelecimentoId: '',
  operacaoId: '',
  clienteId: '',
  produtoId: '',
  ncmId: '',
  quantidade: '',
  pesoNf: '',
  valor: '',
  desconto: '',
  competencia: '',
  enquadramentoId: '',
  justificativa: '',
};

export function SimulacaoDrawer({
  aberto, estabelecimentos, operacoes, clientes, produtos, ncms, enquadramentos,
  erro, onFechar = () => undefined, onSalvar,
}: Props) {
  const retornoFoco = useRetornoFoco(aberto);
  const [form, setForm] = useState<CorpoSimulacao>(VAZIO);
  const [avisos, setAvisos] = useState<string | null>(null);
  const [sujo, setSujo] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setForm(VAZIO);
    setAvisos(null);
    setSujo(false);
  }, [aberto]);

  function set<K extends keyof CorpoSimulacao>(chave: K, valor: CorpoSimulacao[K]) {
    setSujo(true);
    setForm((atual) => ({ ...atual, [chave]: valor }));
  }

  async function escolherEnquadramento(id: string) {
    set('enquadramentoId', id);
    if (!id) return;
    try {
      const res = await fetch(`/api/erp/fiscal/enquadramentos/${id}`);
      if (!res.ok) return;
      const detalhe = await res.json() as Partial<CorpoSimulacao>;
      setForm((atual) => atual.enquadramentoId === id ? {
        ...atual,
        estabelecimentoId: detalhe.estabelecimentoId ?? atual.estabelecimentoId,
        operacaoId: detalhe.operacaoId ?? atual.operacaoId,
        clienteId: detalhe.clienteId ?? atual.clienteId,
        produtoId: detalhe.produtoId ?? atual.produtoId,
        ncmId: detalhe.ncmId ?? atual.ncmId,
      } : atual);
    } catch {
      // o servidor recusa a divergência no POST
    }
  }

  async function salvar() {
    if (form.justificativa.trim().length < 3) {
      setAvisos('Informe o motivo da alteração (3 a 500 caracteres).');
      return;
    }
    const mensagem = await onSalvar?.({ ...form, justificativa: form.justificativa.trim() });
    if (mensagem) setAvisos(mensagem);
  }

  function fechar() {
    if (sujo && !window.confirm('Há alterações não salvas. Deseja sair?')) return;
    onFechar();
  }

  return (
    <Sheet open={aberto} onOpenChange={(open) => { if (!open) fechar(); }}>
      <SheetContent aria-describedby={undefined} onCloseAutoFocus={retornoFoco} className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Novo registro</SheetTitle>
        </SheetHeader>
        <div className="grid gap-3 px-4">
          <Combo rotulo="Estabelecimento" valor={form.estabelecimentoId} opcoes={estabelecimentos} onChange={(valor) => set('estabelecimentoId', valor)} />
          <Combo rotulo="Operação" valor={form.operacaoId} opcoes={operacoes} onChange={(valor) => set('operacaoId', valor)} />
          <Combo rotulo="Cliente" valor={form.clienteId} opcoes={clientes} onChange={(valor) => set('clienteId', valor)} />
          <Combo rotulo="Produto" valor={form.produtoId} opcoes={produtos} onChange={(valor) => set('produtoId', valor)} />
          <Combo rotulo="Classificação fiscal (NCM)" valor={form.ncmId} opcoes={ncms} onChange={(valor) => set('ncmId', valor)} />
          <Campo rotulo="Quantidade">
            <input aria-label="Quantidade" inputMode="decimal" className="h-8 w-full rounded-md border px-2" value={form.quantidade} onChange={(e) => set('quantidade', e.target.value)} />
          </Campo>
          <Campo rotulo="Peso informado na nota (kg)">
            <input aria-label="Peso informado na nota (kg)" inputMode="decimal" className="h-8 w-full rounded-md border px-2" value={form.pesoNf} onChange={(e) => set('pesoNf', e.target.value)} />
          </Campo>
          <Campo rotulo="Valor">
            <span className="inline-flex items-center gap-1">
              <span aria-hidden="true">R$</span>
              <input aria-label="Valor" inputMode="decimal" className="h-8 w-full rounded-md border px-2" value={form.valor} onChange={(e) => set('valor', e.target.value)} />
            </span>
          </Campo>
          <Campo rotulo="Desconto">
            <span className="inline-flex items-center gap-1">
              <span aria-hidden="true">R$</span>
              <input aria-label="Desconto" inputMode="decimal" className="h-8 w-full rounded-md border px-2" value={form.desconto} onChange={(e) => set('desconto', e.target.value)} />
            </span>
          </Campo>
          <Campo rotulo="Competência">
            <input aria-label="Competência" type="month" className="h-8 w-full rounded-md border px-2" value={form.competencia} onChange={(e) => set('competencia', e.target.value)} />
          </Campo>
          <Combo rotulo="Enquadramento fiscal" valor={form.enquadramentoId} opcoes={enquadramentos} onChange={(valor) => { void escolherEnquadramento(valor); }} />
          <Campo rotulo="Valor líquido (calculado)">
            <input aria-label="Valor líquido (calculado)" disabled className="h-8 w-full rounded-md border px-2" placeholder="Calculado ao simular" />
          </Campo>
          <Campo rotulo="Base tributável (calculada)">
            <input aria-label="Base tributável (calculada)" disabled className="h-8 w-full rounded-md border px-2" placeholder="Calculado ao simular" />
          </Campo>
          <label className="grid gap-1 text-xs" htmlFor="simulacao-motivo">
            Motivo da alteração
            <textarea id="simulacao-motivo" className="min-h-16 rounded-md border px-2 py-1" value={form.justificativa} onChange={(e) => set('justificativa', e.target.value)} />
          </label>
          {avisos && <p role="alert" className="text-sm text-destructive">{avisos}</p>}
          {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
        </div>
        <SheetFooter>
          <Button type="button" variant="secondary" onClick={fechar}>Cancelar</Button>
          <Button type="button" onClick={() => void salvar()}>Salvar rascunho</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function Combo({ rotulo, valor, opcoes, onChange }: { rotulo: string; valor: string; opcoes: OpcaoCombo[]; onChange: (valor: string) => void }) {
  return (
    <Campo rotulo={rotulo}>
      <select aria-label={rotulo} className="h-8 w-full rounded-md border px-2" value={valor} onChange={(e) => onChange(e.target.value)}>
        <option value="">{opcoes.length === 0 ? 'Nenhum registro para exibir.' : 'Selecione'}</option>
        {opcoes.map((opcao) => <option key={opcao.id} value={opcao.id}>{opcao.rotulo}</option>)}
      </select>
    </Campo>
  );
}

function Campo({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 text-xs">
      <span>{rotulo}</span>
      {children}
    </div>
  );
}
