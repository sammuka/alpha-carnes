'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { BadgeProvisorio } from '@/components/ui/badge-provisorio';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Kpi, KpiStrip } from '@/components/ui/kpi-strip';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { conectarRealtime } from '@/lib/realtime';
import {
  CHAVE_LISTA,
  FILTROS_LISTA,
  TEXTO_VAZIO,
  ErroHomologacao,
  homologacoesApi,
  mensagemDeHomologacao,
  type Contagens,
  type CorpoAbertura,
  type DetalheHomologacao,
  type Diferenca,
  type EventoHistorico,
  type FiltrosLista,
  type LinhaHomologacao,
  type PreCondicao,
} from '@/lib/fiscal-homologacoes';
import { AbasDetalhe } from './abas-detalhe';
import { CenarioDialog } from './cenario-dialog';
import { DecisaoDialog } from './decisao-dialog';
import { DiffDialog } from './diff-dialog';
import { useRetornoFoco } from '../empresas/use-retorno-foco';
import { HomologacaoDrawer } from './homologacao-drawer';

function lerFiltros(): FiltrosLista {
  if (typeof window === 'undefined') return FILTROS_LISTA;
  try {
    const bruto = window.sessionStorage.getItem(CHAVE_LISTA);
    return bruto ? { ...FILTROS_LISTA, ...JSON.parse(bruto) as Partial<FiltrosLista> } : FILTROS_LISTA;
  } catch {
    return FILTROS_LISTA;
  }
}

