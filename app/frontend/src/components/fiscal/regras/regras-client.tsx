'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { BadgeProvisorio } from '@/components/ui/badge-provisorio';
import { Button } from '@/components/ui/button';
import { Kpi, KpiStrip } from '@/components/ui/kpi-strip';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { conectarRealtime } from '@/lib/realtime';
import {
  CHAVE_LISTA,
  FILTROS_LISTA,
  TEXTO_VAZIO,
  ErroRegra,
  mensagemDeRegra,
  opcoesDe,
  regrasApi,
  type ContagensRegra,
  type CorpoRegra,
  type DetalheRegra,
  type Diferenca,
  type EventoHistorico,
  type FiltrosLista,
  type LinhaRegra,
  type OpcaoCombo,
  type PreCondicao,
} from '@/lib/fiscal-regras';
import { AbasDetalhe } from './abas-detalhe';
import { CodigoTributarioDialog } from './codigo-tributario-dialog';
import { CompararDialog } from './comparar-dialog';
import { RegraDrawer } from './regra-drawer';
import { VersaoDialog } from './versao-dialog';

function lerFiltros(): FiltrosLista {
  if (typeof window === 'undefined') return FILTROS_LISTA;
  try {
    const bruto = window.sessionStorage.getItem(CHAVE_LISTA);
    return bruto ? { ...FILTROS_LISTA, ...JSON.parse(bruto) as Partial<FiltrosLista> } : FILTROS_LISTA;
  } catch {
    return FILTROS_LISTA;
  }
}

