'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { BadgeProvisorio } from '@/components/ui/badge-provisorio';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  ROTULOS_IBS,
  ROTULOS_ICMS,
  ROTULOS_IPI,
  ROTULOS_PIS,
  TEXTO_VAZIO_COMBO,
  formatarPercentualPtBr,
  type CorpoRegra,
  type DetalheRegra,
  type OpcaoCombo,
} from '@/lib/fiscal-regras';
import { useRetornoFoco } from '../empresas/use-retorno-foco';

interface Props {
  aberto: boolean;
  enquadramentos: OpcaoCombo[];
  beneficios: OpcaoCombo[];
  classificacoes: OpcaoCombo[];
  operacoes?: OpcaoCombo[];
  cfops?: OpcaoCombo[];
  detalhe?: DetalheRegra | null;
  erro?: string | null;
  errosCampo?: Record<string, string>;
  onFechar?: () => void;
  onSalvar?: (corpo: CorpoRegra) => Promise<string | null>;
  onNovoCodigo?: (tipo: 'beneficio' | 'classificacao') => void;
}

const VAZIO: CorpoRegra = {
  enquadramentoId: '',
  operacaoId: '',
  cfopId: '',
  icmsCst: '00',
  pRedBc: '',
  pIcms: '',
  beneficioFiscalId: '',
  ipiCst: '51',
  pisCst: '01',
  ibsCst: '000',
  classificacaoIbsCbsId: '',
  vigenciaInicio: '',
  vigenciaFim: '',
  justificativa: '',
};

function deDetalhe(detalhe: DetalheRegra): CorpoRegra {
  return {
    enquadramentoId: detalhe.enquadramentoId,
    operacaoId: detalhe.operacaoId,
    cfopId: detalhe.cfopId,
    icmsCst: detalhe.icmsCst,
    pRedBc: formatarPercentualPtBr(detalhe.pRedBc),
    pIcms: formatarPercentualPtBr(detalhe.pIcms),
    beneficioFiscalId: detalhe.beneficioFiscalId,
    ipiCst: detalhe.ipiCst,
    pisCst: detalhe.pisCst,
    ibsCst: detalhe.ibsCst,
    classificacaoIbsCbsId: detalhe.classificacaoIbsCbsId,
    vigenciaInicio: detalhe.vigenciaInicio,
    vigenciaFim: detalhe.vigenciaFim ?? '',
    justificativa: '',
    versao: detalhe.versao,
  };
}

