'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { errosPorCampo, justificativaValida, textoUtil, type FalhaSalvar } from '@/lib/fiscal-comum-ui';
import { rotuloData, type OpcaoCombo } from '@/lib/fiscal-enquadramentos';
import {
  TEXTO_PENDENTE,
  ErroHomologacao,
  buscarRegrasAprovadas,
  homologacoesApi,
  mensagemDeHomologacao,
  type CorpoAbertura,
  type RegraEscolhida,
} from '@/lib/fiscal-homologacoes';
import { CampoForm } from '../comum/campo-form';
import { Campo } from '../empresas/aba-ficha';
import { ConfirmarSaidaDialog } from '../empresas/confirmar-saida-dialog';
import { useRetornoFoco } from '../empresas/use-retorno-foco';
import { ComboboxBusca } from '../enquadramentos/combobox-busca';

interface Props {
  aberto: boolean;
  onFechar: () => void;
  /** Devolve `null` quando gravou; senão a falha que o formulário exibe. */
  onSalvar: (corpo: CorpoAbertura) => Promise<FalhaSalvar | null>;
}

const VAZIO: CorpoAbertura = { regraId: '', descricao: '', justificativa: '' };

/** Validação local dos obrigatórios, antes de chamar o servidor. */
function validar(form: CorpoAbertura): Record<string, string> {
  const erros: Record<string, string> = {};
  if (!form.regraId) erros.regraId = 'Selecione a versão aprovada da regra.';
  if (!justificativaValida(form.descricao)) erros.descricao = 'Informe a descrição (3 a 500 caracteres).';
  if (!justificativaValida(form.justificativa)) erros.justificativa = 'Informe a justificativa auditável (3 a 500 caracteres).';
  return erros;
}

