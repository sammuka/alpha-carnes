'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { BadgeProvisorio } from '@/components/ui/badge-provisorio';
import { Button } from '@/components/ui/button';
import { ComboboxField } from '@/components/ui/combobox-field';
import { DatePickerField } from '@/components/ui/date-picker-field';
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useRetornoFoco } from '../empresas/use-retorno-foco';
import {
  ROTULOS_ABRANGENCIA,
  ROTULOS_FIN_NFE,
  ROTULOS_TIPO_PRODUTO,
  ROTULOS_TP_NF,
  TEXTO_VAZIO_COMBO,
  normalizarCest,
  type CorpoEnquadramento,
  type DetalheEnquadramento,
  type OpcaoCombo,
} from '@/lib/fiscal-enquadramentos';

export interface SelecaoCodigo {
  tipo: 'cfops' | 'ncms';
  id: string;
}

export interface Catalogos {
  estabelecimentos: OpcaoCombo[];
  operacoes: OpcaoCombo[];
  produtos: OpcaoCombo[];
  clientes: OpcaoCombo[];
  cfops: OpcaoCombo[];
  ncms: OpcaoCombo[];
}

interface Props {
  aberto: boolean;
  detalhe: DetalheEnquadramento | null;
  catalogos: Catalogos;
  erro: string | null;
  selecaoCodigo?: SelecaoCodigo | null;
  onFechar: () => void;
  onSalvar: (corpo: CorpoEnquadramento) => Promise<string | null>;
  onErro: (mensagem: string | null) => void;
  onNovoCodigo: (tipo: 'cfops' | 'ncms') => void;
}

const VAZIO: CorpoEnquadramento = {
  estabelecimentoId: '',
  operacaoId: '',
  tpNf: '1',
  finNfe: '1',
  cfopId: '',
  abrangencia: 'INTERNA',
  tipoProduto: 'REVENDA',
  produtoId: '',
  ncmId: '',
  cest: '',
  clienteId: '',
  vigenciaInicio: '',
  vigenciaFim: '',
  prioridade: 1,
  justificativa: '',
};

function deDetalhe(detalhe: DetalheEnquadramento): CorpoEnquadramento {
  return {
    estabelecimentoId: detalhe.estabelecimentoId,
    operacaoId: detalhe.operacaoId,
    tpNf: detalhe.tpNf,
    finNfe: detalhe.finNfe,
    cfopId: detalhe.cfopId,
    abrangencia: detalhe.abrangencia,
    tipoProduto: detalhe.tipoProduto,
    produtoId: detalhe.produtoId,
    ncmId: detalhe.ncmId,
    cest: detalhe.cest,
    clienteId: detalhe.clienteId,
    vigenciaInicio: detalhe.vigenciaInicio,
    vigenciaFim: detalhe.vigenciaFim ?? '',
    prioridade: detalhe.prioridade,
    justificativa: '',
  };
}

function itens(opcoes: OpcaoCombo[]) {
  return opcoes.map((opcao) => ({ id: opcao.id, label: opcao.rotulo }));
}

