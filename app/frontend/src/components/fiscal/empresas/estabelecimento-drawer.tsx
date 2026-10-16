'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ComboboxField } from '@/components/ui/combobox-field';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { useErrosPorCampo } from '@/lib/use-erros-campo';
import {
  ehConflitoConcorrente,
  ErroFiscal,
  fiscalApi,
  mascararCnpjAlfanumerico,
  mensagemDoErroFiscal,
  normalizarCnpj,
  validarCnpjAlfanumerico,
  type CnaeItem,
  type DadosFiscais,
  type Empresa,
  type EstabelecimentoDetalhe,
} from '@/lib/fiscal-empresas';
import { CamposDadosFiscais, DADOS_VAZIOS } from './campos-dados-fiscais';
import { ConfirmarSaidaDialog } from './confirmar-saida-dialog';
import {
  errosCnaesDoServidor,
  normalizarListaCnaes,
  SEM_ERROS_CNAES,
  temErroCnaes,
  validarCnaes,
  type ErrosCnaes,
} from './cnaes-editor';
import { EmpresaDialog } from './empresa-dialog';
import { useRetornoFoco } from './use-retorno-foco';
import { normalizarJustificativa } from '@/lib/justificativa';

interface EstabelecimentoDrawerProps {
  aberto: boolean;
  onFechar: () => void;
  empresas: Empresa[];
  /** Estabelecimento em rascunho/rejeitado em edição; ausente = cadastro novo. */
  estabelecimento?: EstabelecimentoDetalhe | null;
  /** Empresa pré-selecionada no cadastro novo (a do filtro da grade). */
  empresaInicialId?: string;
  onEmpresaCriada: (empresa: Empresa) => void;
  onSalvo: (detalhe: EstabelecimentoDetalhe) => void;
  onConflito: () => void;
}

/** Itens do ComboboxField: o `id` fica interno; o usuário vê razão social e raiz do CNPJ. */
function itensEmpresa(empresas: Empresa[]) {
  return empresas.map((e) => ({ id: e.id, label: e.razaoSocial, sublabel: e.cnpjRaiz }));
}

