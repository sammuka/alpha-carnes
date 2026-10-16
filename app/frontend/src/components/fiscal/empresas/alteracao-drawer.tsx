'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import {
  ehConflitoConcorrente,
  ErroFiscal,
  fiscalApi,
  mensagemDoErroFiscal,
  type AlteracaoAberta,
  type CnaeItem,
  type DadosFiscais,
  type EstabelecimentoDetalhe,
} from '@/lib/fiscal-empresas';
import { useErrosPorCampo } from '@/lib/use-erros-campo';
import { CamposDadosFiscais } from './campos-dados-fiscais';
import {
  errosCnaesDoServidor,
  normalizarListaCnaes,
  SEM_ERROS_CNAES,
  temErroCnaes,
  validarCnaes,
  type ErrosCnaes,
} from './cnaes-editor';
import { ConfirmarSaidaDialog } from './confirmar-saida-dialog';
import { useRetornoFoco } from './use-retorno-foco';
import { justificativaValida, normalizarJustificativa } from '@/lib/justificativa';

interface AlteracaoDrawerProps {
  aberto: boolean;
  onFechar: () => void;
  /** Estabelecimento aprovado: ele continua com os valores aprovados enquanto a proposta é revisada. */
  estabelecimento: EstabelecimentoDetalhe;
  onSalvo: () => void;
  onConflito: () => void;
}

function dadosDe(origem: Pick<DadosFiscais, keyof DadosFiscais>): DadosFiscais {
  return {
    nome: origem.nome,
    inscricaoEstadual: origem.inscricaoEstadual,
    inscricaoMunicipal: origem.inscricaoMunicipal,
    uf: origem.uf,
  };
}

function cnaesDe(lista: CnaeItem[]): CnaeItem[] {
  return lista.map(({ codigo, descricao, tipo }) => ({ codigo, descricao, tipo }));
}

