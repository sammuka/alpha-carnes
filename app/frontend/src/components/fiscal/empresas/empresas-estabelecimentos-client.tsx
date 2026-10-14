'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { BadgeProvisorio } from '@/components/ui/badge-provisorio';
import { Button } from '@/components/ui/button';
import { Kpi, KpiStrip } from '@/components/ui/kpi-strip';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { conectarRealtime, type RealtimeMensagem } from '@/lib/realtime';
import {
  FILTROS_PADRAO,
  fiscalApi,
  mascararCnpjAlfanumerico,
  mensagemDoErroFiscal,
  type Contagens,
  type Empresa,
  type EstabelecimentoDetalhe,
  type EstabelecimentoLinha,
  type EventoHistorico,
  type FiltrosGrade,
  type OrdenacaoGrade,
  type RegimeVersao,
} from '@/lib/fiscal-empresas';
import { lerFiltrosSalvos, salvarFiltros, temFiltroAtivo } from '@/lib/fiscal-empresas-filtros';
import { AbasDetalhe, type IdAba } from './abas-detalhe';
import { AcoesProcessoSheet, type ComandoProcesso } from './acoes-processo-sheet';
import { AlteracaoDrawer } from './alteracao-drawer';
import { DecisaoDialog, type DecisaoPendente } from './decisao-dialog';
import {
  decisaoAlteracao,
  decisaoDescartarAlteracao,
  decisaoEstabelecimento,
  decisaoRegime,
  decisaoRemoverEstabelecimento,
  decisaoRemoverRegime,
} from './decisoes-fiscais';
import { EmpresaDialog } from './empresa-dialog';
import { EstabelecimentoDrawer } from './estabelecimento-drawer';
import { FiltrosGradeBarra } from './filtros-grade';
import { GradeEstabelecimentos, type EstadoGrade } from './grade-estabelecimentos';
import { PillSituacao } from './pill-situacao';
import { RegimeDialog } from './regime-dialog';

const EVENTOS_FISCAIS = new Set(['empresa_fiscal_alterada', 'estabelecimento_fiscal_alterado', 'regime_tributario_alterado']);
const SUBTITULO = 'Cadastrar empresa e filial, ativar regime por vigência, aprovar alteração. Acesso típico: gestor fiscal, contador e administrador.';
const ATRASO_BUSCA_MS = 300;

interface Props {
  podeGerenciar: boolean;
  podeAprovar: boolean;
}

interface EstadoDetalhe {
  det: EstabelecimentoDetalhe | null;
  carregando: boolean;
  erro: string | null;
}