export function EstabelecimentoDrawer({
  aberto,
  onFechar,
  empresas,
  estabelecimento: atual,
  empresaInicialId = '',
  onEmpresaCriada,
  onSalvo,
  onConflito,
}: EstabelecimentoDrawerProps) {
  const retornoFoco = useRetornoFoco(aberto);
  const [empresaId, setEmpresaId] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [dados, setDados] = useState<DadosFiscais>(DADOS_VAZIOS);
  const [cnaes, setCnaes] = useState<CnaeItem[]>([]);
  const [justificativa, setJustificativa] = useState('');
  const { erros, setErros, limparCampo: limpar, limparTudo } = useErrosPorCampo();
  const [errosCnaes, setErrosCnaes] = useState<ErrosCnaes>(SEM_ERROS_CNAES);
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [confirmarSaida, setConfirmarSaida] = useState(false);
  const [novaEmpresa, setNovaEmpresa] = useState(false);
  const baseline = useRef('');
  // Instantâneo no momento da abertura: atualização em tempo real não apaga o que foi digitado.
  const [estabelecimento, setEstabelecimento] = useState(atual);

  const instantaneo = (e: string, c: string, d: DadosFiscais, l: CnaeItem[], j: string) =>
    JSON.stringify({ e, c, d, l, j });

  useEffect(() => {
    if (!aberto) return;
    const estab = atual ?? null;
    setEstabelecimento(estab);
    const e = estab?.empresaId ?? empresaInicialId;
    const c = estab?.cnpj ?? '';
    const d: DadosFiscais = estab
      ? {
          nome: estab.nome,
          inscricaoEstadual: estab.inscricaoEstadual,
          inscricaoMunicipal: estab.inscricaoMunicipal,
          uf: estab.uf,
        }
      : DADOS_VAZIOS;
    const l = estab?.cnaes.map(({ codigo, descricao, tipo }) => ({ codigo, descricao, tipo })) ?? [];
    setEmpresaId(e);
    setCnpj(c);
    setDados(d);
    setCnaes(l);
    setJustificativa('');
    limparTudo();
    setErrosCnaes(SEM_ERROS_CNAES);
    setErroGeral(null);
    setConfirmarSaida(false);
    baseline.current = instantaneo(e, c, d, l, '');
  }, [aberto]);

  const empresaSelecionada = useMemo(() => empresas.find((e) => e.id === empresaId) ?? null, [empresas, empresaId]);
  const editando = Boolean(estabelecimento);
  const sujo = aberto && instantaneo(empresaId, cnpj, dados, cnaes, justificativa) !== baseline.current;

  const tentarFechar = () => {
    if (sujo && !salvando) setConfirmarSaida(true);
    else onFechar();
  };

  /** Validação local, sem gravar. Devolve os erros por campo e os da lista de CNAEs. */
  const validar = () => {
    const locais: Record<string, string> = {};
    if (!empresaId) locais.empresaId = 'Selecione a empresa.';
    if (!dados.nome.trim()) locais.nome = 'Informe o nome do estabelecimento.';
    if (!editando) {
      const normalizado = normalizarCnpj(cnpj);
      if (normalizado.length !== 14) locais.cnpj = 'CNPJ deve ter 14 posições.';
      else if (empresaSelecionada && normalizado.slice(0, 8) !== empresaSelecionada.cnpjRaiz) {
        locais.cnpj = 'A raiz do CNPJ difere da empresa selecionada.';
      } else if (!validarCnpjAlfanumerico(normalizado)) {
        locais.cnpj = 'CNPJ inválido: confira os dígitos verificadores.';
      }
    }
    if (!dados.inscricaoEstadual.trim()) locais.inscricaoEstadual = 'Informe a inscrição estadual.';
    if (!dados.inscricaoMunicipal.trim()) locais.inscricaoMunicipal = 'Informe a inscrição municipal.';
    if (!dados.uf) locais.uf = 'Selecione o estado.';
    if (normalizarJustificativa(justificativa).length < 3) locais.justificativa = 'Informe o motivo (mínimo de 3 caracteres).';
    const cnaesInvalidos = validarCnaes(cnaes);
    setErros(locais);
    setErrosCnaes(cnaesInvalidos);
    return Object.keys(locais).length === 0 && !temErroCnaes(cnaesInvalidos);
  };

  const verificar = () => {
    setErroGeral(null);
    if (validar()) toast.success('Campos conferidos: nenhuma pendência encontrada. Nada foi gravado.');
    else toast.error('Há campos a corrigir antes de salvar.');
  };

  const salvar = async (evento: React.FormEvent) => {
    evento.preventDefault();
    setErroGeral(null);
    if (!validar()) return;
    const motivo = normalizarJustificativa(justificativa);
    const listaCnaes = normalizarListaCnaes(cnaes);
    setSalvando(true);
    try {
      let detalhe: EstabelecimentoDetalhe;
      if (!estabelecimento) {
        detalhe = await fiscalApi.criarEstabelecimento({
          empresaId,
          cnpj: normalizarCnpj(cnpj),
          ...dados,
          cnaes: listaCnaes,
          justificativa: motivo,
        });
      } else {
        const dadosMudaram =
          dados.nome !== estabelecimento.nome ||
          dados.inscricaoEstadual !== estabelecimento.inscricaoEstadual ||
          dados.inscricaoMunicipal !== estabelecimento.inscricaoMunicipal ||
          dados.uf !== estabelecimento.uf;
        const cnaesMudaram = JSON.stringify(listaCnaes) !== JSON.stringify(normalizarListaCnaes(estabelecimento.cnaes));
        if (!dadosMudaram && !cnaesMudaram) {
          setErroGeral('Nenhum campo foi alterado desde a última versão salva.');
          return;
        }
        detalhe = estabelecimento;
        // Cada gravação incrementa a versão: o PUT de CNAEs usa a versão devolvida pelo PATCH.
        if (dadosMudaram) {
          detalhe = await fiscalApi.atualizarEstabelecimento(estabelecimento.id, {
            ...dados,
            versao: detalhe.versao,
            justificativa: motivo,
          });
        }
        if (cnaesMudaram) {
          detalhe = await fiscalApi.substituirCnaes(estabelecimento.id, {
            cnaes: listaCnaes,
            versao: detalhe.versao,
            justificativa: motivo,
          });
        }
      }
      toast.success('Rascunho salvo.');
      onSalvo(detalhe);
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
            <SheetTitle className="text-[16px] font-bold">Empresas, estabelecimentos e regime</SheetTitle>
            <SheetDescription className="text-xs">
              {editando ? 'Edição do rascunho do estabelecimento' : 'Novo estabelecimento (salvo como rascunho)'}
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={(e) => void salvar(e)} className="flex flex-1 flex-col overflow-y-auto" noValidate>
            <div className="flex-1 space-y-4 p-4">
              <div className="grid grid-cols-1 gap-x-3.5 gap-y-2.5 sm:grid-cols-2">
                <FormField label="Empresa" required htmlFor="fiscal-empresa" error={erros.empresaId} className="sm:col-span-2">
                  <div className="flex items-center gap-2">
                    <ComboboxField
                      id="fiscal-empresa"
                      items={itensEmpresa(empresas)}
                      value={empresaId}
                      onChange={(id) => {
                        limpar('empresaId');
                        setEmpresaId(id);
                      }}
                      placeholder="Selecione a empresa"
                      searchPlaceholder="Pesquisar pelo nome"
                      emptyText="Nenhuma empresa cadastrada."
                      disabled={editando}
                    />
                    {!editando && (
                      <Button type="button" variant="secondary" size="sm" onClick={() => setNovaEmpresa(true)}>
                        <Plus /> Nova empresa
                      </Button>
                    )}
                  </div>
                </FormField>

                <FormField label="Razão social" htmlFor="fiscal-razao">
                  <Input id="fiscal-razao" readOnly value={empresaSelecionada?.razaoSocial ?? estabelecimento?.empresa?.razaoSocial ?? ''} />
                </FormField>

                <FormField
                  label="CNPJ"
                  required
                  htmlFor="fiscal-cnpj"
                  error={erros.cnpj}
                  help={editando ? 'O CNPJ não pode ser alterado.' : undefined}
                >
                  <Input
                    id="fiscal-cnpj"
                    maxLength={18}
                    placeholder="00.000.000/0000-00"
                    value={mascararCnpjAlfanumerico(cnpj)}
                    disabled={editando}
                    aria-invalid={'cnpj' in erros || undefined}
                    onChange={(e) => {
                      limpar('cnpj');
                      setCnpj(normalizarCnpj(e.target.value));
                    }}
                  />
                </FormField>
              </div>

              <CamposDadosFiscais
                valores={dados}
                onCampo={(campo, valor) => {
                  limpar(campo);
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

              <FormField label="Motivo da alteração" required htmlFor="fiscal-motivo" error={erros.justificativa}>
                <Textarea
                  id="fiscal-motivo"
                  rows={3}
                  maxLength={500}
                  placeholder="Por que este cadastro precisa ser criado/alterado?"
                  value={justificativa}
                  aria-invalid={'justificativa' in erros || undefined}
                  onChange={(e) => {
                    limpar('justificativa');
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
              <Button type="button" variant="secondary" onClick={verificar}>
                Verificar dados
              </Button>
              <Button type="submit" loading={salvando}>
                Salvar rascunho
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

      <EmpresaDialog
        aberto={novaEmpresa}
        onFechar={() => setNovaEmpresa(false)}
        onSalvo={(empresa) => {
          onEmpresaCriada(empresa);
          setEmpresaId(empresa.id);
          limpar('empresaId');
        }}
        onConflito={onConflito}
      />
    </>
  );
}
