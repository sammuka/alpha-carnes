'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { buscarEnquadramentos, errosPorCampo, type FalhaSalvar } from '@/lib/fiscal-comum-ui';
import { mascararNcm, type OpcaoCombo } from '@/lib/fiscal-enquadramentos';
import {
  ErroSimulacao,
  MSG_PESO,
  MSG_QUANTIDADE,
  mensagemDeSimulacao,
  descontoMaiorQueValor,
  simulacoesApi,
  validarDinheiro,
  validarEscala,
  type CorpoSimulacao,
} from '@/lib/fiscal-simulacoes';
import { CampoForm } from '../comum/campo-form';
import { ConfirmarSaidaDialog } from '../empresas/confirmar-saida-dialog';
import { useRetornoFoco } from '../empresas/use-retorno-foco';
import { ComboboxBusca } from '../enquadramentos/combobox-busca';

interface Props {
  aberto: boolean;
  onFechar: () => void;
  /** Devolve `null` quando gravou; senão a falha que o formulário exibe. */
  onSalvar: (corpo: CorpoSimulacao) => Promise<FalhaSalvar | null>;
}

type ChaveCombo = 'estabelecimentoId' | 'operacaoId' | 'clienteId' | 'produtoId' | 'ncmId' | 'enquadramentoId';
type Rotulos = Record<ChaveCombo, string>;
const ROTULOS_VAZIOS: Rotulos = { estabelecimentoId: '', operacaoId: '', clienteId: '', produtoId: '', ncmId: '', enquadramentoId: '' };

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

const OBRIGATORIOS_COMBO: Array<[ChaveCombo, string]> = [
  ['estabelecimentoId', 'Selecione o estabelecimento.'],
  ['operacaoId', 'Selecione a operação.'],
  ['clienteId', 'Selecione o cliente.'],
  ['produtoId', 'Selecione o produto.'],
  ['ncmId', 'Selecione a classificação fiscal (NCM).'],
  ['enquadramentoId', 'Selecione o enquadramento fiscal.'],
];

/** Validação local dos obrigatórios e dos formatos, antes de chamar o servidor. */
function validar(form: CorpoSimulacao): Record<string, string> {
  const erros: Record<string, string> = {};
  for (const [chave, mensagem] of OBRIGATORIOS_COMBO) if (!form[chave]) erros[chave] = mensagem;
  if (!form.quantidade.trim()) erros.quantidade = 'Informe a quantidade.';
  else {
    const mensagem = validarEscala(form.quantidade, 12, MSG_QUANTIDADE);
    if (mensagem) erros.quantidade = mensagem;
  }
  if (!form.pesoNf.trim()) erros.pesoNf = 'Informe o peso informado na nota (kg).';
  else {
    const mensagem = validarEscala(form.pesoNf, 7, MSG_PESO);
    if (mensagem) erros.pesoNf = mensagem;
  }
  if (!form.valor.trim()) erros.valor = 'Informe o valor.';
  else {
    const mensagem = validarDinheiro(form.valor, { exigirPositivo: true });
    if (mensagem) erros.valor = mensagem;
  }
  if (!form.desconto.trim()) erros.desconto = 'Informe o desconto (0,00 se não houver).';
  else {
    const mensagem = validarDinheiro(form.desconto, { exigirPositivo: false });
    if (mensagem) erros.desconto = mensagem;
  }
  if (!erros.valor && !erros.desconto && descontoMaiorQueValor(form.desconto, form.valor)) {
    erros.desconto = 'O desconto não pode ser maior que o valor.';
  }
  if (!form.competencia) erros.competencia = 'Informe a competência.';
  if (form.justificativa.trim().length < 3) erros.justificativa = 'Informe o motivo da alteração (3 a 500 caracteres).';
  return erros;
}

