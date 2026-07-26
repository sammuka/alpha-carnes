'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { SeletorOperacao } from '@/components/gestao/seletor-operacao';
import { QuadroComparativo } from '@/components/gestao/quadro-comparativo';
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
  buscarComparativo,
  decidirAprovacao,
  encerrarOcorrencia,
  listarAprovacoes,
  registrarAndamento,
  ROTULO_STATUS_APROVACAO,
  ROTULO_STATUS_OCORRENCIA,
  ROTULO_TIPO_APROVACAO,
  type AprovacaoOperacional,
  type OcorrenciaLista,
} from '@/lib/aprovacoes';

function AprovacoesConteudo({ permissoes }: { permissoes: string[] }) {
  const searchParams = useSearchParams();
  const operacaoId = searchParams.get('operacaoId');
  const podeDecidir = permissoes.includes('APROVACOES_DECIDIR');

  const [aba, setAba] = useState<'ocorrencias' | 'operacionais'>('ocorrencias');
  const [ocorrencias, setOcorrencias] = useState<OcorrenciaLista[]>([]);
  const [operacionais, setOperacionais] = useState<AprovacaoOperacional[]>([]);
  const [ocorrenciaSel, setOcorrenciaSel] = useState<OcorrenciaLista | null>(null);
  const [aprovacaoSel, setAprovacaoSel] = useState<AprovacaoOperacional | null>(null);
  const [comparativo, setComparativo] = useState<{ itens: Parameters<typeof QuadroComparativo>[0]['itens'] } | null>(null);
  const [semComparativo, setSemComparativo] = useState(false);
  const [andamento, setAndamento] = useState('');
  const [motivo, setMotivo] = useState('');
  const [modalDecisao, setModalDecisao] = useState<'aprovada' | 'rejeitada' | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!operacaoId) return;
    setErro(null);
    try {
      if (aba === 'ocorrencias') {
        const res = await listarAprovacoes<OcorrenciaLista>({ operacaoId, aba: 'ocorrencias' });
        setOcorrencias(res.data);
        if (!ocorrenciaSel && res.data[0]) setOcorrenciaSel(res.data[0]);
      } else {
        const res = await listarAprovacoes<AprovacaoOperacional>({ operacaoId, aba: 'operacionais' });
        setOperacionais(res.data);
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar');
    }
  }, [operacaoId, aba, ocorrenciaSel]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    if (!ocorrenciaSel) {
      setComparativo(null);
      setSemComparativo(false);
      return;
    }
    void buscarComparativo(ocorrenciaSel.id).then((c) => {
      if (!c) {
        setSemComparativo(true);
        setComparativo(null);
      } else {
        setSemComparativo(false);
        setComparativo(c as { itens: Parameters<typeof QuadroComparativo>[0]['itens'] });
      }
    });
  }, [ocorrenciaSel]);

  const enviarAndamento = async () => {
    if (!ocorrenciaSel || !andamento.trim()) return;
    try {
      await registrarAndamento(ocorrenciaSel.id, andamento.trim());
      setAndamento('');
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao registrar andamento');
    }
  };

  const concluir = async () => {
    if (!ocorrenciaSel || !motivo.trim()) return;
    try {
      await encerrarOcorrencia(ocorrenciaSel.id, motivo.trim());
      setMotivo('');
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao encerrar');
    }
  };

  const confirmarDecisao = async () => {
    if (!aprovacaoSel || !modalDecisao || motivo.trim().length < 10) return;
    try {
      await decidirAprovacao(aprovacaoSel.id, modalDecisao, motivo.trim());
      setModalDecisao(null);
      setMotivo('');
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro na decisão');
    }
  };

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Aprovações</h1>
          <p className="text-sm text-muted-foreground">Fila administrativa e aprovações operacionais</p>
        </div>
        <SeletorOperacao />
      </div>

      {erro && (
        <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{erro}</div>
      )}

      <div className="flex gap-2 border-b border-border">
        {(['ocorrencias', 'operacionais'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setAba(t)}
            className={`px-4 py-2 text-sm font-medium ${aba === t ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'}`}
          >
            {t === 'ocorrencias' ? 'Fila Administrativa de Ocorrências' : 'Aprovações Operacionais'}
          </button>
        ))}
      </div>

      {aba === 'ocorrencias' ? (
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="overflow-y-auto rounded-xl border border-border lg:col-span-4">
            {ocorrencias.map((o) => (
              <button key={o.id} type="button" onClick={() => setOcorrenciaSel(o)} className={`w-full border-b px-4 py-3 text-left text-sm last:border-0 hover:bg-muted/30 ${ocorrenciaSel?.id === o.id ? 'bg-muted/40' : ''}`}>
                <p className="font-semibold">{o.fornecedorNome}</p>
                <StatusPill variant="pendente" label={ROTULO_STATUS_OCORRENCIA[o.status] ?? o.status} />
              </button>
            ))}
          </div>
          <div className="space-y-4 lg:col-span-8">
            {ocorrenciaSel && (
              <>
                <div className="rounded-xl border border-border p-4 text-sm">
                  <p><strong>Fornecedor:</strong> {ocorrenciaSel.fornecedorNome}</p>
                  <p><strong>NF:</strong> {ocorrenciaSel.nfChave ?? '—'}</p>
                  <p><strong>Pedido/lote:</strong> {ocorrenciaSel.pedidoLote ?? '—'}</p>
                  <div className="mt-3 space-y-2">
                    <Label htmlFor="andamento">Registrar andamento</Label>
                    <Textarea id="andamento" value={andamento} onChange={(e) => setAndamento(e.target.value)} rows={2} />
                    <Button size="sm" onClick={() => void enviarAndamento()} disabled={!andamento.trim()}>Registrar andamento</Button>
                  </div>
                  <div className="mt-3 space-y-2">
                    <Label htmlFor="desfecho">Concluir tratativa</Label>
                    <Textarea id="desfecho" value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} />
                    <Button size="sm" variant="outline" onClick={() => void concluir()} disabled={!motivo.trim()}>Concluir tratativa</Button>
                  </div>
                </div>
                {semComparativo ? (
                  <p className="text-sm text-muted-foreground">Sem conferência tripla concluída para esta ocorrência</p>
                ) : comparativo ? (
                  <QuadroComparativo itens={comparativo.itens} />
                ) : null}
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {operacionais.map((a) => (
            <div key={a.id} className="rounded-xl border border-border p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">{ROTULO_TIPO_APROVACAO[a.tipo]}</span>
                <StatusPill variant="pendente" label={ROTULO_STATUS_APROVACAO[a.status] ?? a.status} />
              </div>
              <p className="mt-2 text-muted-foreground">{a.descricao}</p>
              <p className="mt-1 text-xs"><strong>Impacto:</strong> {a.impacto}</p>
              {a.status === 'pendente' && podeDecidir && (
                <div className="mt-3 flex gap-2">
                  <Button size="sm" onClick={() => { setAprovacaoSel(a); setModalDecisao('aprovada'); }}>Aprovar solicitação</Button>
                  <Button size="sm" variant="outline" onClick={() => { setAprovacaoSel(a); setModalDecisao('rejeitada'); }}>Rejeitar solicitação</Button>
                </div>
              )}
              {a.decisaoMotivo && (
                <p className="mt-2 text-xs text-muted-foreground">Decisão: {a.decisaoMotivo}</p>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={modalDecisao !== null} onOpenChange={() => setModalDecisao(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{modalDecisao === 'aprovada' ? 'Aprovar solicitação' : 'Rejeitar solicitação'}</DialogTitle>
          </DialogHeader>
          <Label htmlFor="motivo-decisao">Motivo (mín. 10 caracteres)</Label>
          <Textarea id="motivo-decisao" value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} className="mt-1" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalDecisao(null)}>Cancelar</Button>
            <Button onClick={() => void confirmarDecisao()} disabled={motivo.trim().length < 10}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function AprovacoesClient({ permissoes }: { permissoes: string[] }) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Carregando…</p>}>
      <AprovacoesConteudo permissoes={permissoes} />
    </Suspense>
  );
}