export function RegrasClient({ podeGerenciar, podeAprovar }: { podeGerenciar: boolean; podeAprovar: boolean }) {
  const [filtros, setFiltros] = useState<FiltrosLista>(lerFiltros);
  const [linhas, setLinhas] = useState<LinhaRegra[]>([]);
  const [contagens, setContagens] = useState<ContagensRegra | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroLista, setErroLista] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<DetalheRegra | null>(null);
  const [historico, setHistorico] = useState<EventoHistorico[]>([]);
  const [preCondicoes, setPreCondicoes] = useState<PreCondicao[]>([]);
  const [alerta, setAlerta] = useState<string | null>(null);
  const [motivoAcao, setMotivoAcao] = useState('Ação registrada no editor de regras.');
  const [drawer, setDrawer] = useState(false);
  const [editando, setEditando] = useState(false);
  const [enquadramentos, setEnquadramentos] = useState<OpcaoCombo[]>([]);
  const [operacoes, setOperacoes] = useState<OpcaoCombo[]>([]);
  const [cfops, setCfops] = useState<OpcaoCombo[]>([]);
  const [beneficios, setBeneficios] = useState<OpcaoCombo[]>([]);
  const [classificacoes, setClassificacoes] = useState<OpcaoCombo[]>([]);
  const [codigoTipo, setCodigoTipo] = useState<'beneficio' | 'classificacao' | null>(null);
  const [versaoAberta, setVersaoAberta] = useState(false);
  const [erroVersao, setErroVersao] = useState<string | null>(null);
  const [compararAberto, setCompararAberto] = useState(false);
  const [diferencas, setDiferencas] = useState<Diferenca[]>([]);
  const [recarga, setRecarga] = useState(0);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErroLista(null);
    try {
      const [lista, totais] = await Promise.all([regrasApi.listar(filtros), regrasApi.contagens(filtros)]);
      setLinhas(lista.data);
      setContagens(totais);
    } catch (erro) {
      setErroLista(erro instanceof Error ? erro.message : 'Serviço indisponível no momento. Tente novamente.');
    } finally {
      setCarregando(false);
    }
  }, [filtros]);

  useEffect(() => { void carregar(); }, [carregar, recarga]);
  useEffect(() => { window.sessionStorage.setItem(CHAVE_LISTA, JSON.stringify(filtros)); }, [filtros]);
  useEffect(() => {
    void Promise.all([
      opcoesDe('/enquadramentos?pageSize=100', (linha) => String(linha.codigo ?? '')),
      opcoesDe('/api/operacoes?limite=100', (linha) => String(linha.rotulo ?? '')),
      opcoesDe('/cfops?pageSize=100', (linha) => String(linha.codigo ?? '')),
      opcoesDe('/beneficios-fiscais?pageSize=100', (linha) => String(linha.descricao ?? '')),
      opcoesDe('/classificacoes-ibs-cbs?pageSize=100', (linha) => String(linha.descricao ?? '')),
    ]).then(([enqs, ops, codigos, bens, classes]) => {
      setEnquadramentos(enqs);
      setOperacoes(ops);
      setCfops(codigos);
      setBeneficios(bens);
      setClassificacoes(classes);
    }).catch(() => undefined);
  }, [recarga]);
  useEffect(() => conectarRealtime({
    rooms: ['fiscal-regras'],
    onMessage: () => setRecarga((n) => n + 1),
    onReconnect: () => setRecarga((n) => n + 1),
  }), []);

  async function selecionar(id: string) {
    setAlerta(null);
    try {
      const [ficha, eventos] = await Promise.all([regrasApi.obter(id), regrasApi.historico(id)]);
      setDetalhe(ficha);
      setHistorico(eventos);
    } catch (erro) {
      setErroLista(erro instanceof Error ? erro.message : 'Falha na operação.');
    }
  }

  async function salvar(corpo: CorpoRegra): Promise<string | null> {
    try {
      if (editando && detalhe) await regrasApi.atualizar(detalhe.id, { ...corpo, versao: detalhe.versao });
      else await regrasApi.criar(corpo);
      toast.success('Regra tributária salva.');
      setDrawer(false);
      setRecarga((n) => n + 1);
      return null;
    } catch (erro) {
      if (erro instanceof ErroRegra) return mensagemDeRegra(erro);
      return 'Falha na operação.';
    }
  }

  async function acao(nome: 'submeter' | 'aprovar' | 'aposentar') {
    if (!detalhe) return;
    setAlerta(null);
    try {
      const atualizado = await regrasApi[nome](detalhe.id, { versao: detalhe.versao, justificativa: motivoAcao.trim() });
      setDetalhe(atualizado);
      setRecarga((n) => n + 1);
      toast.success('Regra tributária salva.');
    } catch (erro) {
      setAlerta(erro instanceof ErroRegra ? mensagemDeRegra(erro) : 'Falha na operação.');
    }
  }

  async function criarCodigo(corpo: { codigo: string; descricao: string; justificativa: string }) {
    if (codigoTipo === 'beneficio') await regrasApi.criarBeneficio(corpo);
    if (codigoTipo === 'classificacao') await regrasApi.criarClassificacao(corpo);
    setCodigoTipo(null);
    setRecarga((n) => n + 1);
  }

  async function preencherEnquadramento(id: string) {
    if (!id) return;
    try {
      const ficha = await opcoesDe(`/enquadramentos/${id}`, () => '');
      void ficha;
      const detalheEnq = await fetch(`/api/erp/fiscal/enquadramentos/${id}`).then((res) => res.json()) as { operacaoId?: string; cfopId?: string };
      if (detalheEnq.operacaoId || detalheEnq.cfopId) {
        setDetalhe((atual) => atual);
      }
    } catch {
      // o servidor recusa a divergência no POST
    }
  }

  return (
    <div className="grid gap-4">
      <PageHeader
        title="Editor de regras tributárias"
        subtitle="Criar rascunho, adicionar versão, comparar, submeter, aprovar e aposentar. Acesso típico"
        badge={<BadgeProvisorio codigo="H-E01-12" />}
      >
        <Button type="button" variant="secondary" onClick={() => { window.location.href = '/api/erp/fiscal/regras/exportacao'; }}>Exportar</Button>
        {podeGerenciar && <Button type="button" onClick={() => { setEditando(false); setDrawer(true); }}>+ Novo registro</Button>}
        <details>
          <summary className="cursor-pointer text-sm">Ações do processo</summary>
          <div className="mt-2 grid gap-1">
            {podeGerenciar && <Button type="button" variant="secondary" onClick={() => { setEditando(false); setDrawer(true); }}>Criar rascunho</Button>}
            {podeGerenciar && <Button type="button" variant="secondary" disabled={!detalhe || (detalhe.situacao !== 'Aprovada' && detalhe.situacao !== 'Aposentada')} onClick={() => { setErroVersao(null); setVersaoAberta(true); }}>Adicionar versão</Button>}
            <Button type="button" variant="secondary" disabled={!detalhe} onClick={() => { setDiferencas([]); setCompararAberto(true); }}>Comparar</Button>
            {podeGerenciar && <Button type="button" variant="secondary" disabled={!detalhe || detalhe.situacao !== 'Rascunho'} onClick={() => void acao('submeter')}>Submeter</Button>}
            {podeAprovar && <Button type="button" disabled={!detalhe || detalhe.situacao !== 'Submetida'} onClick={() => void acao('aprovar')}>Aprovar</Button>}
            {podeAprovar && <Button type="button" variant="secondary" disabled={!detalhe || detalhe.situacao !== 'Aprovada'} onClick={() => void acao('aposentar')}>Aposentar</Button>}
          </div>
        </details>
      </PageHeader>
      <KpiStrip>
        <Kpi label="Regras" value={contagens?.total ?? 0} />
        <Kpi label="Em rascunho" value={contagens?.rascunhos ?? 0} />
        <Kpi label="Submetidas" value={contagens?.submetidas ?? 0} />
        <Kpi label="Aprovadas" value={contagens?.aprovadas ?? 0} />
      </KpiStrip>
      <div className="flex flex-wrap gap-2">
        <input aria-label="Pesquisar descrição ou referência de negócio" placeholder="Pesquisar descrição ou referência de negócio" className="h-8 rounded-md border px-2" value={filtros.search} onChange={(e) => setFiltros((atual) => ({ ...atual, search: e.target.value, page: 1 }))} />
        <select aria-label="Operação fiscal (CFOP)" className="h-8 rounded-md border px-2" value={filtros.cfopId} onChange={(e) => setFiltros((atual) => ({ ...atual, cfopId: e.target.value, page: 1 }))}>
          <option value="">Operação fiscal (CFOP)</option>
          {cfops.map((opcao) => <option key={opcao.id} value={opcao.id}>{opcao.rotulo}</option>)}
        </select>
        <Button type="button" variant="secondary" onClick={() => { window.location.href = '/api/erp/fiscal/regras/exportacao'; }}>Exportar visão</Button>
      </div>
      {erroLista && (
        <p role="alert" className="text-sm text-destructive">
          {erroLista} <Button type="button" variant="secondary" onClick={() => setRecarga((n) => n + 1)}>Tentar novamente</Button>
        </p>
      )}
      {carregando ? <Skeleton className="h-40 w-full" /> : linhas.length === 0 ? (
        <p>{TEXTO_VAZIO}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Enquadramento fiscal</TableHead>
              <TableHead>Operação fiscal (CFOP)</TableHead>
              <TableHead>Benefício fiscal</TableHead>
              <TableHead>Classificação IBS/CBS</TableHead>
              <TableHead>Operação</TableHead>
              <TableHead>Tratamento ICMS</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {linhas.map((linha) => (
              <TableRow key={linha.id} tabIndex={0} onClick={() => void selecionar(linha.id)} onKeyDown={(e) => { if (e.key === 'Enter') void selecionar(linha.id); }}>
                <TableCell>{linha.enquadramentoFiscal}</TableCell>
                <TableCell>{linha.operacaoFiscal}</TableCell>
                <TableCell>{linha.beneficioFiscal}</TableCell>
                <TableCell>{linha.classificacaoIbsCbs}</TableCell>
                <TableCell>{linha.operacao}</TableCell>
                <TableCell>{linha.tratamentoIcms}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {detalhe && (
        <div className="grid gap-3">
          <label className="grid gap-1 text-xs">Motivo da ação
            <textarea aria-label="Motivo da ação" className="min-h-16 rounded-md border px-2" value={motivoAcao} onChange={(e) => setMotivoAcao(e.target.value)} />
          </label>
          <div className="flex flex-wrap gap-2">
            {podeGerenciar && detalhe.situacao === 'Rascunho' && <Button type="button" onClick={() => { setEditando(true); setDrawer(true); }}>Editar versão</Button>}
          </div>
          {alerta && <p role="alert" className="text-sm text-destructive">{alerta}</p>}
          <AbasDetalhe detalhe={detalhe} historico={historico} preCondicoes={preCondicoes} onValidar={() => { void regrasApi.preCondicoes(detalhe.id).then(setPreCondicoes); }} />
        </div>
      )}
      <RegraDrawer
        aberto={drawer}
        enquadramentos={enquadramentos}
        beneficios={beneficios}
        classificacoes={classificacoes}
        operacoes={operacoes}
        cfops={cfops}
        detalhe={editando ? detalhe : null}
        onFechar={() => setDrawer(false)}
        onSalvar={salvar}
        onNovoCodigo={setCodigoTipo}
        onEnquadramento={(id) => { void preencherEnquadramento(id); }}
      />
      <CodigoTributarioDialog aberto={codigoTipo !== null} tipo={codigoTipo} onFechar={() => setCodigoTipo(null)} onConfirmar={criarCodigo} />
      <VersaoDialog
        aberto={versaoAberta}
        origem={detalhe}
        erro={erroVersao}
        onFechar={() => setVersaoAberta(false)}
        onSalvar={async (corpo) => {
          if (!detalhe) return;
          try {
            await regrasApi.versao(detalhe.id, corpo);
            setVersaoAberta(false);
            setRecarga((n) => n + 1);
            toast.success('Regra tributária salva.');
          } catch (erro) {
            setErroVersao(erro instanceof ErroRegra ? mensagemDeRegra(erro) : 'Falha na operação.');
          }
        }}
      />
      <CompararDialog
        aberto={compararAberto}
        versoes={linhas.filter((linha) => detalhe && linha.id !== detalhe.id)}
        diferencas={diferencas}
        onFechar={() => setCompararAberto(false)}
        onComparar={(com) => {
          if (!detalhe) return;
          void regrasApi.comparar(detalhe.id, com).then((res) => setDiferencas(res.diferencas)).catch((erro: unknown) => {
            setAlerta(erro instanceof ErroRegra ? mensagemDeRegra(erro) : 'Falha na operação.');
          });
        }}
      />
    </div>
  );
}