export function HomologacaoDrawer({ aberto, onFechar, onSalvar }: Props) {
  const retorno = useRetornoFoco(aberto);
  const manterDialogoAninhado = (event: { target: EventTarget | null; preventDefault: () => void }) => {
    const alvo = event.target;
    if (!(alvo instanceof Element)) return;
    if (alvo.closest('[data-slot="alert-dialog-content"], [data-slot="alert-dialog-overlay"]')) event.preventDefault();
  };
  const [form, setForm] = useState<CorpoAbertura>(VAZIO);
  const [rotuloRegra, setRotuloRegra] = useState('');
  const [regra, setRegra] = useState<RegraEscolhida | null>(null);
  const [carregandoRegra, setCarregandoRegra] = useState(false);
  const [errosLocais, setErrosLocais] = useState<Record<string, string>>({});
  const [errosServidor, setErrosServidor] = useState<Record<string, string>>({});
  const [aviso, setAviso] = useState<string | null>(null);
  const [verificado, setVerificado] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  /** Pedido em voo: o segundo clique não envia de novo. */
  const emVoo = useRef(false);
  const [sujo, setSujo] = useState(false);
  const [confirmarSaida, setConfirmarSaida] = useState(false);
  const ultimaRegra = useRef('');

  useEffect(() => {
    if (!aberto) return;
    setForm(VAZIO);
    setRotuloRegra('');
    setRegra(null);
    setErrosLocais({});
    setErrosServidor({});
    setAviso(null);
    setVerificado(false);
    setErroSalvar(null);
    setSujo(false);
    setConfirmarSaida(false);
  }, [aberto]);

  function limparErro(chave: string) {
    setErrosLocais(({ [chave]: _l, ...resto }) => resto);
    setErrosServidor(({ [chave]: _s, ...resto }) => resto);
    setVerificado(false);
  }

  function set<K extends keyof CorpoAbertura>(chave: K, valor: CorpoAbertura[K]) {
    setSujo(true);
    limparErro(chave);
    setForm((atual) => ({ ...atual, [chave]: valor }));
  }

  /** Ao escolher o enquadramento, usuário e vigência aparecem em leitura. */
  async function escolherRegra(opcao: OpcaoCombo | null) {
    set('regraId', opcao?.id ?? '');
    setRotuloRegra(opcao?.rotulo ?? '');
    setRegra(null);
    setAviso(null);
    ultimaRegra.current = opcao?.id ?? '';
    if (!opcao) return;
    setCarregandoRegra(true);
    try {
      const escolhida = await homologacoesApi.regra(opcao.id);
      if (ultimaRegra.current === opcao.id) setRegra(escolhida);
    } catch (falha) {
      setAviso(`Não foi possível carregar os dados da regra. ${falha instanceof Error ? falha.message : ''}`.trim());
    } finally {
      if (ultimaRegra.current === opcao.id) setCarregandoRegra(false);
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
    emVoo.current = true;
    setSalvando(true);
    try {
      const falha = await onSalvar({ ...form, descricao: textoUtil(form.descricao), justificativa: textoUtil(form.justificativa) });
      if (falha) {
        setErroSalvar(falha.mensagem);
        setErrosServidor(errosPorCampo(falha.porCampo));
      }
    } catch (erro) {
      setErroSalvar(erro instanceof ErroHomologacao ? mensagemDeHomologacao(erro) : 'Falha na operação.');
    } finally {
      emVoo.current = false;
      setSalvando(false);
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
          onCloseAutoFocus={retorno}
          onPointerDownOutside={manterDialogoAninhado}
          onFocusOutside={manterDialogoAninhado}
          onInteractOutside={manterDialogoAninhado}
          className="w-full overflow-y-auto sm:max-w-md"
        >
          <SheetHeader>
            <SheetTitle>Novo registro</SheetTitle>
          </SheetHeader>
          <form
            id="homologacao-form"
            noValidate
            className="grid gap-3 px-4 text-sm"
            onSubmit={(e) => { e.preventDefault(); void salvar(); }}
          >
            <CampoForm rotulo="Enquadramento fiscal" htmlFor="hom-regra" erro={erroDe('regraId')}>
              <ComboboxBusca
                id="hom-regra"
                buscar={buscarRegrasAprovadas}
                value={form.regraId}
                rotulo={rotuloRegra}
                onChange={(o) => void escolherRegra(o)}
                placeholder="Enquadramento fiscal"
                searchPlaceholder="Buscar enquadramento"
              />
            </CampoForm>
            <CampoForm rotulo="Descrição" htmlFor="descricao-homologacao" erro={erroDe('descricao')}>
              <input id="descricao-homologacao" maxLength={500} className="h-8 rounded-md border px-2" value={form.descricao} onChange={(e) => set('descricao', e.target.value)} />
            </CampoForm>
            <CampoForm rotulo="Justificativa auditável" htmlFor="justificativa-homologacao" erro={erroDe('justificativa')}>
              <textarea id="justificativa-homologacao" maxLength={500} className="min-h-20 rounded-md border px-2 py-1" value={form.justificativa} onChange={(e) => set('justificativa', e.target.value)} />
            </CampoForm>
            {carregandoRegra && <p role="status" className="text-xs text-muted-foreground">Carregando os dados da regra…</p>}
            <Campo label="Usuário">{regra ? (regra.autor ?? '—') : '—'}</Campo>
            <Campo label="Início de vigência">{regra ? rotuloData(regra.vigenciaInicio) : '—'}</Campo>
            <Campo label="Fim de vigência">{regra ? (regra.vigenciaFim ? rotuloData(regra.vigenciaFim) : 'Sem fim') : '—'}</Campo>
            <Campo label="Situação">Em revisão</Campo>
            <Campo label="Responsável pela aprovação">{TEXTO_PENDENTE}</Campo>
            {aviso && <p role="alert" className="text-destructive">{aviso}</p>}
            {verificado && <p role="status" className="text-muted-foreground">Dados verificados.</p>}
            {erroSalvar && <p role="alert" className="text-destructive">{erroSalvar}</p>}
          </form>
          <SheetFooter className="flex-row flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={tentarFechar}>Cancelar</Button>
            <Button type="button" variant="secondary" onClick={() => verificar()}>Verificar dados</Button>
            <Button type="submit" form="homologacao-form" loading={salvando}>Salvar rascunho</Button>
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
