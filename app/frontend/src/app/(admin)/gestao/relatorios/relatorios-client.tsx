'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AlertTriangle, Clock, Eye, FileText, History } from 'lucide-react';
import { BadgeProvisorio } from '@/components/ui/badge-provisorio';
import { SeletorOperacao } from '@/components/gestao/seletor-operacao';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { StatusPill } from '@/components/ui/status-pill';
import {
  buscarVersoes,
  gerarRelatorio,
  listarRelatorios,
  previewRelatorio,
  retificarRelatorio,
  ROTULO_STATUS_SIF,
  ROTULO_TIPO_GERACAO,
  type RelatorioSif,
  type VersaoSif,
} from '@/lib/sif';

function formatDataHora(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function RelatoriosConteudo({ permissoes }: { permissoes: string[] }) {
  const searchParams = useSearchParams();
  const operacaoId = searchParams.get('operacaoId');
  const podeGerar = permissoes.includes('SIF_GERAR');

  const [relatorios, setRelatorios] = useState<RelatorioSif[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [modalRetificar, setModalRetificar] = useState<RelatorioSif | null>(null);
  const [modalHistorico, setModalHistorico] = useState<RelatorioSif | null>(null);
  const [versoes, setVersoes] = useState<VersaoSif[]>([]);
  const [motivo, setMotivo] = useState('');
  const [modalPreview, setModalPreview] = useState<{ relatorio: RelatorioSif; versao: VersaoSif | null } | null>(null);

  const carregar = useCallback(async () => {
    if (!operacaoId) return;
    setErro(null);
    try {
      setRelatorios(await listarRelatorios(operacaoId));
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar relatórios');
    }
  }, [operacaoId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const abrirHistorico = async (r: RelatorioSif) => {
    setModalHistorico(r);
    try {
      setVersoes(await buscarVersoes(r.id));
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar versões');
    }
  };

  const kpis = {
    pendentes: relatorios.filter((r) => r.status === 'pendente_dados').length,
    prontos: relatorios.filter((r) => r.status === 'pronto_para_gerar').length,
    gerados: relatorios.filter((r) => ['gerado', 'retificado'].includes(r.status)).length,
  };

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <h1 className="text-xl font-bold">Relatórios SIF</h1>
            <BadgeProvisorio pendencia="P8" />
          </div>
          <p className="text-sm text-muted-foreground">Área de relatórios ligados ao Serviço de Inspeção Federal.</p>
        </div>
        <SeletorOperacao />
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <p className="text-xs leading-snug text-amber-900">
          Modelos oficiais dos relatórios SIF pendentes de fornecimento pelo cliente. Nomes e campos abaixo são provisórios (demonstração).
        </p>
      </div>

      {erro && (
        <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{erro}</div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: 'Pendentes de dados', value: kpis.pendentes },
          { label: 'Prontos para gerar', value: kpis.prontos },
          { label: 'Gerados/Retificados', value: kpis.gerados },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">{k.label}</p>
            <p className="text-2xl font-bold">{k.value}</p>
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto rounded-xl border border-border bg-card">
        {relatorios.map((r) => (
          <div key={r.id} className="flex flex-wrap items-start gap-4 border-b border-border px-5 py-4 last:border-0">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-bold">{r.nome}</h3>
                <BadgeProvisorio pendencia="P8" />
                <StatusPill variant="pendente" label={ROTULO_STATUS_SIF[r.status]} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{r.codigo} · Responsável: {r.perfilResponsavel}</p>
              {r.pendenciasJson.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {r.pendenciasJson.map((p) => (
                    <li key={p} className="flex items-center gap-1 text-xs text-amber-800">
                      <AlertTriangle className="h-3 w-3" /> {p}
                    </li>
                  ))}
                </ul>
              )}
              {r.ultimaVersao && (
                <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  Última versão: v{r.ultimaVersao.versao} em {formatDataHora(r.ultimaVersao.geradoEm)}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Button
                size="sm"
                disabled={!podeGerar || r.status === 'pendente_dados'}
                title={r.status === 'pendente_dados' ? 'Resolva as pendências de dados antes de gerar' : 'Gerar nova versão'}
                onClick={() => void gerarRelatorio(r.id).then(carregar).catch((e: Error) => setErro(e.message))}
              >
                Gerar
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void previewRelatorio(r.id)
                  .then((v) => setModalPreview({ relatorio: r, versao: v }))
                  .catch((e: Error) => setErro(e.message))}
              >
                <Eye className="mr-1 h-3 w-3" /> Pré-visualizar
              </Button>
              <Button size="sm" variant="outline" onClick={() => setModalRetificar(r)} disabled={!podeGerar || r.versaoAtual < 1}>
                Retificar
              </Button>
              <Button size="sm" variant="outline" onClick={() => void abrirHistorico(r)}>
                <History className="mr-1 h-3 w-3" /> Histórico
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={modalRetificar !== null} onOpenChange={() => setModalRetificar(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Retificar relatório</DialogTitle></DialogHeader>
          <Label htmlFor="motivo-ret">Motivo (mín. 10 caracteres)</Label>
          <Textarea id="motivo-ret" value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} className="mt-1" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalRetificar(null)}>Cancelar</Button>
            <Button
              disabled={motivo.trim().length < 10}
              onClick={() => {
                if (!modalRetificar) return;
                void retificarRelatorio(modalRetificar.id, motivo.trim())
                  .then(() => { setModalRetificar(null); setMotivo(''); return carregar(); })
                  .catch((e: Error) => setErro(e.message));
              }}
            >
              Retificar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={modalHistorico !== null} onOpenChange={() => setModalHistorico(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Histórico de versões</DialogTitle></DialogHeader>
          {versoes.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma versão gerada ainda para este relatório.</p>
          ) : (
            <ul className="space-y-2">
              {versoes.map((v) => (
                <li key={v.id} className="rounded-lg border border-border p-3 text-xs">
                  <div className="flex justify-between">
                    <span className="font-bold">v{v.versao}</span>
                    <span>{ROTULO_TIPO_GERACAO[v.tipoGeracao]}</span>
                  </div>
                  <p className="text-muted-foreground">{formatDataHora(v.geradoEm)} · {v.geradoPorNome ?? '—'}</p>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={modalPreview !== null} onOpenChange={() => setModalPreview(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <DialogTitle>Pré-visualização — {modalPreview?.relatorio.nome}</DialogTitle>
              <BadgeProvisorio pendencia="P8" />
            </div>
          </DialogHeader>
          {modalPreview?.versao === null ? (
            <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
              <FileText className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm font-semibold text-muted-foreground">Pré-visualização disponível após definição do modelo oficial</p>
              <p className="max-w-sm text-xs text-muted-foreground">
                Este relatório está sendo demonstrado com nome e campos provisórios. A pré-visualização real do layout depende dos modelos oficiais do SIF fornecidos pelo cliente.
              </p>
            </div>
          ) : modalPreview?.versao ? (
            <div className="flex flex-col gap-3">
              <p className="max-w-sm text-xs text-muted-foreground">
                Este relatório está sendo demonstrado com nome e campos provisórios. A pré-visualização real do layout depende dos modelos oficiais do SIF fornecidos pelo cliente.
              </p>
              <pre className="max-h-64 overflow-auto rounded bg-muted p-3 text-xs">
                {JSON.stringify(modalPreview.versao.conteudoJson ?? modalPreview.versao, null, 2)}
              </pre>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalPreview(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function RelatoriosClient({ permissoes }: { permissoes: string[] }) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Carregando…</p>}>
      <RelatoriosConteudo permissoes={permissoes} />
    </Suspense>
  );
}
