'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { buscarEnquadramentos, errosPorCampo, justificativaValida, textoUtil, type FalhaSalvar } from '@/lib/fiscal-comum-ui';
import { mascararCfop, type OpcaoCombo } from '@/lib/fiscal-enquadramentos';
import {
  ROTULOS_IBS,
  ROTULOS_ICMS,
  ROTULOS_IPI,
  ROTULOS_PIS,
  ErroRegra,
  buscarBeneficios,
  buscarClassificacoes,
  formatarPercentualPtBr,
  mensagemDeRegra,
  normalizarPercentual,
  regrasApi,
  type CorpoRegra,
  type DetalheRegra,
} from '@/lib/fiscal-regras';
import { ComboboxBusca } from '../enquadramentos/combobox-busca';
import { CampoForm } from '../comum/campo-form';
import { ConfirmarSaidaDialog } from '../empresas/confirmar-saida-dialog';
import { useRetornoFoco } from '../empresas/use-retorno-foco';

export interface SelecaoCodigoTributario {
  tipo: 'beneficio' | 'classificacao';
  id: string;
  rotulo: string;
}

interface Props {
  aberto: boolean;
  /** Cópia da versão em edição, tirada ao abrir; `null` abre o formulário de um registro novo. */
  detalhe: DetalheRegra | null;
  /** Motivo pelo qual a edição não pode mais ser salva (registro removido por outro usuário). */
  bloqueado?: string | null;
  /** Relê o registro após um 409, troca a versão enviada e devolve `false` se ele não existe mais. */
  onRecarregar?: () => Promise<boolean>;
  selecaoCodigo?: SelecaoCodigoTributario | null;
  onFechar: () => void;
  /** Devolve `null` quando gravou; senão a falha que o formulário exibe. */
  onSalvar: (corpo: CorpoRegra) => Promise<FalhaSalvar | null>;
  onNovoCodigo: (tipo: 'beneficio' | 'classificacao') => void;
}

type ChaveCombo = 'enquadramentoId' | 'operacaoId' | 'cfopId' | 'beneficioFiscalId' | 'classificacaoIbsCbsId';
type Rotulos = Record<ChaveCombo, string>;
const ROTULOS_VAZIOS: Rotulos = { enquadramentoId: '', operacaoId: '', cfopId: '', beneficioFiscalId: '', classificacaoIbsCbsId: '' };

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
  };
}

function rotulosDe(detalhe: DetalheRegra): Rotulos {
  return {
    enquadramentoId: `${detalhe.enquadramentoCodigo} · ${detalhe.operacaoRotulo}`,
    operacaoId: detalhe.operacaoRotulo,
    cfopId: mascararCfop(detalhe.cfopCodigo),
    beneficioFiscalId: detalhe.beneficioDescricao,
    classificacaoIbsCbsId: detalhe.classificacaoDescricao,
  };
}

const PERCENTUAL_INVALIDO = 'Informe um percentual de 0,00 a 100,00.';

/** Validação local dos obrigatórios e dos formatos, antes de chamar o servidor. */
function validar(form: CorpoRegra): Record<string, string> {
  const erros: Record<string, string> = {};
  if (!form.enquadramentoId) erros.enquadramentoId = 'Selecione o enquadramento fiscal.';
  if (!form.operacaoId) erros.operacaoId = 'Selecione a operação.';
  if (!form.cfopId) erros.cfopId = 'Selecione a operação fiscal (CFOP).';
  if (!form.beneficioFiscalId) erros.beneficioFiscalId = 'Selecione o benefício fiscal.';
  if (!form.classificacaoIbsCbsId) erros.classificacaoIbsCbsId = 'Selecione a classificação IBS/CBS.';
  if (normalizarPercentual(form.pRedBc) === null) erros.pRedBc = PERCENTUAL_INVALIDO;
  if (normalizarPercentual(form.pIcms) === null) erros.pIcms = PERCENTUAL_INVALIDO;
  if (!form.vigenciaInicio) erros.vigenciaInicio = 'Informe o início de vigência.';
  if (form.vigenciaFim && form.vigenciaInicio && form.vigenciaFim < form.vigenciaInicio) {
    erros.vigenciaFim = 'Fim de vigência deve ser igual ou posterior ao início.';
  }
  if (!justificativaValida(form.justificativa)) erros.justificativa = 'Informe a justificativa (3 a 500 caracteres).';
  return erros;
}