export function SimulacaoDrawer({ aberto, onFechar, onSalvar }: Props) {
  const retornoFoco = useRetornoFoco(aberto);
  const [form, setForm] = useState<CorpoSimulacao>(VAZIO);
  const [rotulos, setRotulos] = useState<Rotulos>(ROTULOS_VAZIOS);
  const [errosLocais, setErrosLocais] = useState<Record<string, string>>({});
  const [errosServidor, setErrosServidor] = useState<Record<string, string>>({});
  const [aviso, setAviso] = useState<string | null>(null);
  const [verificado, setVerificado] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [preenchendo, setPreenchendo] = useState(false);
  const [sujo, setSujo] = useState(false);
  const [confirmarSaida, setConfirmarSaida] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setForm(VAZIO);
    setRotulos(ROTULOS_VAZIOS);
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

  function set<K extends keyof CorpoSimulacao>(chave: K, valor: CorpoSimulacao[K]) {
    setSujo(true);
    limparErro(chave);
    setForm((atual) => ({ ...atual, [chave]: valor }));
  }

  function escolher(chave: ChaveCombo, opcao: OpcaoCombo | null) {
    set(chave, opcao?.id ?? '');
    setRotulos((atual) => ({ ...atual, [chave]: opcao?.rotulo ?? '' }));
  }

  /** Ao escolher o enquadramento, os cinco combos que ele fixa assumem os valores dele e continuam visíveis. */
  async function escolherEnquadramento(opcao: OpcaoCombo | null) {
    escolher('enquadramentoId', opcao);
    if (!opcao) return;
    setPreenchendo(true);
    setAviso(null);
    try {
      const ref = await simulacoesApi.enquadramento(opcao.id);
      setForm((atual) => (atual.enquadramentoId === opcao.id ? {
        ...atual,
        estabelecimentoId: ref.estabelecimentoId,
        operacaoId: ref.operacaoId,
        clienteId: ref.clienteId,
        produtoId: ref.produtoId,
        ncmId: ref.ncmId,
      } : atual));
      setRotulos((atual) => ({
        ...atual,
        estabelecimentoId: ref.estabelecimentoNome,
        operacaoId: ref.operacaoRotulo,
        clienteId: ref.clienteNome,
        produtoId: ref.produtoNome,
        ncmId: `${mascararNcm(ref.ncmCodigo)} ${ref.ncmDescricao}`.trim(),
      }));
      setErrosLocais(({ estabelecimentoId: _a, operacaoId: _b, clienteId: _c, produtoId: _d, ncmId: _e, ...resto }) => resto);
    } catch (falha) {
      setAviso(`Não foi possível carregar os dados do enquadramento. ${falha instanceof Error ? falha.message : ''}`.trim());
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
    if (!verificar()) return;
    setVerificado(false);
    setSalvando(true);
    try {
      const falha = await onSalvar({ ...form, justificativa: form.justificativa.trim() });
      if (falha) {
        setErroSalvar(falha.mensagem);
        setErrosServidor(errosPorCampo(falha.porCampo));
      }
    } catch (erro) {
      setErroSalvar(erro instanceof ErroSimulacao ? mensagemDeSimulacao(erro) : 'Falha na operação.');
    } finally {
      setSalvando(false);
    }
  }

  function tentarFechar() {
    if (sujo && !salvando) setConfirmarSaida(true);
    else onFechar();
  }

  const erroDe = (chave: string) => errosLocais[chave] ?? errosServidor[chave];

  const combo = (chave: ChaveCombo, id: string, rotulo: string, tipo: 'estabelecimentos' | 'operacoes' | 'clientes' | 'produtos' | 'ncms', busca: string) => (
    <CampoForm rotulo={rotulo} htmlFor={id} erro={erroDe(chave)}>
      <ComboboxBusca id={id} tipo={tipo} value={form[chave]} rotulo={rotulos[chave]} onChange={(o) => escolher(chave, o)} placeholder={rotulo} searchPlaceholder={busca} />
    </CampoForm>
  );

  return (
    <>
      <Sheet open={aberto} onOpenChange={(open) => { if (!open) tentarFechar(); }}>
        <SheetContent aria-describedby={undefined} onCloseAutoFocus={retornoFoco} className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Novo registro</SheetTitle>
          </SheetHeader>
          <form
            id="simulacao-form"
            noValidate
            className="grid gap-3 px-4"
            onSubmit={(e) => { e.preventDefault(); void salvar(); }}
          >
            {combo('estabelecimentoId', 'sim-estab', 'Estabelecimento', 'estabelecimentos', 'Buscar estabelecimento')}
            {combo('operacaoId', 'sim-op', 'Operação', 'operacoes', 'Buscar operação')}
            {combo('clienteId', 'sim-cli', 'Cliente', 'clientes', 'Buscar cliente')}
            {combo('produtoId', 'sim-prod', 'Produto', 'produtos', 'Buscar produto')}
            {combo('ncmId', 'sim-ncm', 'Classificação fiscal (NCM)', 'ncms', 'Buscar NCM')}
            <CampoForm rotulo="Quantidade" erro={erroDe('quantidade')}>
              <input aria-label="Quantidade" inputMode="decimal" className="h-8 w-full rounded-md border px-2" value={form.quantidade} onChange={(e) => set('quantidade', e.target.value)} />
            </CampoForm>
            <CampoForm rotulo="Peso informado na nota (kg)" erro={erroDe('pesoNf')}>
              <input aria-label="Peso informado na nota (kg)" inputMode="decimal" className="h-8 w-full rounded-md border px-2" value={form.pesoNf} onChange={(e) => set('pesoNf', e.target.value)} />
            </CampoForm>
            <CampoForm rotulo="Valor" erro={erroDe('valor')}>
              <span className="inline-flex items-center gap-1">
                <span aria-hidden="true">R$</span>
                <input aria-label="Valor" inputMode="decimal" className="h-8 w-full rounded-md border px-2" value={form.valor} onChange={(e) => set('valor', e.target.value)} />
              </span>
            </CampoForm>
            <CampoForm rotulo="Desconto" erro={erroDe('desconto')}>
              <span className="inline-flex items-center gap-1">
                <span aria-hidden="true">R$</span>
                <input aria-label="Desconto" inputMode="decimal" className="h-8 w-full rounded-md border px-2" value={form.desconto} onChange={(e) => set('desconto', e.target.value)} />
              </span>
            </CampoForm>
            <CampoForm rotulo="Competência" erro={erroDe('competencia')}>
              <input aria-label="Competência" type="month" className="h-8 w-full rounded-md border px-2" value={form.competencia} onChange={(e) => set('competencia', e.target.value)} />
            </CampoForm>
            <CampoForm rotulo="Enquadramento fiscal" htmlFor="sim-enq" erro={erroDe('enquadramentoId')}>
              <ComboboxBusca id="sim-enq" buscar={buscarEnquadramentos} value={form.enquadramentoId} rotulo={rotulos.enquadramentoId} onChange={(o) => void escolherEnquadramento(o)} placeholder="Enquadramento fiscal" searchPlaceholder="Buscar enquadramento" />
            </CampoForm>
            {preenchendo && <p role="status" className="text-xs text-muted-foreground">Carregando os dados do enquadramento…</p>}
            <CampoForm rotulo="Valor líquido (calculado)">
              <input aria-label="Valor líquido (calculado)" disabled className="h-8 w-full rounded-md border px-2" placeholder="Calculado ao simular" />
            </CampoForm>
            <CampoForm rotulo="Base tributável (calculada)">
              <input aria-label="Base tributável (calculada)" disabled className="h-8 w-full rounded-md border px-2" placeholder="Calculado ao simular" />
            </CampoForm>
            <CampoForm rotulo="Motivo da alteração" htmlFor="simulacao-motivo" erro={erroDe('justificativa')}>
              <textarea id="simulacao-motivo" maxLength={500} className="min-h-16 rounded-md border px-2 py-1" value={form.justificativa} onChange={(e) => set('justificativa', e.target.value)} />
            </CampoForm>
            {aviso && <p role="alert" className="text-sm text-destructive">{aviso}</p>}
            {verificado && <p role="status" className="text-sm text-muted-foreground">Dados verificados.</p>}
            {erroSalvar && <p role="alert" className="text-sm text-destructive">{erroSalvar}</p>}
          </form>
          <SheetFooter>
            <Button type="button" variant="secondary" onClick={tentarFechar}>Cancelar</Button>
            <Button type="button" variant="secondary" onClick={() => verificar()}>Verificar dados</Button>
            <Button type="submit" form="simulacao-form" loading={salvando} disabled={preenchendo}>Salvar rascunho</Button>
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