/** Proposta de alteração de um estabelecimento aprovado (o aprovado nunca é editado no lugar). */
export function AlteracaoDrawer({ aberto, onFechar, estabelecimento: atual, onSalvo, onConflito }: AlteracaoDrawerProps) {
  const retornoFoco = useRetornoFoco(aberto);
  // Instantâneo do cadastro no momento em que o drawer abre: uma atualização em tempo real não apaga o
  // que o usuário digitou nem troca a versão sobre a qual a proposta foi escrita.
  const [estabelecimento, setEstabelecimento] = useState(atual);
  const proposta: AlteracaoAberta | null =
    estabelecimento.alteracaoAberta?.situacao === 'DRAFT' ? estabelecimento.alteracaoAberta : null;

  const [dados, setDados] = useState<DadosFiscais>(dadosDe(estabelecimento));
  const [cnaes, setCnaes] = useState<CnaeItem[]>([]);
  const [justificativa, setJustificativa] = useState('');
  const { erros, setErros, limparCampo } = useErrosPorCampo();
  const [errosCnaes, setErrosCnaes] = useState<ErrosCnaes>(SEM_ERROS_CNAES);
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [confirmarSaida, setConfirmarSaida] = useState(false);
  const baseline = useRef('');

  const instantaneo = (d: DadosFiscais, l: CnaeItem[], j: string) => JSON.stringify({ d, l, j });

  useEffect(() => {
    if (!aberto) return;
    setEstabelecimento(atual);
    const origem = (atual.alteracaoAberta?.situacao === 'DRAFT' ? atual.alteracaoAberta : null) ?? atual;
    const d = dadosDe(origem);
    const l = cnaesDe(origem.cnaes);
    setDados(d);
    setCnaes(l);
    setJustificativa('');
    setErros({});
    setErrosCnaes(SEM_ERROS_CNAES);
    setErroGeral(null);
    setConfirmarSaida(false);
    baseline.current = instantaneo(d, l, '');
  }, [aberto]);

  const sujo = aberto && instantaneo(dados, cnaes, justificativa) !== baseline.current;

  const tentarFechar = () => {
    if (salvando) return;
    if (sujo) setConfirmarSaida(true);
    else onFechar();
  };

  const validar = (): boolean => {
    const locais: Record<string, string> = {};
    if (!dados.nome.trim()) locais.nome = 'Informe o nome do estabelecimento.';
    if (!dados.inscricaoEstadual.trim()) locais.inscricaoEstadual = 'Informe a inscrição estadual.';
    if (!dados.inscricaoMunicipal.trim()) locais.inscricaoMunicipal = 'Informe a inscrição municipal.';
    if (!dados.uf) locais.uf = 'Selecione o estado.';
    if (!justificativaValida(justificativa)) locais.justificativa = 'Informe o motivo (mínimo de 3 caracteres).';
    const cnaesInvalidos = validarCnaes(cnaes);
    setErros(locais);
    setErrosCnaes(cnaesInvalidos);
    return Object.keys(locais).length === 0 && !temErroCnaes(cnaesInvalidos);
  };

  /** Grava a proposta (POST ou PATCH) e devolve a versão corrente dela. */
  const gravar = async (): Promise<AlteracaoAberta> => {
    const motivo = normalizarJustificativa(justificativa);
    const lista = normalizarListaCnaes(cnaes);
    if (proposta) {
      return fiscalApi.atualizarAlteracao(estabelecimento.id, proposta.id, {
        ...dados,
        cnaes: lista,
        versao: proposta.versao,
        justificativa: motivo,
      });
    }
    return fiscalApi.criarAlteracao(estabelecimento.id, {
      ...dados,
      cnaes: lista,
      versao: estabelecimento.versao,
      justificativa: motivo,
    });
  };

  const salvar = async (submeter: boolean) => {
    if (salvando) return;
    setErroGeral(null);
    if (!validar()) return;
    const igualAoAprovado =
      instantaneo(dados, normalizarListaCnaes(cnaes), '') ===
      instantaneo(dadosDe(estabelecimento), normalizarListaCnaes(estabelecimento.cnaes), '');
    if (!proposta && igualAoAprovado) {
      setErroGeral('Nenhum campo foi alterado em relação ao cadastro aprovado.');
      return;
    }
    setSalvando(true);
    try {
      const salva = await gravar();
      if (submeter) {
        await fiscalApi.acaoAlteracao(estabelecimento.id, salva.id, 'submeter', {
          versao: salva.versao,
          justificativa: normalizarJustificativa(justificativa),
        });
        toast.success('Alteração enviada para revisão.');
      } else {
        toast.success('Proposta de alteração salva.');
      }
      onSalvo();
      onFechar();
    } catch (falha) {
      if (falha instanceof ErroFiscal) setErros(falha.porCampo);
      setErrosCnaes(errosCnaesDoServidor(falha, cnaes) ?? SEM_ERROS_CNAES);
      if (ehConflitoConcorrente(falha)) onConflito();
      setErroGeral(mensagemDoErroFiscal(falha));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <>
      <Sheet open={aberto} onOpenChange={(aberta) => { if (!aberta) tentarFechar(); }}>
        <SheetContent onCloseAutoFocus={retornoFoco} className="gap-0 p-0 sm:max-w-[600px]">
          <SheetHeader className="border-b border-border p-4">
            <span className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-primary">Cadastro · Fiscal</span>
            <SheetTitle className="text-[16px] font-bold">Alteração do estabelecimento</SheetTitle>
            <SheetDescription className="text-xs">
              {estabelecimento.nome} está aprovado: a proposta só vale depois de revisada e aprovada.
            </SheetDescription>
          </SheetHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void salvar(false);
            }}
            className="flex flex-1 flex-col overflow-y-auto"
            noValidate
          >
            <div className="flex-1 space-y-4 p-4">
              <CamposDadosFiscais
                valores={dados}
                onCampo={(campo, valor) => {
                  limparCampo(campo);
                  setDados((atual) => ({ ...atual, [campo]: valor }));
                }}
                erros={erros}
                cnaes={cnaes}
                onCnaes={(lista) => {
                  setErrosCnaes(SEM_ERROS_CNAES);
                  setCnaes(lista);
                }}
                errosCnaes={errosCnaes}
              />

              <FormField label="Motivo da alteração" required htmlFor="alteracao-motivo" error={erros.justificativa}>
                <Textarea
                  id="alteracao-motivo"
                  rows={3}
                  maxLength={500}
                  placeholder="Por que este cadastro precisa ser alterado?"
                  value={justificativa}
                  aria-invalid={'justificativa' in erros || undefined}
                  onChange={(e) => {
                    limparCampo('justificativa');
                    setJustificativa(e.target.value);
                  }}
                />
              </FormField>

              {erroGeral && (
                <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                  {erroGeral}
                </p>
              )}
            </div>

            <SheetFooter className="flex-row justify-end gap-2 border-t border-border p-4">
              <Button type="button" variant="ghost" onClick={tentarFechar}>
                Cancelar
              </Button>
              <Button type="submit" variant="secondary" disabled={salvando}>
                Salvar proposta
              </Button>
              <Button type="button" loading={salvando} onClick={() => void salvar(true)}>
                Submeter para revisão
              </Button>
            </SheetFooter>
          </form>
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