export function EnquadramentoDrawer({
  aberto, detalhe, catalogos, erro, selecaoCodigo, onFechar, onSalvar, onErro, onNovoCodigo,
}: Props) {
  const retornoFoco = useRetornoFoco(aberto);
  const manterDialogoAninhado = (event: { target: EventTarget | null; preventDefault: () => void }) => {
    const alvo = event.target;
    if (!(alvo instanceof Element)) return;
    if (alvo.closest('[data-slot="dialog-content"], [data-slot="dialog-overlay"]')) event.preventDefault();
  };
  const [form, setForm] = useState<CorpoEnquadramento>(VAZIO);
  const [avisos, setAvisos] = useState<string | null>(null);

  useEffect(() => {
    if (!aberto) return;
    setForm(detalhe ? deDetalhe(detalhe) : VAZIO);
    setAvisos(null);
  }, [aberto, detalhe]);

  useEffect(() => {
    if (!aberto || !selecaoCodigo) return;
    setForm((atual) => ({
      ...atual,
      ...(selecaoCodigo.tipo === 'cfops' ? { cfopId: selecaoCodigo.id } : { ncmId: selecaoCodigo.id }),
    }));
  }, [aberto, selecaoCodigo]);

  function set<K extends keyof CorpoEnquadramento>(chave: K, valor: CorpoEnquadramento[K]) {
    setForm((atual) => ({ ...atual, [chave]: valor }));
  }

  function verificar(): string | null {
    if (form.justificativa.trim().length < 3) return 'Informe o motivo da alteração (3 a 500 caracteres).';
    if (!form.vigenciaInicio) return 'Informe o início de vigência.';
    if (form.vigenciaFim && form.vigenciaFim < form.vigenciaInicio) return 'Fim de vigência deve ser igual ou posterior ao início.';
    if (form.prioridade < 1) return 'Prioridade deve ser um inteiro maior ou igual a 1.';
    return null;
  }

  async function salvar() {
    const local = verificar();
    if (local) {
      setAvisos(local);
      return;
    }
    const corpo = {
      ...form,
      cest: normalizarCest(form.cest),
      justificativa: form.justificativa.trim(),
      vigenciaFim: form.vigenciaFim || undefined,
    };
    const mensagem = await onSalvar(corpo);
    if (mensagem) onErro(mensagem);
  }

  return (
    <Sheet open={aberto} onOpenChange={(open) => { if (!open) onFechar(); }}>
      <SheetContent
        onCloseAutoFocus={retornoFoco}
        onPointerDownOutside={manterDialogoAninhado}
        onFocusOutside={manterDialogoAninhado}
        onInteractOutside={manterDialogoAninhado}
        className="w-full overflow-y-auto sm:max-w-xl"
      >
        <SheetHeader>
          <SheetTitle>{detalhe ? 'Editar versão' : 'Novo registro'}</SheetTitle>
        </SheetHeader>
        <div className="grid gap-3 px-4">
          <Campo rotulo="Estabelecimento">
            <ComboboxField id="enq-estab" items={itens(catalogos.estabelecimentos)} value={form.estabelecimentoId} onChange={(id) => set('estabelecimentoId', id)} placeholder="Estabelecimento" searchPlaceholder="Buscar estabelecimento" emptyText={TEXTO_VAZIO_COMBO} />
          </Campo>
          <Campo rotulo="Operação">
            <ComboboxField id="enq-op" items={itens(catalogos.operacoes)} value={form.operacaoId} onChange={(id) => set('operacaoId', id)} placeholder="Operação" searchPlaceholder="Buscar operação" emptyText={TEXTO_VAZIO_COMBO} />
          </Campo>
          <Campo rotulo="Tipo da nota">
            <select aria-label="Tipo da nota" className="h-8 w-full rounded-md border px-2 text-[13px]" value={form.tpNf} onChange={(e) => set('tpNf', e.target.value)}>
              {Object.entries(ROTULOS_TP_NF).map(([valor, rotulo]) => <option key={valor} value={valor}>{rotulo}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Finalidade">
            <select aria-label="Finalidade" className="h-8 w-full rounded-md border px-2 text-[13px]" value={form.finNfe} onChange={(e) => set('finNfe', e.target.value)}>
              {Object.entries(ROTULOS_FIN_NFE).map(([valor, rotulo]) => <option key={valor} value={valor}>{rotulo}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Operação fiscal (CFOP)" selo="H-E01-08">
            <ComboboxField id="enq-cfop" items={itens(catalogos.cfops)} value={form.cfopId} onChange={(id) => set('cfopId', id)} placeholder="Operação fiscal (CFOP)" searchPlaceholder="Buscar CFOP" emptyText={TEXTO_VAZIO_COMBO} />
            <Button type="button" variant="secondary" onClick={() => onNovoCodigo('cfops')}>Novo código</Button>
          </Campo>
          <Campo rotulo="Abrangência da operação">
            <select aria-label="Abrangência da operação" className="h-8 w-full rounded-md border px-2 text-[13px]" value={form.abrangencia} onChange={(e) => set('abrangencia', e.target.value)}>
              {Object.entries(ROTULOS_ABRANGENCIA).map(([valor, rotulo]) => <option key={valor} value={valor}>{rotulo}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Origem do produto">
            <select aria-label="Origem do produto" className="h-8 w-full rounded-md border px-2 text-[13px]" value={form.tipoProduto} onChange={(e) => set('tipoProduto', e.target.value)}>
              {Object.entries(ROTULOS_TIPO_PRODUTO).map(([valor, rotulo]) => <option key={valor} value={valor}>{rotulo}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Produto">
            <ComboboxField id="enq-prod" items={itens(catalogos.produtos)} value={form.produtoId} onChange={(id) => set('produtoId', id)} placeholder="Produto" searchPlaceholder="Buscar produto" emptyText={TEXTO_VAZIO_COMBO} />
          </Campo>
          <Campo rotulo="Classificação fiscal (NCM)" selo="H-E01-08">
            <ComboboxField id="enq-ncm" items={itens(catalogos.ncms)} value={form.ncmId} onChange={(id) => set('ncmId', id)} placeholder="Classificação fiscal (NCM)" searchPlaceholder="Buscar NCM" emptyText={TEXTO_VAZIO_COMBO} />
            <Button type="button" variant="secondary" onClick={() => onNovoCodigo('ncms')}>Novo código</Button>
          </Campo>
          <Campo rotulo="Substituição tributária (CEST)" selo="H-E01-09">
            <input aria-label="Substituição tributária (CEST)" className="h-8 w-full rounded-md border px-2 text-[13px]" inputMode="numeric" value={form.cest} onChange={(e) => set('cest', normalizarCest(e.target.value))} />
          </Campo>
          <Campo rotulo="Cliente">
            <ComboboxField id="enq-cli" items={itens(catalogos.clientes)} value={form.clienteId} onChange={(id) => set('clienteId', id)} placeholder="Cliente" searchPlaceholder="Buscar cliente" emptyText={TEXTO_VAZIO_COMBO} />
          </Campo>
          <Campo rotulo="Início de vigência" selo="H-E01-10">
            <DatePickerField aria-label="Início de vigência" value={form.vigenciaInicio} onChange={(iso) => set('vigenciaInicio', iso)} />
          </Campo>
          <Campo rotulo="Fim de vigência" selo="H-E01-10">
            <DatePickerField aria-label="Fim de vigência" value={form.vigenciaFim ?? ''} onChange={(iso) => set('vigenciaFim', iso)} />
          </Campo>
          <Campo rotulo="Prioridade" selo="H-E01-06">
            <input aria-label="Prioridade" type="number" min={1} className="h-8 w-full rounded-md border px-2 text-[13px]" value={form.prioridade} onChange={(e) => set('prioridade', Number(e.target.value))} />
          </Campo>
          <label className="grid gap-1 text-xs" htmlFor="enq-motivo">
            Motivo da alteração *
            <textarea id="enq-motivo" className="min-h-16 rounded-md border px-2 py-1 text-[13px]" value={form.justificativa} onChange={(e) => set('justificativa', e.target.value)} />
          </label>
          {avisos && <p role="alert" className="text-sm text-destructive">{avisos}</p>}
          {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
        </div>
        <SheetFooter>
          <Button type="button" variant="secondary" onClick={onFechar}>Cancelar</Button>
          <Button type="button" variant="secondary" onClick={() => setAvisos(verificar())}>Verificar dados</Button>
          <Button type="button" onClick={() => void salvar()}>Salvar rascunho</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function Campo({ rotulo, selo, children }: { rotulo: string; selo?: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 text-xs">
      <span className="inline-flex items-center gap-2">{rotulo}{selo && <BadgeProvisorio codigo={selo} />}</span>
      {children}
    </div>
  );
}