export function RegraDrawer({ aberto, detalhe, bloqueado = null, onRecarregar, selecaoCodigo, onFechar, onSalvar, onNovoCodigo }: Props) {
  const retornoFoco = useRetornoFoco(aberto);
  const manterDialogoAninhado = (event: { target: EventTarget | null; preventDefault: () => void }) => {
    const alvo = event.target;
    if (!(alvo instanceof Element)) return;
    if (alvo.closest('[data-slot="dialog-content"], [data-slot="dialog-overlay"], [data-slot="alert-dialog-content"], [data-slot="alert-dialog-overlay"]')) {
      event.preventDefault();
    }
  };
  const [form, setForm] = useState<CorpoRegra>(VAZIO);
  const [rotulos, setRotulos] = useState<Rotulos>(ROTULOS_VAZIOS);
  const [errosLocais, setErrosLocais] = useState<Record<string, string>>({});
  const [errosServidor, setErrosServidor] = useState<Record<string, string>>({});
  const [aviso, setAviso] = useState<string | null>(null);
  const [verificado, setVerificado] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  /** Pedido em voo: o segundo clique não envia de novo. */
  const emVoo = useRef(false);
  const [conflito, setConflito] = useState(false);
  const [recarregando, setRecarregando] = useState(false);
  const [recarregado, setRecarregado] = useState(false);
  const [preenchendo, setPreenchendo] = useState(false);
  const [sujo, setSujo] = useState(false);
  const [confirmarSaida, setConfirmarSaida] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setForm(detalhe ? deDetalhe(detalhe) : VAZIO);
    setRotulos(detalhe ? rotulosDe(detalhe) : ROTULOS_VAZIOS);
    setErrosLocais({});
    setErrosServidor({});
    setAviso(null);
    setVerificado(false);
    setErroSalvar(null);
    setConflito(false);
    setRecarregado(false);
    setSujo(false);
    setConfirmarSaida(false);
    // Só a abertura inicializa: recarga da ficha por evento de outro usuário não apaga o que foi digitado.
  }, [aberto]);

  useEffect(() => {
    if (!aberto || !selecaoCodigo) return;
    const chave: ChaveCombo = selecaoCodigo.tipo === 'beneficio' ? 'beneficioFiscalId' : 'classificacaoIbsCbsId';
    setForm((atual) => ({ ...atual, [chave]: selecaoCodigo.id }));
    setRotulos((atual) => ({ ...atual, [chave]: selecaoCodigo.rotulo }));
    setSujo(true);
  }, [aberto, selecaoCodigo]);

  function limparErro(chave: string) {
    setErrosLocais(({ [chave]: _l, ...resto }) => resto);
    setErrosServidor(({ [chave]: _s, ...resto }) => resto);
    setVerificado(false);
  }

  function set<K extends keyof CorpoRegra>(chave: K, valor: CorpoRegra[K]) {
    setSujo(true);
    limparErro(chave);
    setForm((atual) => ({ ...atual, [chave]: valor }));
  }

  function escolher(chave: ChaveCombo, opcao: OpcaoCombo | null) {
    set(chave, opcao?.id ?? '');
    setRotulos((atual) => ({ ...atual, [chave]: opcao?.rotulo ?? '' }));
  }

  /** Ao escolher o enquadramento, Operação e CFOP assumem os valores dele e continuam visíveis. */
  async function escolherEnquadramento(opcao: OpcaoCombo | null) {
    escolher('enquadramentoId', opcao);
    if (!opcao) return;
    setPreenchendo(true);
    setAviso(null);
    try {
      const ref = await regrasApi.enquadramento(opcao.id);
      setForm((atual) => (atual.enquadramentoId === opcao.id ? { ...atual, operacaoId: ref.operacaoId, cfopId: ref.cfopId } : atual));
      setRotulos((atual) => ({ ...atual, operacaoId: ref.operacaoRotulo, cfopId: mascararCfop(ref.cfopCodigo) }));
      setErrosLocais(({ operacaoId: _o, cfopId: _c, ...resto }) => resto);
    } catch (falha) {
      setAviso(`Não foi possível carregar a operação e o CFOP do enquadramento. ${falha instanceof Error ? falha.message : ''}`.trim());
    } finally {
      setPreenchendo(false);
    }
  }

  function verificar() {
    const erros = validar(form);
    setErrosLocais(erros);
    setErroSalvar(null);
    if (Object.keys(erros).length > 0) {
      setVerificado(false);
      setAviso('Corrija os campos destacados.');
      return false;
    }
    setAviso(null);
    setVerificado(true);
    return true;
  }

  async function salvar() {
    if (emVoo.current || !verificar()) return;
    setVerificado(false);
    setRecarregado(false);
    emVoo.current = true;
    setSalvando(true);
    try {
      const falha = await onSalvar({
        ...form,
        justificativa: textoUtil(form.justificativa),
        vigenciaFim: form.vigenciaFim || null,
      });
      setConflito(Boolean(falha?.conflito));
      if (falha) {
        setErroSalvar(falha.mensagem);
        setErrosServidor(errosPorCampo(falha.porCampo));
      }
    } catch (erro) {
      setErroSalvar(erro instanceof ErroRegra ? mensagemDeRegra(erro) : 'Falha na operação.');
    } finally {
      emVoo.current = false;
      setSalvando(false);
    }
  }

  async function recarregar() {
    if (!onRecarregar) return;
    setRecarregando(true);
    try {
      const existe = await onRecarregar();
      setConflito(false);
      setErroSalvar(null);
      setRecarregado(existe);
    } finally {
      setRecarregando(false);
    }
  }

  function tentarFechar() {
    if (salvando) return;
    if (sujo) setConfirmarSaida(true);
    else onFechar();
  }

  const erroDe = (chave: string) => errosLocais[chave] ?? errosServidor[chave];

  return (
    <>
      <Sheet open={aberto} onOpenChange={(open) => { if (!open) tentarFechar(); }}>
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
          <form
            id="regra-form"
            noValidate
            className="grid gap-3 px-4"
            onSubmit={(e) => { e.preventDefault(); void salvar(); }}
          >
            <CampoForm rotulo="Enquadramento fiscal" htmlFor="reg-enq" erro={erroDe('enquadramentoId')}>
              <ComboboxBusca id="reg-enq" buscar={buscarEnquadramentos} value={form.enquadramentoId} rotulo={rotulos.enquadramentoId} onChange={(o) => void escolherEnquadramento(o)} placeholder="Enquadramento fiscal" searchPlaceholder="Buscar enquadramento" />
            </CampoForm>
            <CampoForm rotulo="Operação" htmlFor="reg-op" erro={erroDe('operacaoId')}>
              <ComboboxBusca id="reg-op" tipo="operacoes" value={form.operacaoId} rotulo={rotulos.operacaoId} onChange={(o) => escolher('operacaoId', o)} placeholder="Operação" searchPlaceholder="Buscar operação" />
            </CampoForm>
            <CampoForm rotulo="Operação fiscal (CFOP)" htmlFor="reg-cfop" erro={erroDe('cfopId')}>
              <ComboboxBusca id="reg-cfop" tipo="cfops" value={form.cfopId} rotulo={rotulos.cfopId} onChange={(o) => escolher('cfopId', o)} placeholder="Operação fiscal (CFOP)" searchPlaceholder="Buscar CFOP" />
            </CampoForm>
            {preenchendo && <p role="status" className="text-xs text-muted-foreground">Carregando a operação e o CFOP do enquadramento…</p>}
            <CampoSelect rotulo="Tratamento ICMS" valor={form.icmsCst} opcoes={ROTULOS_ICMS} erro={erroDe('icmsCst')} onChange={(valor) => set('icmsCst', valor)} />
            <CampoForm rotulo="Redução de base do ICMS (%)" erro={erroDe('pRedBc')}>
              <span className="inline-flex items-center gap-1">
                <span aria-hidden="true">%</span>
                <input aria-label="Redução de base do ICMS (%)" inputMode="decimal" className="h-8 w-full rounded-md border px-2" value={form.pRedBc} onChange={(e) => set('pRedBc', e.target.value)} />
              </span>
            </CampoForm>
            <CampoForm rotulo="Alíquota (%)" erro={erroDe('pIcms')}>
              <span className="inline-flex items-center gap-1">
                <span aria-hidden="true">%</span>
                <input aria-label="Alíquota (%)" inputMode="decimal" className="h-8 w-full rounded-md border px-2" value={form.pIcms} onChange={(e) => set('pIcms', e.target.value)} />
              </span>
            </CampoForm>
            <CampoForm rotulo="Benefício fiscal" htmlFor="reg-ben" erro={erroDe('beneficioFiscalId')}>
              <ComboboxBusca id="reg-ben" buscar={buscarBeneficios} value={form.beneficioFiscalId} rotulo={rotulos.beneficioFiscalId} onChange={(o) => escolher('beneficioFiscalId', o)} placeholder="Benefício fiscal" searchPlaceholder="Buscar benefício fiscal" />
              <Button type="button" variant="secondary" onClick={() => onNovoCodigo('beneficio')}>Novo código</Button>
            </CampoForm>
            <CampoSelect rotulo="Tratamento IPI" valor={form.ipiCst} opcoes={ROTULOS_IPI} erro={erroDe('ipiCst')} onChange={(valor) => set('ipiCst', valor)} />
            <CampoSelect rotulo="Tratamento PIS/COFINS" valor={form.pisCst} opcoes={ROTULOS_PIS} erro={erroDe('pisCst')} onChange={(valor) => set('pisCst', valor)} />
            <CampoSelect rotulo="Tratamento IBS/CBS" valor={form.ibsCst} opcoes={ROTULOS_IBS} erro={erroDe('ibsCst')} onChange={(valor) => set('ibsCst', valor)} />
            <CampoForm rotulo="Classificação IBS/CBS" htmlFor="reg-cla" erro={erroDe('classificacaoIbsCbsId')}>
              <ComboboxBusca id="reg-cla" buscar={buscarClassificacoes} value={form.classificacaoIbsCbsId} rotulo={rotulos.classificacaoIbsCbsId} onChange={(o) => escolher('classificacaoIbsCbsId', o)} placeholder="Classificação IBS/CBS" searchPlaceholder="Buscar classificação IBS/CBS" />
              <Button type="button" variant="secondary" onClick={() => onNovoCodigo('classificacao')}>Novo código</Button>
            </CampoForm>
            <CampoForm rotulo="Início de vigência" selo="H-E01-10" erro={erroDe('vigenciaInicio')}>
              <input aria-label="Início de vigência" type="date" className="h-8 w-full rounded-md border px-2" value={form.vigenciaInicio} onChange={(e) => set('vigenciaInicio', e.target.value)} />
            </CampoForm>
            <CampoForm rotulo="Fim de vigência" selo="H-E01-10" erro={erroDe('vigenciaFim')}>
              <input aria-label="Fim de vigência" type="date" className="h-8 w-full rounded-md border px-2" value={form.vigenciaFim ?? ''} onChange={(e) => set('vigenciaFim', e.target.value)} />
            </CampoForm>
            <CampoForm rotulo="Justificativa auditável" htmlFor="regra-justificativa" erro={erroDe('justificativa')}>
              <textarea id="regra-justificativa" maxLength={500} className="min-h-16 rounded-md border px-2 py-1" value={form.justificativa} onChange={(e) => set('justificativa', e.target.value)} />
            </CampoForm>
            {aviso && <p role="alert" className="text-sm text-destructive">{aviso}</p>}
            {verificado && <p role="status" className="text-sm text-muted-foreground">Dados verificados.</p>}
            {erroSalvar && !bloqueado && <p role="alert" className="text-sm text-destructive">{erroSalvar}</p>}
            {bloqueado && <p role="alert" className="text-sm text-destructive">{bloqueado}</p>}
            {recarregado && <p role="status" className="text-sm text-muted-foreground">Dados recarregados. Revise o que digitou e salve de novo.</p>}
            {conflito && onRecarregar && !bloqueado && (
              <Button type="button" variant="secondary" size="sm" className="justify-self-start" loading={recarregando} onClick={() => void recarregar()}>Recarregar dados</Button>
            )}
          </form>
          <SheetFooter>
            <Button type="button" variant="secondary" onClick={tentarFechar}>Cancelar</Button>
            <Button type="button" variant="secondary" onClick={() => verificar()}>Verificar dados</Button>
            <Button type="submit" form="regra-form" loading={salvando} disabled={salvando || preenchendo || Boolean(bloqueado)}>Salvar rascunho</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
      <ConfirmarSaidaDialog
        aberto={confirmarSaida}
        onAbertoChange={setConfirmarSaida}
        onDescartar={() => {
          setConfirmarSaida(false);
          onFechar();
        }}
      />
    </>
  );
}

function CampoSelect({ rotulo, valor, opcoes, erro, onChange }: {
  rotulo: string;
  valor: string;
  opcoes: Record<string, string>;
  erro?: string;
  onChange: (valor: string) => void;
}) {
  return (
    <CampoForm rotulo={rotulo} erro={erro}>
      <select aria-label={rotulo} className="h-8 w-full rounded-md border px-2" value={valor} onChange={(e) => onChange(e.target.value)}>
        {Object.entries(opcoes).map(([codigo, nome]) => <option key={codigo} value={codigo}>{nome}</option>)}
      </select>
    </CampoForm>
  );
}