export function EmpresasEstabelecimentosClient({ podeGerenciar, podeAprovar }: Props) {
  const [filtros, setFiltros] = useState<FiltrosGrade>(FILTROS_PADRAO);
  const [filtrosProntos, setFiltrosProntos] = useState(false);
  const [busca, setBusca] = useState('');
  const [chaveRecarga, setChaveRecarga] = useState(0);

  const [grade, setGrade] = useState<EstadoGrade>({ dados: null, carregando: true, erro: null });
  const [contagens, setContagens] = useState<Contagens | null>(null);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [opcoesEstabelecimento, setOpcoesEstabelecimento] = useState<EstabelecimentoLinha[]>([]);

  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<EstadoDetalhe>({ det: null, carregando: false, erro: null });
  const [aba, setAba] = useState<IdAba>('ficha');
  const [historico, setHistorico] = useState<{ carregando: boolean; erro: string | null; eventos: EventoHistorico[] }>({
    carregando: false,
    erro: null,
    eventos: [],
  });
  const [perfisProvisorio, setPerfisProvisorio] = useState(true);
  const [exportando, setExportando] = useState(false);

  const [drawerAberto, setDrawerAberto] = useState(false);
  const [editandoCadastro, setEditandoCadastro] = useState(false);
  const [alteracaoAberta, setAlteracaoAberta] = useState(false);
  const [regimeDialog, setRegimeDialog] = useState<{ aberto: boolean; regime: RegimeVersao | null }>({ aberto: false, regime: null });
  const [empresaDialog, setEmpresaDialog] = useState(false);
  const [decisao, setDecisao] = useState<DecisaoPendente | null>(null);
  const [acoesAbertas, setAcoesAbertas] = useState(false);

  // Descarta respostas de requisições que já foram superadas por uma mais nova.
  const reqGrade = useRef(0);
  const reqDetalhe = useRef(0);
  const reqHistorico = useRef(0);

  const recarregar = useCallback(() => setChaveRecarga((c) => c + 1), []);

  // Filtros salvos na sessão: lidos só no cliente, para não divergir da renderização do servidor.
  useEffect(() => {
    const salvos = lerFiltrosSalvos();
    setFiltros(salvos);
    setBusca(salvos.search);
    setFiltrosProntos(true);
  }, []);

  useEffect(() => {
    if (filtrosProntos) salvarFiltros(filtros);
  }, [filtros, filtrosProntos]);

  // Busca com atraso: evita uma requisição a cada tecla.
  useEffect(() => {
    if (!filtrosProntos || busca === filtros.search) return;
    const timer = setTimeout(() => setFiltros((f) => ({ ...f, search: busca, page: 1 })), ATRASO_BUSCA_MS);
    return () => clearTimeout(timer);
  }, [busca, filtros.search, filtrosProntos]);

  useEffect(() => {
    fetch('/api/admin/parametros/chave/fiscal.empresas_perfis_autorizados', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((p: { valorJson?: { provisorio?: boolean } } | null) => {
        // Fail-closed: o selo só some quando o parâmetro diz explicitamente que deixou de ser provisório.
        if (p?.valorJson?.provisorio === false) setPerfisProvisorio(false);
      })
      .catch(() => undefined);
  }, []);

  // Lista, contagens, empresas e opções do filtro de estabelecimento.
  useEffect(() => {
    if (!filtrosProntos) return;
    const req = ++reqGrade.current;
    setGrade((g) => (g.dados ? { ...g, erro: null } : { dados: null, carregando: true, erro: null }));
    void Promise.all([
      fiscalApi.listarEstabelecimentos(filtros),
      fiscalApi.contagens(filtros),
      fiscalApi.listarEmpresas(''),
      fiscalApi.listarEstabelecimentos({ ...FILTROS_PADRAO, empresaId: filtros.empresaId }, 100),
    ])
      .then(([pagina, totais, listaEmpresas, opcoes]) => {
        if (req !== reqGrade.current) return;
        setGrade({ dados: pagina, carregando: false, erro: null });
        setContagens(totais);
        setEmpresas(listaEmpresas.data);
        setOpcoesEstabelecimento(opcoes.data);
      })
      .catch((falha) => {
        if (req !== reqGrade.current) return;
        setGrade((g) => ({ ...g, carregando: false, erro: mensagemDoErroFiscal(falha) }));
      });
  }, [filtros, filtrosProntos, chaveRecarga]);

  // Detalhe do estabelecimento selecionado.
  useEffect(() => {
    if (!selecionadoId) {
      setDetalhe({ det: null, carregando: false, erro: null });
      return;
    }
    const req = ++reqDetalhe.current;
    setDetalhe((d) => (d.det?.id === selecionadoId ? { ...d, erro: null } : { det: null, carregando: true, erro: null }));
    fiscalApi
      .obter(selecionadoId)
      .then((det) => {
        if (req === reqDetalhe.current) setDetalhe({ det, carregando: false, erro: null });
      })
      .catch((falha) => {
        if (req === reqDetalhe.current) setDetalhe((d) => ({ ...d, carregando: false, erro: mensagemDoErroFiscal(falha) }));
      });
  }, [selecionadoId, chaveRecarga]);

  // Histórico: só é buscado quando a aba está aberta.
  useEffect(() => {
    if (!selecionadoId || aba !== 'historico') return;
    const req = ++reqHistorico.current;
    setHistorico((h) => ({ ...h, carregando: h.eventos.length === 0, erro: null }));
    fiscalApi
      .historico(selecionadoId)
      .then((eventos) => {
        if (req === reqHistorico.current) setHistorico({ carregando: false, erro: null, eventos });
      })
      .catch((falha) => {
        if (req === reqHistorico.current) setHistorico({ carregando: false, erro: mensagemDoErroFiscal(falha), eventos: [] });
      });
  }, [selecionadoId, aba, chaveRecarga]);

  // Tempo real: refaz lista e detalhe a cada evento fiscal; ao reconectar, refaz tudo (sem polling).
  useEffect(() => {
    return conectarRealtime({
      rooms: ['fiscal-empresas'],
      onMessage: (msg: RealtimeMensagem) => {
        if (EVENTOS_FISCAIS.has(msg.type)) recarregar();
      },
      onReconnect: recarregar,
    });
  }, [recarregar]);

  const alterarFiltros = (mudanca: Partial<FiltrosGrade>) => setFiltros((f) => ({ ...f, ...mudanca, page: 1 }));

  const trocarEmpresa = (empresaId: string) => alterarFiltros({ empresaId, estabelecimentoId: '' });

  const selecionarEstabelecimentoFiltro = (estabelecimentoId: string) => {
    alterarFiltros({ estabelecimentoId });
    if (estabelecimentoId) setSelecionadoId(estabelecimentoId);
  };

  const ordenar = (coluna: OrdenacaoGrade) =>
    setFiltros((f) => ({ ...f, sort: coluna, dir: f.sort === coluna && f.dir === 'asc' ? 'desc' : 'asc', page: 1 }));

  const limparFiltros = () => {
    setBusca('');
    setFiltros((f) => ({ ...FILTROS_PADRAO, sort: f.sort, dir: f.dir }));
  };

  const exportar = async () => {
    setExportando(true);
    try {
      const arquivo = await fiscalApi.exportar(filtros);
      const url = URL.createObjectURL(arquivo);
      const link = document.createElement('a');
      link.href = url;
      link.download = `empresas-estabelecimentos-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (falha) {
      toast.error(mensagemDoErroFiscal(falha));
    } finally {
      setExportando(false);
    }
  };

  const det = detalhe.det;
  const empresaDaFicha = empresas.find((e) => e.id === det?.empresaId) ?? null;

  const abrirEdicao = () => {
    if (!det) return;
    if (det.situacao === 'APPROVED') setAlteracaoAberta(true);
    else {
      setEditandoCadastro(true);
      setDrawerAberto(true);
    }
  };

  const abrirNovo = () => {
    setEditandoCadastro(false);
    setDrawerAberto(true);
  };

  const decidir = (d: DecisaoPendente, aoConcluir?: () => void) =>
    setDecisao(
      aoConcluir
        ? {
            ...d,
            executar: async (justificativa, confirmarTroca) => {
              const resultado = await d.executar(justificativa, confirmarTroca);
              aoConcluir();
              return resultado;
            },
          }
        : d,
    );

  const comandos: ComandoProcesso[] = (() => {
    const abrirDepois = (acao: () => void) => () => {
      setAcoesAbertas(false);
      acao();
    };
    const sugerirSelecao = !det ? 'Selecione um estabelecimento na grade.' : undefined;
    return [
      {
        titulo: 'Cadastrar empresa e filial',
        indisponivel: podeGerenciar ? undefined : 'Você não tem permissão para cadastrar.',
        abrir: abrirDepois(abrirNovo),
      },
      {
        titulo: 'Ativar regime por vigência',
        indisponivel: !podeGerenciar
          ? 'Você não tem permissão para cadastrar.'
          : (sugerirSelecao ?? (det?.situacao === 'SUSPENDED' ? 'O estabelecimento está suspenso.' : undefined)),
        abrir: abrirDepois(() => setRegimeDialog({ aberto: true, regime: null })),
      },
      {
        titulo: 'Aprovar alteração',
        indisponivel: !podeAprovar
          ? 'Você não tem permissão para aprovar.'
          : (sugerirSelecao ??
            (det?.alteracaoAberta?.situacao === 'REVIEW' ? undefined : 'Não há alteração aguardando revisão.')),
        abrir: abrirDepois(() => {
          if (det?.alteracaoAberta) decidir(decisaoAlteracao(det, det.alteracaoAberta, 'aprovar'));
        }),
      },
    ];
  })();

  return (
    <div>
      <PageHeader
        title="Empresas, estabelecimentos e regime"
        subtitle={SUBTITULO}
        live
        badge={
          perfisProvisorio ? (
            <span title="Perfis autorizados provisórios: somente administrador até decisão.">
              <BadgeProvisorio />
            </span>
          ) : undefined
        }
      >
        <Button type="button" variant="secondary" loading={exportando} onClick={() => void exportar()}>
          Exportar
        </Button>
        {podeGerenciar && (
          <Button type="button" variant="secondary" onClick={abrirNovo}>
            + Novo registro
          </Button>
        )}
        <Button type="button" onClick={() => setAcoesAbertas(true)}>
          Ações do processo ▾
        </Button>
      </PageHeader>

      <KpiStrip>
        <Kpi label="Estabelecimentos" value={contagens?.total ?? '—'} />
        <Kpi label="Em revisão" value={contagens?.emRevisao ?? '—'} hint="Exigem decisão humana" tone="alert" />
        <Kpi label="Suspensos" value={contagens?.suspensos ?? '—'} tone="danger" />
      </KpiStrip>

      <div className="mt-3">
        <FiltrosGradeBarra
          filtros={filtros}
          empresas={empresas.map((e) => ({ id: e.id, label: e.razaoSocial, sublabel: e.cnpjRaiz }))}
          estabelecimentos={opcoesEstabelecimento.map((e) => ({ id: e.id, label: e.nome, sublabel: mascararCnpjAlfanumerico(e.cnpj) }))}
          busca={busca}
          exportando={exportando}
          onBusca={setBusca}
          onEmpresa={trocarEmpresa}
          onEstabelecimento={selecionarEstabelecimentoFiltro}
          onSituacao={(situacao) => alterarFiltros({ situacao })}
          onExportar={() => void exportar()}
        />
        <GradeEstabelecimentos
          estado={grade}
          filtros={filtros}
          selecionadoId={selecionadoId}
          onSelecionar={(id) => {
            setSelecionadoId(id);
            setAba('ficha');
          }}
          onOrdenar={ordenar}
          onPagina={(page) => setFiltros((f) => ({ ...f, page }))}
          onTentarNovamente={recarregar}
          onLimparFiltros={limparFiltros}
          temFiltro={temFiltroAtivo(filtros)}
        />
      </div>

      <section aria-label="Detalhamento" className="mt-4 rounded-lg border border-border bg-card p-4">
        {!selecionadoId && (
          <p className="text-xs text-muted-foreground">Selecione um estabelecimento na grade para ver o detalhamento.</p>
        )}
        {selecionadoId && detalhe.carregando && (
          <div role="status" aria-label="Carregando detalhamento" className="space-y-2">
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}
        {selecionadoId && !detalhe.carregando && detalhe.erro && !det && (
          <div role="alert" className="flex flex-wrap items-center gap-3 text-xs text-destructive">
            {detalhe.erro}
            <Button type="button" size="sm" variant="secondary" onClick={recarregar}>
              Tentar novamente
            </Button>
          </div>
        )}
        {det && (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <h2 className="text-[15px] font-bold">{det.nome}</h2>
              <span className="font-data text-xs text-muted-foreground">{mascararCnpjAlfanumerico(det.cnpj)}</span>
              <PillSituacao situacao={det.situacao} />
            </div>
            <AbasDetalhe
              det={det}
              aba={aba}
              onAba={setAba}
              historico={historico}
              podeGerenciar={podeGerenciar}
              podeAprovar={podeAprovar}
              chaveRecarga={chaveRecarga}
              onEditar={abrirEdicao}
              onEditarEmpresa={() => setEmpresaDialog(true)}
              onTentarNovamenteHistorico={recarregar}
              onEstabelecimento={(acao) =>
                acao === 'remover'
                  ? decidir(decisaoRemoverEstabelecimento(det), () => setSelecionadoId(null))
                  : decidir(decisaoEstabelecimento(det, acao))
              }
              onNovoRegime={() => setRegimeDialog({ aberto: true, regime: null })}
              onEditarRegime={(regime) => setRegimeDialog({ aberto: true, regime })}
              onRegime={(regime, acao) =>
                decidir(acao === 'remover' ? decisaoRemoverRegime(det, regime) : decisaoRegime(det, regime, acao))
              }
              onEditarAlteracao={() => setAlteracaoAberta(true)}
              onAlteracao={(alt, acao) =>
                decidir(acao === 'descartar' ? decisaoDescartarAlteracao(det, alt) : decisaoAlteracao(det, alt, acao))
              }
            />
          </>
        )}
      </section>

      <AcoesProcessoSheet aberto={acoesAbertas} onFechar={() => setAcoesAbertas(false)} comandos={comandos} />

      <EstabelecimentoDrawer
        aberto={drawerAberto}
        onFechar={() => setDrawerAberto(false)}
        empresas={empresas}
        estabelecimento={editandoCadastro ? det : null}
        empresaInicialId={filtros.empresaId}
        onEmpresaCriada={(empresa) => setEmpresas((lista) => [...lista, empresa])}
        onSalvo={(salvo) => {
          setSelecionadoId(salvo.id);
          recarregar();
        }}
        onConflito={recarregar}
      />

      {det && (
        <AlteracaoDrawer
          aberto={alteracaoAberta}
          onFechar={() => setAlteracaoAberta(false)}
          estabelecimento={det}
          onSalvo={recarregar}
          onConflito={recarregar}
        />
      )}

      {det && (
        <RegimeDialog
          aberto={regimeDialog.aberto}
          onFechar={() => setRegimeDialog((r) => ({ ...r, aberto: false }))}
          estabelecimentoId={det.id}
          nomeEstabelecimento={det.nome}
          regime={regimeDialog.regime}
          onSalvo={recarregar}
          onConflito={recarregar}
        />
      )}

      {empresaDaFicha && (
        <EmpresaDialog
          aberto={empresaDialog}
          onFechar={() => setEmpresaDialog(false)}
          empresa={empresaDaFicha}
          onSalvo={recarregar}
          onConflito={recarregar}
        />
      )}

      <DecisaoDialog decisao={decisao} onFechar={() => setDecisao(null)} onConcluido={recarregar} onConflito={recarregar} />
    </div>
  );
}