export function HomologacoesClient({ podeGerenciar, podeAprovar }: { podeGerenciar: boolean; podeAprovar: boolean }) {
  const [filtros, setFiltros] = useState<FiltrosLista>(lerFiltros);
  const [linhas, setLinhas] = useState<LinhaHomologacao[]>([]);
  const [contagens, setContagens] = useState<Contagens | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroLista, setErroLista] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<DetalheHomologacao | null>(null);
  const [historico, setHistorico] = useState<EventoHistorico[]>([]);
  const [preCondicoes, setPreCondicoes] = useState<PreCondicao[]>([]);
  const [alerta, setAlerta] = useState<string | null>(null);
  const [errosCampo, setErrosCampo] = useState<Record<string, string>>({});
  const [drawer, setDrawer] = useState(false);
  const [acoes, setAcoes] = useState(false);
  const [diffAberto, setDiffAberto] = useState(false);
  const [diferencas, setDiferencas] = useState<Diferenca[]>([]);
  const [decisaoAberta, setDecisaoAberta] = useState(false);
  const [publicarAberto, setPublicarAberto] = useState(false);
  const [justificativaPublicacao, setJustificativaPublicacao] = useState('Publicação com a memória desta versão.');
  const [cenarioAberto, setCenarioAberto] = useState(false);
  const [recarga, setRecarga] = useState(0);
  const retornoPublicar = useRetornoFoco(publicarAberto);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErroLista(null);
    try {
      const [lista, totais] = await Promise.all([
        homologacoesApi.listar(filtros),
        homologacoesApi.contagens(filtros),
      ]);
      setLinhas(lista.data);
      setContagens(totais);
    } catch (erro) {
      setErroLista(erro instanceof Error ? mensagemDeHomologacao(erro instanceof ErroHomologacao ? erro : new ErroHomologacao(erro.message, 500, null, {})) : 'Serviço indisponível no momento. Tente novamente.');
    } finally {
      setCarregando(false);
    }
  }, [filtros]);

  useEffect(() => { void carregar(); }, [carregar, recarga]);
  useEffect(() => { window.sessionStorage.setItem(CHAVE_LISTA, JSON.stringify(filtros)); }, [filtros]);
  // O evento recarrega a lista e a ficha aberta (o handler lê a versão mais recente pela ref).
  const aoEvento = useRef<() => void>(() => undefined);
  useEffect(() => {
    aoEvento.current = () => {
      setRecarga((n) => n + 1);
      if (detalhe) void recarregarFicha(detalhe.id);
    };
  });
  useEffect(() => conectarRealtime({
    rooms: ['fiscal-homologacoes'],
    onMessage: () => aoEvento.current(),
    onReconnect: () => aoEvento.current(),
  }), []);

  async function recarregarFicha(id: string) {
    try {
      const [ficha, eventos] = await Promise.all([homologacoesApi.obter(id), homologacoesApi.historico(id)]);
      setDetalhe((atual) => (atual?.id === id ? ficha : atual));
      setHistorico(eventos);
    } catch (erro) {
      registrar(erro);
    }
  }

  function registrar(erro: unknown): string {
    if (!(erro instanceof ErroHomologacao)) return 'Falha na operação.';
    const texto = mensagemDeHomologacao(erro);
    setErrosCampo(erro.porCampo);
    setAlerta(texto);
    return texto;
  }

  async function selecionar(id: string) {
    setAlerta(null);
    try {
      const [ficha, eventos] = await Promise.all([homologacoesApi.obter(id), homologacoesApi.historico(id)]);
      setDetalhe(ficha);
      setHistorico(eventos);
    } catch (erro) {
      registrar(erro);
    }
  }

  async function salvar(corpo: CorpoAbertura) {
    try {
      const criada = await homologacoesApi.criar(corpo);
      toast.success('Revisão aberta.');
      setDrawer(false);
      setErrosCampo({});
      setRecarga((n) => n + 1);
      await selecionar(criada.id);
    } catch (erro) {
      registrar(erro);
    }
  }

  async function abrirDiff() {
    if (!detalhe) return;
    try {
      const diff = await homologacoesApi.diff(detalhe.id);
      setDiferencas(diff.diferencas ?? []);
      setDiffAberto(true);
    } catch (erro) {
      registrar(erro);
    }
  }

  async function decidir(acao: 'aprovar' | 'rejeitar', justificativa: string) {
    if (!detalhe) return;
    try {
      const atualizado = acao === 'aprovar'
        ? await homologacoesApi.aprovar(detalhe.id, { versao: detalhe.versao, justificativa })
        : await homologacoesApi.rejeitar(detalhe.id, { versao: detalhe.versao, justificativa });
      setDetalhe(atualizado);
      setDecisaoAberta(false);
      setAlerta(null);
      setRecarga((n) => n + 1);
    } catch (erro) {
      registrar(erro);
    }
  }

  async function publicar() {
    if (!detalhe) return;
    try {
      const atualizado = await homologacoesApi.publicar(detalhe.id, { versao: detalhe.versao, justificativa: justificativaPublicacao });
      setDetalhe(atualizado);
      setPublicarAberto(false);
      setAlerta(null);
      toast.success('Homologação publicada.');
      const eventos = await homologacoesApi.historico(detalhe.id);
      setHistorico(eventos);
      setRecarga((n) => n + 1);
    } catch (erro) {
      registrar(erro);
    }
  }

  async function vincular(simulacaoId: string, justificativa: string) {
    if (!detalhe) return;
    try {
      const atualizado = await homologacoesApi.vincular(detalhe.id, { simulacaoId, versao: detalhe.versao, justificativa });
      setDetalhe(atualizado);
      setCenarioAberto(false);
      setAlerta(null);
      setRecarga((n) => n + 1);
    } catch (erro) {
      registrar(erro);
    }
  }

  return (
    <div className="grid gap-4">
      <PageHeader
        title="Painel de alterações e homologação de regras"
        subtitle="revisar diff, aprovar/rejeitar, publicar e auditar."
        badge={(
          <span className="inline-flex items-center gap-2">
            Acesso típico
            <BadgeProvisorio codigo="H-E01-12" />
          </span>
        )}
      >
        <Button type="button" variant="secondary" onClick={() => { window.location.href = '/api/erp/fiscal/homologacoes/exportacao'; }}>Exportar</Button>
        {podeGerenciar && <Button type="button" onClick={() => setDrawer(true)}>+ Novo registro</Button>}
        <Button type="button" variant="secondary" aria-expanded={acoes} onClick={() => setAcoes((atual) => !atual)}>Ações do processo ▾</Button>
      </PageHeader>
      {acoes && (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" disabled={!detalhe} onClick={() => void abrirDiff()}>Revisar diff</Button>
          {podeAprovar && <Button type="button" variant="secondary" disabled={!detalhe} onClick={() => setDecisaoAberta(true)}>Aprovar/rejeitar</Button>}
          {podeAprovar && <Button type="button" variant="secondary" disabled={!detalhe} onClick={() => setPublicarAberto(true)}>Publicar e auditar</Button>}
        </div>
      )}
      <KpiStrip>
        <Kpi label="Em revisão" value={contagens?.emRevisao ?? 0} />
        <Kpi label="Aprovadas" value={contagens?.aprovadas ?? 0} />
        <Kpi label="Rejeitadas" value={contagens?.rejeitadas ?? 0} />
        <Kpi label="Publicadas" value={contagens?.publicadas ?? 0} />
      </KpiStrip>
      <div className="flex flex-wrap gap-2">
        <input aria-label="Pesquisar descrição ou referência de negócio" placeholder="Pesquisar descrição ou referência de negócio" className="h-8 rounded-md border px-2" value={filtros.search} onChange={(e) => setFiltros((atual) => ({ ...atual, search: e.target.value, page: '1' }))} />
        <select aria-label="Situação" className="h-8 rounded-md border px-2" value={filtros.situacao} onChange={(e) => setFiltros((atual) => ({ ...atual, situacao: e.target.value, page: '1' }))}>
          <option value="">Situação</option>
          <option value="EM_REVISAO">Em revisão</option>
          <option value="APROVADA">Aprovada</option>
          <option value="REJEITADA">Rejeitada</option>
          <option value="PUBLICADA">Publicada</option>
        </select>
        <Button type="button" variant="secondary" onClick={() => { window.location.href = '/api/erp/fiscal/homologacoes/exportacao'; }}>Exportar visão</Button>
      </div>
      {erroLista && (
        <p role="alert" className="text-sm text-destructive">
          {erroLista} <Button type="button" variant="secondary" onClick={() => setRecarga((n) => n + 1)}>Tentar novamente</Button>
        </p>
      )}
      {carregando ? <Skeleton className="h-40 w-full" /> : linhas.length === 0 ? (
        <EmptyState title={TEXTO_VAZIO} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Enquadramento fiscal</TableHead>
              <TableHead>Início de vigência</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead>Usuário</TableHead>
              <TableHead>Responsável pela aprovação</TableHead>
              <TableHead>Descrição</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {linhas.map((linha) => (
              <TableRow key={linha.id} tabIndex={0} onClick={() => void selecionar(linha.id)} onKeyDown={(e) => { if (e.key === 'Enter') void selecionar(linha.id); }}>
                <TableCell>{linha.enquadramento}</TableCell>
                <TableCell>{linha.vigenciaInicio}</TableCell>
                <TableCell>{linha.situacao}</TableCell>
                <TableCell>{linha.usuario}</TableCell>
                <TableCell>{linha.aprovador}</TableCell>
                <TableCell>{linha.descricao}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {alerta && <p role="alert" className="text-sm text-destructive">{alerta}</p>}
      {detalhe && (
        <AbasDetalhe
          detalhe={detalhe}
          historico={historico}
          preCondicoes={preCondicoes}
          podeGerenciar={podeGerenciar}
          onCenarios={() => setCenarioAberto(true)}
          onValidar={() => { void homologacoesApi.preCondicoes(detalhe.id).then(setPreCondicoes).catch(registrar); }}
          onHistorico={() => { void homologacoesApi.historico(detalhe.id).then(setHistorico).catch(registrar); }}
        />
      )}
      <HomologacaoDrawer aberto={drawer} erro={alerta} errosCampo={errosCampo} onFechar={() => setDrawer(false)} onSalvar={(corpo) => void salvar(corpo)} />
      <DiffDialog aberto={diffAberto} diferencas={diferencas} onFechar={() => setDiffAberto(false)} />
      <DecisaoDialog aberto={decisaoAberta} erro={alerta} onFechar={() => setDecisaoAberta(false)} onAprovar={(justificativa) => void decidir('aprovar', justificativa)} onRejeitar={(justificativa) => void decidir('rejeitar', justificativa)} />
      <CenarioDialog aberto={cenarioAberto} enquadramento={detalhe?.enquadramento ?? ''} erro={alerta} onFechar={() => setCenarioAberto(false)} onVincular={(id, justificativa) => void vincular(id, justificativa)} />
      <Dialog open={publicarAberto} onOpenChange={(aberto) => { if (!aberto) setPublicarAberto(false); }}>
        <DialogContent onCloseAutoFocus={retornoPublicar}>
          <DialogHeader>
            <DialogTitle>Publicar e auditar</DialogTitle>
          </DialogHeader>
          <label className="grid gap-1 text-xs" htmlFor="justificativa-publicacao">
            Justificativa auditável
            <textarea id="justificativa-publicacao" className="min-h-20 rounded-md border px-2 py-1" value={justificativaPublicacao} onChange={(e) => setJustificativaPublicacao(e.target.value)} />
          </label>
          {alerta && <p role="alert" className="text-sm text-destructive">{alerta}</p>}
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => void publicar()}>Publicar</Button>
            <Button type="button" variant="secondary" onClick={() => setPublicarAberto(false)}>Cancelar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