export function RegraDrawer({
  aberto, enquadramentos, beneficios, classificacoes, operacoes = [], cfops = [],
  detalhe, erro, errosCampo = {}, onFechar = () => undefined, onSalvar, onNovoCodigo,
}: Props) {
  const retornoFoco = useRetornoFoco(aberto);
  const manterDialogoAninhado = (event: { target: EventTarget | null; preventDefault: () => void }) => {
    const alvo = event.target;
    if (!(alvo instanceof Element)) return;
    if (alvo.closest('[data-slot="dialog-content"], [data-slot="dialog-overlay"]')) event.preventDefault();
  };
  const [form, setForm] = useState<CorpoRegra>(VAZIO);
  const [avisos, setAvisos] = useState<string | null>(null);
  const [sujo, setSujo] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setForm(detalhe ? deDetalhe(detalhe) : VAZIO);
    setAvisos(null);
    setSujo(false);
  }, [aberto, detalhe]);

  function set<K extends keyof CorpoRegra>(chave: K, valor: CorpoRegra[K]) {
    setSujo(true);
    setForm((atual) => ({ ...atual, [chave]: valor }));
  }

  async function escolherEnquadramento(id: string) {
    setSujo(true);
    setForm((atual) => ({ ...atual, enquadramentoId: id }));
    if (!id) return;
    try {
      const res = await fetch(`/api/erp/fiscal/enquadramentos/${id}`);
      if (!res.ok) return;
      const detalheEnq = await res.json() as { operacaoId?: string; cfopId?: string };
      setForm((atual) => (
        atual.enquadramentoId === id
          ? { ...atual, operacaoId: detalheEnq.operacaoId ?? '', cfopId: detalheEnq.cfopId ?? '' }
          : atual
      ));
    } catch {
      // o servidor recusa a divergência no POST
    }
  }

  function verificar(): string | null {
    if (form.justificativa.trim().length < 3) return 'Informe a justificativa auditável (3 a 500 caracteres).';
    if (!form.vigenciaInicio) return 'Informe o início de vigência.';
    if (form.vigenciaFim && form.vigenciaFim < form.vigenciaInicio) return 'Fim de vigência deve ser igual ou posterior ao início.';
    return null;
  }

  async function salvar() {
    const local = verificar();
    if (local) {
      setAvisos(local);
      return;
    }
    const mensagem = await onSalvar?.({
      ...form,
      justificativa: form.justificativa.trim(),
      vigenciaFim: form.vigenciaFim || null,
      versao: detalhe?.versao,
    });
    if (mensagem) setAvisos(mensagem);
  }

  function fechar() {
    if (sujo && !window.confirm('Há alterações não salvas. Deseja sair?')) return;
    onFechar();
  }

  return (
    <Sheet open={aberto} onOpenChange={(open) => { if (!open) fechar(); }}>
      <SheetContent
        aria-describedby={undefined}
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
          <Campo rotulo="Enquadramento fiscal">
            <select aria-label="Enquadramento fiscal" className="h-8 w-full rounded-md border px-2" value={form.enquadramentoId} onChange={(e) => { void escolherEnquadramento(e.target.value); }}>
              <option value="">{enquadramentos.length === 0 ? TEXTO_VAZIO_COMBO : 'Selecione'}</option>
              {enquadramentos.map((opcao) => <option key={opcao.id} value={opcao.id}>{opcao.rotulo}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Operação">
            <select aria-label="Operação" className="h-8 w-full rounded-md border px-2" value={form.operacaoId} onChange={(e) => set('operacaoId', e.target.value)}>
              <option value="">{operacoes.length === 0 ? TEXTO_VAZIO_COMBO : 'Selecione'}</option>
              {operacoes.map((opcao) => <option key={opcao.id} value={opcao.id}>{opcao.rotulo}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Operação fiscal (CFOP)">
            <select aria-label="Operação fiscal (CFOP)" className="h-8 w-full rounded-md border px-2" value={form.cfopId} onChange={(e) => set('cfopId', e.target.value)}>
              <option value="">{cfops.length === 0 ? TEXTO_VAZIO_COMBO : 'Selecione'}</option>
              {cfops.map((opcao) => <option key={opcao.id} value={opcao.id}>{opcao.rotulo}</option>)}
            </select>
          </Campo>
          <CampoSelect rotulo="Tratamento ICMS" valor={form.icmsCst} opcoes={ROTULOS_ICMS} onChange={(valor) => set('icmsCst', valor)} />
          <Campo rotulo="Redução de base do ICMS (%)">
            <span className="inline-flex items-center gap-1">
              <span aria-hidden="true">%</span>
              <input aria-label="Redução de base do ICMS (%)" inputMode="decimal" className="h-8 w-full rounded-md border px-2" value={form.pRedBc} onChange={(e) => set('pRedBc', e.target.value)} />
            </span>
            {errosCampo.pRedBc && <span className="text-destructive">{errosCampo.pRedBc}</span>}
          </Campo>
          <Campo rotulo="Alíquota (%)">
            <span className="inline-flex items-center gap-1">
              <span aria-hidden="true">%</span>
              <input aria-label="Alíquota (%)" inputMode="decimal" className="h-8 w-full rounded-md border px-2" value={form.pIcms} onChange={(e) => set('pIcms', e.target.value)} />
            </span>
            {errosCampo.pIcms && <span className="text-destructive">{errosCampo.pIcms}</span>}
          </Campo>
          <Campo rotulo="Benefício fiscal">
            <select aria-label="Benefício fiscal" className="h-8 w-full rounded-md border px-2" value={form.beneficioFiscalId} onChange={(e) => set('beneficioFiscalId', e.target.value)}>
              <option value="">{beneficios.length === 0 ? TEXTO_VAZIO_COMBO : 'Selecione'}</option>
              {beneficios.map((opcao) => <option key={opcao.id} value={opcao.id}>{opcao.rotulo}</option>)}
            </select>
            <Button type="button" variant="secondary" onClick={() => onNovoCodigo?.('beneficio')}>Novo código</Button>
          </Campo>
          <CampoSelect rotulo="Tratamento IPI" valor={form.ipiCst} opcoes={ROTULOS_IPI} onChange={(valor) => set('ipiCst', valor)} />
          <CampoSelect rotulo="Tratamento PIS/COFINS" valor={form.pisCst} opcoes={ROTULOS_PIS} onChange={(valor) => set('pisCst', valor)} />
          <CampoSelect rotulo="Tratamento IBS/CBS" valor={form.ibsCst} opcoes={ROTULOS_IBS} onChange={(valor) => set('ibsCst', valor)} />
          <Campo rotulo="Classificação IBS/CBS">
            <select aria-label="Classificação IBS/CBS" className="h-8 w-full rounded-md border px-2" value={form.classificacaoIbsCbsId} onChange={(e) => set('classificacaoIbsCbsId', e.target.value)}>
              <option value="">{classificacoes.length === 0 ? TEXTO_VAZIO_COMBO : 'Selecione'}</option>
              {classificacoes.map((opcao) => <option key={opcao.id} value={opcao.id}>{opcao.rotulo}</option>)}
            </select>
            <Button type="button" variant="secondary" onClick={() => onNovoCodigo?.('classificacao')}>Novo código</Button>
          </Campo>
          <Campo rotulo="Início de vigência" selo="H-E01-10">
            <input aria-label="Início de vigência" type="date" className="h-8 w-full rounded-md border px-2" value={form.vigenciaInicio} onChange={(e) => set('vigenciaInicio', e.target.value)} />
          </Campo>
          <Campo rotulo="Fim de vigência" selo="H-E01-10">
            <input aria-label="Fim de vigência" type="date" className="h-8 w-full rounded-md border px-2" value={form.vigenciaFim ?? ''} onChange={(e) => set('vigenciaFim', e.target.value)} />
          </Campo>
          <label className="grid gap-1 text-xs" htmlFor="regra-justificativa">
            Justificativa auditável
            <textarea id="regra-justificativa" className="min-h-16 rounded-md border px-2 py-1" value={form.justificativa} onChange={(e) => set('justificativa', e.target.value)} />
          </label>
          {avisos && <p role="alert" className="text-sm text-destructive">{avisos}</p>}
          {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
        </div>
        <SheetFooter>
          <Button type="button" variant="secondary" onClick={fechar}>Cancelar</Button>
          <Button type="button" variant="secondary" onClick={() => setAvisos(verificar())}>Verificar dados</Button>
          <Button type="button" onClick={() => void salvar()}>Salvar rascunho</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function CampoSelect({ rotulo, valor, opcoes, onChange }: { rotulo: string; valor: string; opcoes: Record<string, string>; onChange: (valor: string) => void }) {
  return (
    <Campo rotulo={rotulo}>
      <select aria-label={rotulo} className="h-8 w-full rounded-md border px-2" value={valor} onChange={(e) => onChange(e.target.value)}>
        {Object.entries(opcoes).map(([codigo, nome]) => <option key={codigo} value={codigo}>{nome}</option>)}
      </select>
    </Campo>
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
