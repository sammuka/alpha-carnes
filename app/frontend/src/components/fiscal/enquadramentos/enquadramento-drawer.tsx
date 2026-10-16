'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { BadgeProvisorio } from '@/components/ui/badge-provisorio';
import { Button } from '@/components/ui/button';
import { DatePickerField } from '@/components/ui/date-picker-field';
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useRetornoFoco } from '../empresas/use-retorno-foco';
import { ComboboxBusca } from './combobox-busca';
import {
  ROTULOS_ABRANGENCIA,
  ROTULOS_FIN_NFE,
  ROTULOS_TIPO_PRODUTO,
  ROTULOS_TP_NF,
  mascararCest,
  mascararCfop,
  mascararNcm,
  limparJustificativa,
  normalizarCest,
  type CorpoEnquadramento,
  type DetalheEnquadramento,
  type OpcaoCombo,
} from '@/lib/fiscal-enquadramentos';
import { justificativaValida } from '@/lib/justificativa';

export interface SelecaoCodigo {
  tipo: 'cfops' | 'ncms';
  id: string;
  rotulo: string;
}

type ChaveBusca = 'estabelecimentoId' | 'operacaoId' | 'cfopId' | 'ncmId' | 'produtoId' | 'clienteId';
type Rotulos = Record<ChaveBusca, string>;
const ROTULOS_VAZIOS: Rotulos = { estabelecimentoId: '', operacaoId: '', cfopId: '', ncmId: '', produtoId: '', clienteId: '' };

function rotulosDe(detalhe: DetalheEnquadramento): Rotulos {
  return {
    estabelecimentoId: detalhe.estabelecimentoNome,
    operacaoId: detalhe.operacaoRotulo,
    cfopId: `${mascararCfop(detalhe.cfopCodigo)} ${detalhe.cfopDescricao}`.trim(),
    ncmId: `${mascararNcm(detalhe.ncmCodigo)} ${detalhe.ncmDescricao}`.trim(),
    produtoId: detalhe.produtoNome,
    clienteId: detalhe.clienteNome,
  };
}

interface Props {
  aberto: boolean;
  detalhe: DetalheEnquadramento | null;
  erro: string | null;
  selecaoCodigo?: SelecaoCodigo | null;
  /** Campo (id do elemento) que recebe o foco ao abrir um novo registro. */
  focoInicial?: string | null;
  /** A ficha em edição foi removida por outro usuário: edição bloqueada. */
  removido?: boolean;
  /** O servidor recusou o envio por versão desatualizada: oferece Recarregar dados. */
  conflito?: boolean;
  /** Busca a ficha atual e atualiza a versão capturada; null quando não foi possível. */
  onRecarregar?: () => Promise<DetalheEnquadramento | null>;
  onFechar: () => void;
  onSalvar: (corpo: CorpoEnquadramento) => Promise<string | null>;
  onErro: (mensagem: string | null) => void;
  onNovoCodigo: (tipo: 'cfops' | 'ncms') => void;
}

const CAMPOS_ROTULOS = {
  operacaoId: 'Operação',
  tpNf: 'Tipo da nota',
  finNfe: 'Finalidade',
  cfopId: 'Operação fiscal (CFOP)',
  abrangencia: 'Abrangência da operação',
  tipoProduto: 'Origem do produto',
  produtoId: 'Produto',
  ncmId: 'Classificação fiscal (NCM)',
  cest: 'Substituição tributária (CEST)',
  clienteId: 'Cliente',
  vigenciaInicio: 'Início de vigência',
  vigenciaFim: 'Fim de vigência',
  prioridade: 'Prioridade',
} as const;

const PRIORIDADE_MAXIMA = 2147483647;

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

export function EnquadramentoDrawer({
  aberto, detalhe, erro, selecaoCodigo, focoInicial = null, removido = false, conflito = false, onRecarregar, onFechar, onSalvar, onErro, onNovoCodigo,
}: Props) {
  const retornoFoco = useRetornoFoco(aberto);
  const manterDialogoAninhado = (event: { target: EventTarget | null; preventDefault: () => void }) => {
    const alvo = event.target;
    if (!(alvo instanceof Element)) return;
    if (alvo.closest('[data-slot="dialog-content"], [data-slot="dialog-overlay"]')) event.preventDefault();
  };
  const [form, setForm] = useState<CorpoEnquadramento>(VAZIO);
  const [avisos, setAvisos] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [rotulos, setRotulos] = useState<Rotulos>(ROTULOS_VAZIOS);
  // Ficha como estava na última leitura, para apontar o que outro usuário mudou depois.
  const [base, setBase] = useState<CorpoEnquadramento | null>(null);

  useEffect(() => {
    if (!aberto) return;
    setForm(detalhe ? deDetalhe(detalhe) : VAZIO);
    setRotulos(detalhe ? rotulosDe(detalhe) : ROTULOS_VAZIOS);
    setBase(detalhe ? deDetalhe(detalhe) : null);
    setAvisos(null);
    // Recarga da ficha com o drawer aberto (evento em tempo real) não pode apagar o que o usuário digitou.
  }, [aberto, detalhe?.id]);

  useEffect(() => {
    if (!aberto || !selecaoCodigo) return;
    const chave: ChaveBusca = selecaoCodigo.tipo === 'cfops' ? 'cfopId' : 'ncmId';
    setForm((atual) => ({ ...atual, [chave]: selecaoCodigo.id }));
    setRotulos((atual) => ({ ...atual, [chave]: selecaoCodigo.rotulo }));
  }, [aberto, selecaoCodigo]);

  function set<K extends keyof CorpoEnquadramento>(chave: K, valor: CorpoEnquadramento[K]) {
    setForm((atual) => ({ ...atual, [chave]: valor }));
  }

  function escolher(chave: ChaveBusca, opcao: OpcaoCombo | null) {
    set(chave, opcao?.id ?? '');
    setRotulos((atual) => ({ ...atual, [chave]: opcao?.rotulo ?? '' }));
  }

  async function recarregar() {
    const fresca = await onRecarregar?.();
    if (!fresca) return;
    const nova = deDetalhe(fresca);
    const mudou = base
      ? (Object.keys(CAMPOS_ROTULOS) as Array<keyof typeof CAMPOS_ROTULOS>)
          .filter((chave) => (base[chave] ?? '') !== (nova[chave] ?? ''))
          .map((chave) => CAMPOS_ROTULOS[chave])
      : [];
    setBase(nova);
    setAvisos(
      (mudou.length > 0 ? `Alterado por outro usuário: ${mudou.join(', ')}. ` : 'Nenhum campo foi alterado por outro usuário. ')
      + 'Seus campos digitados foram mantidos; revise e salve novamente.',
    );
  }

  function verificar(): string | null {
    const faltando: string[] = [];
    if (!detalhe && !form.estabelecimentoId) faltando.push('Estabelecimento');
    if (!form.operacaoId) faltando.push('Operação');
    if (!form.cfopId) faltando.push('Operação fiscal (CFOP)');
    if (!form.produtoId) faltando.push('Produto');
    if (!form.ncmId) faltando.push('Classificação fiscal (NCM)');
    if (!form.cest) faltando.push('Substituição tributária (CEST)');
    if (!form.clienteId) faltando.push('Cliente');
    if (!form.vigenciaInicio) faltando.push('Início de vigência');
    if (!justificativaValida(form.justificativa)) faltando.push('Motivo da alteração (3 a 500 caracteres)');
    const problemas: string[] = [];
    if (faltando.length > 0) problemas.push('Preencha os campos obrigatórios: ' + faltando.join(', ') + '.');
    if (form.cest && form.cest.length !== 7) problemas.push('Substituição tributária (CEST) deve ter 7 dígitos.');
    if (form.vigenciaFim && form.vigenciaFim < form.vigenciaInicio) problemas.push('Fim de vigência deve ser igual ou posterior ao início.');
    if (!Number.isInteger(form.prioridade) || form.prioridade < 1 || form.prioridade > PRIORIDADE_MAXIMA) {
      problemas.push('Prioridade deve ser um inteiro entre 1 e ' + PRIORIDADE_MAXIMA + '.');
    }
    return problemas.length > 0 ? problemas.join(' ') : null;
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
      justificativa: limparJustificativa(form.justificativa),
      vigenciaFim: form.vigenciaFim || undefined,
    };
    setEnviando(true);
    try {
      const mensagem = await onSalvar(corpo);
      if (mensagem) onErro(mensagem);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Sheet open={aberto} onOpenChange={(open) => { if (!open) onFechar(); }}>
      <SheetContent
        onCloseAutoFocus={retornoFoco}
        onOpenAutoFocus={(event) => {
          const alvo = focoInicial ? document.getElementById(focoInicial) : null;
          if (alvo) {
            event.preventDefault();
            alvo.focus();
          }
        }}
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
            <ComboboxBusca id="enq-estab" tipo="estabelecimentos" value={form.estabelecimentoId} rotulo={rotulos.estabelecimentoId} onChange={(o) => escolher('estabelecimentoId', o)} placeholder="Estabelecimento" searchPlaceholder="Buscar estabelecimento" disabled={detalhe !== null} />
          </Campo>
          <Campo rotulo="Operação">
            <ComboboxBusca id="enq-op" tipo="operacoes" value={form.operacaoId} rotulo={rotulos.operacaoId} onChange={(o) => escolher('operacaoId', o)} placeholder="Operação" searchPlaceholder="Buscar operação" />
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
            <ComboboxBusca id="enq-cfop" tipo="cfops" value={form.cfopId} rotulo={rotulos.cfopId} onChange={(o) => escolher('cfopId', o)} placeholder="Operação fiscal (CFOP)" searchPlaceholder="Buscar CFOP" />
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
            <ComboboxBusca id="enq-prod" tipo="produtos" value={form.produtoId} rotulo={rotulos.produtoId} onChange={(o) => escolher('produtoId', o)} placeholder="Produto" searchPlaceholder="Buscar produto" />
          </Campo>
          <Campo rotulo="Classificação fiscal (NCM)" selo="H-E01-08">
            <ComboboxBusca id="enq-ncm" tipo="ncms" value={form.ncmId} rotulo={rotulos.ncmId} onChange={(o) => escolher('ncmId', o)} placeholder="Classificação fiscal (NCM)" searchPlaceholder="Buscar NCM" />
            <Button type="button" variant="secondary" onClick={() => onNovoCodigo('ncms')}>Novo código</Button>
          </Campo>
          <Campo rotulo="Substituição tributária (CEST)" selo="H-E01-09">
            <input aria-label="Substituição tributária (CEST)" className="h-8 w-full rounded-md border px-2 text-[13px] font-data" inputMode="numeric" value={mascararCest(form.cest)} onChange={(e) => set('cest', normalizarCest(e.target.value))} />
          </Campo>
          <Campo rotulo="Cliente">
            <ComboboxBusca id="enq-cli" tipo="clientes" value={form.clienteId} rotulo={rotulos.clienteId} onChange={(o) => escolher('clienteId', o)} placeholder="Cliente" searchPlaceholder="Buscar cliente" />
          </Campo>
          <Campo rotulo="Início de vigência" selo="H-E01-10">
            <DatePickerField aria-label="Início de vigência" value={form.vigenciaInicio} onChange={(iso) => set('vigenciaInicio', iso)} />
          </Campo>
          <Campo rotulo="Fim de vigência" selo="H-E01-10">
            <DatePickerField aria-label="Fim de vigência" value={form.vigenciaFim ?? ''} onChange={(iso) => set('vigenciaFim', iso)} />
          </Campo>
          <Campo rotulo="Prioridade" selo="H-E01-06">
            <input id="enq-prioridade" aria-label="Prioridade" type="number" min={1} className="h-8 w-full rounded-md border px-2 text-[13px]" value={form.prioridade} onChange={(e) => set('prioridade', Number(e.target.value))} />
          </Campo>
          <label className="grid gap-1 text-xs" htmlFor="enq-motivo">
            Motivo da alteração *
            <textarea id="enq-motivo" className="min-h-16 rounded-md border px-2 py-1 text-[13px]" value={form.justificativa} onChange={(e) => set('justificativa', e.target.value)} />
          </label>
          {avisos && <p role="alert" className="text-sm text-destructive">{avisos}</p>}
          {removido && <p role="alert" className="text-sm text-destructive">Este registro foi removido por outro usuário.</p>}
          {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
          {conflito && onRecarregar && (
            <div>
              <Button type="button" variant="secondary" onClick={() => void recarregar()}>Recarregar dados</Button>
            </div>
          )}
        </div>
        <SheetFooter>
          <Button type="button" variant="secondary" onClick={onFechar}>Cancelar</Button>
          <Button type="button" variant="secondary" onClick={() => setAvisos(verificar())}>Verificar dados</Button>
          <Button type="button" disabled={removido || enviando} onClick={() => void salvar()}>Salvar rascunho</Button>
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
