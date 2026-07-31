'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { BadgeProvisorio } from '@/components/ui/badge-provisorio';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type {
  ChecklistResponse,
  PecaElegivelDesossa,
  RegraTransformacao,
} from '@/lib/desossa';

function BadgeProvisorioLocal({ texto }: { texto?: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-warning-border bg-warning-surface px-2 py-0.5 text-[10px] font-bold text-warning-ink"
      title="P12 / v1.1 §16.15 — validar com cliente"
    >
      <AlertTriangle className="h-2.5 w-2.5" /> {texto ?? 'Provisório'}
    </span>
  );
}

function ModalSelecionarTz({
  open,
  onClose,
  tzs,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  tzs: PecaElegivelDesossa[];
  onSelect: (pecaId: string) => void;
}) {
  const disponiveis = tzs.filter((t) => t.statusPeca === 'para_corte');
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="max-w-md gap-0 bg-card p-0">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle className="text-[15px] font-bold">Selecionar TZ para desossa</DialogTitle>
        </DialogHeader>
        <p className="px-5 pt-3 text-[12px] text-muted-foreground">
          Peças encaminhadas pela balança principal. Leia a etiqueta (QR) ou selecione manualmente.
        </p>
        <div className="flex flex-col divide-y divide-border p-2">
          {disponiveis.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-muted-foreground">
              Nenhum TZ disponível para desossa.
            </p>
          ) : (
            disponiveis.map((t) => (
              <button
                key={t.pecaId}
                type="button"
                onClick={() => {
                  onSelect(t.pecaId);
                  onClose();
                }}
                className="flex items-start justify-between rounded-lg px-3 py-3 text-left hover:bg-muted/40"
              >
                <div>
                  <p className="font-mono text-[13px] font-bold">{t.etiquetaAtual ?? t.pecaId}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {t.produtoCodigo ?? 'TZ'} · status {t.statusPeca}
                  </p>
                </div>
                <span className="mt-0.5 font-mono text-[13px] font-bold">
                  {t.pesoOriginal ? `${t.pesoOriginal} kg` : '—'}
                </span>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ModalEtiquetaParte({
  open,
  onClose,
  data,
}: {
  open: boolean;
  onClose: () => void;
  data: {
    etiqueta: string;
    produto: string;
    peso: string;
    origemPeso: string;
    destino: string;
    pedido: string | null;
    tzOrigem: string;
    lote: string | null;
    nfe: string | null;
  } | null;
}) {
  if (!data) return null;
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="max-w-sm gap-0 bg-card p-0">
        <DialogHeader className="flex flex-row items-center justify-between border-b border-border px-5 py-4">
          <DialogTitle className="text-[15px] font-bold">Etiqueta da parte</DialogTitle>
          <button type="button" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </DialogHeader>
        <div className="space-y-2 p-5 text-[12px]">
          <p>
            <span className="text-muted-foreground">Código:</span> {data.etiqueta}
          </p>
          <p>
            <span className="text-muted-foreground">Produto:</span> {data.produto}
          </p>
          <p>
            <span className="text-muted-foreground">Peso:</span> {data.peso}
          </p>
          <p>
            <span className="text-muted-foreground">Origem peso:</span> {data.origemPeso}
          </p>
          <p>
            <span className="text-muted-foreground">Destino:</span> {data.destino}
          </p>
          <p>
            <span className="text-muted-foreground">Cliente / Pedido:</span> {data.pedido ?? '—'}
          </p>
          <p>
            <span className="text-muted-foreground">Peça mãe (TZ):</span> {data.tzOrigem}
          </p>
          <p>
            <span className="text-muted-foreground">Lote:</span> {data.lote ?? '—'}
          </p>
          <p>
            <span className="text-muted-foreground">NF:</span> {data.nfe ?? '—'}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ModalCancelarAcao({
  open,
  onClose,
  onConfirm,
  titulo,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  titulo: string;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Confirma o cancelamento desta ação? Registros já gravados não são apagados
          automaticamente.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" type="button" onClick={onClose}>
            Voltar
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            Confirmar cancelamento
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function DesossaPesagemClient({ operacaoId }: { operacaoId?: string }) {
  const [tzs, setTzs] = useState<PecaElegivelDesossa[]>([]);
  const [regras, setRegras] = useState<RegraTransformacao[]>([]);
  const [tz, setTz] = useState<PecaElegivelDesossa | null>(null);
  const [transformacaoId, setTransformacaoId] = useState<string | null>(null);
  const [regraId, setRegraId] = useState<string | null>(null);
  const [checklist, setChecklist] = useState<ChecklistResponse | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [modalTz, setModalTz] = useState(false);
  const [modalFinalizar, setModalFinalizar] = useState(false);
  const [modalCancelar, setModalCancelar] = useState(false);
  const [tipoDiv, setTipoDiv] = useState('subpeca_faltante');
  const [obsDiv, setObsDiv] = useState('Divergência registrada na desossa');
  const [etiquetaPreview, setEtiquetaPreview] = useState<{
    etiqueta: string;
    produto: string;
    peso: string;
    origemPeso: string;
    destino: string;
    pedido: string | null;
    tzOrigem: string;
    lote: string | null;
    nfe: string | null;
  } | null>(null);

  const regraBloqueada =
    (checklist?.slots.some((s) => s.registrado > 0) ?? false) && !!regraId;

  const carregarTzs = useCallback(async () => {
    if (!operacaoId) return;
    const res = await fetch(
      `/api/operacao/corte/pecas-elegiveis?operacaoId=${encodeURIComponent(operacaoId)}`,
      { cache: 'no-store' },
    );
    if (!res.ok) {
      setErro((await res.json().catch(() => ({}))).message ?? 'Falha ao carregar TZs');
      return;
    }
    setTzs((await res.json()) as PecaElegivelDesossa[]);
  }, [operacaoId]);

  const carregarRegras = useCallback(async () => {
    const res = await fetch('/api/desossa/regras-transformacao?pageSize=50', { cache: 'no-store' });
    if (!res.ok) return;
    const json = (await res.json()) as { data: RegraTransformacao[] };
    setRegras(json.data.filter((r) => r.status === 'ativo'));
  }, []);

  async function carregarChecklist() {
    if (!transformacaoId) return;
    const res = await fetch(`/api/operacao/corte/${transformacaoId}/checklist`, {
      cache: 'no-store',
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErro(body.message ?? body.mensagem ?? 'Falha ao carregar checklist');
      return;
    }
    setChecklist(await res.json());
  }

  async function vincularRegra(regraTransformacaoId: string) {
    if (!transformacaoId) return;
    const res = await fetch(`/api/operacao/corte/${transformacaoId}/regra`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ regraTransformacaoId }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErro(body.message ?? body.mensagem ?? 'Falha ao vincular regra');
      return;
    }
    setRegraId(regraTransformacaoId);
    await carregarChecklist();
  }

  async function iniciarTz(pecaId: string) {
    const res = await fetch(`/api/operacao/corte/pecas/${pecaId}/iniciar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tipoTransformacao: 'subdivisao',
        motivo: 'necessidade_operacional',
      }),
    });
    if (!res.ok) {
      setErro((await res.json().catch(() => ({}))).message ?? 'Falha ao iniciar corte');
      return;
    }
    const body = (await res.json()) as { id: string };
    setTransformacaoId(body.id);
    setTz(tzs.find((t) => t.pecaId === pecaId) ?? null);
    setRegraId(null);
    setChecklist(null);
  }

  useEffect(() => {
    void carregarTzs();
    void carregarRegras();
  }, [carregarTzs, carregarRegras]);

  useEffect(() => {
    if (transformacaoId) void carregarChecklist();
  }, [transformacaoId]);

  const registradas = checklist?.slots.filter((s) => s.registrado > 0).length ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Desossa
        </p>
        <h1 className="text-3xl font-bold tracking-tight">Pesagem e Destinação</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Escolha o TZ, vincule a regra A/B e registre as saídas da transformação.
        </p>
      </div>

      {erro ? <p className="text-sm text-destructive">{erro}</p> : null}

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              TZ origem
            </p>
            <p className="mt-1 font-mono text-[15px] font-bold">
              {tz?.etiquetaAtual ?? 'Nenhum TZ selecionado'}
            </p>
          </div>
          <Button type="button" onClick={() => setModalTz(true)}>
            Selecionar TZ
          </Button>
        </div>

        {tz ? (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-2.5">
            <span className="mr-1 whitespace-nowrap text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Regra de transformação:
            </span>
            {regras.map((r) => (
              <button
                key={r.id}
                type="button"
                disabled={regraBloqueada && regraId !== r.id}
                onClick={() => void vincularRegra(r.id)}
                title={
                  regraBloqueada && regraId !== r.id
                    ? 'A regra não pode ser alterada após registrar a primeira saída. Cancele os registros para trocar.'
                    : undefined
                }
                className={`h-7 whitespace-nowrap rounded-md border px-3 text-[11px] font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${
                  regraId === r.id
                    ? 'border-violet-800 bg-violet-800 text-white'
                    : 'border-border bg-card text-muted-foreground'
                }`}
              >
                {r.nome}
              </button>
            ))}
            <BadgeProvisorioLocal texto="Regras provisórias — validar com cliente" />
            <BadgeProvisorio pendencia="P12" />
          </div>
        ) : null}
      </div>

      {checklist ? (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <p className="text-[12px] font-bold">Saídas da regra</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                {registradas} de {checklist.slots.length} registradas
              </p>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setModalCancelar(true)}>
                Cancelar ação
              </Button>
              <Button type="button" onClick={() => setModalFinalizar(true)}>
                Finalizar
              </Button>
            </div>
          </div>
          <div className="flex flex-col gap-2 p-3">
            {checklist.slots.map((s) => (
              <button
                key={s.produtoId}
                type="button"
                disabled={s.status === 'completo'}
                onClick={() =>
                  setEtiquetaPreview({
                    etiqueta: `${s.produtoCodigo}-PEND`,
                    produto: s.produtoNome,
                    peso: '—',
                    origemPeso: 'balanca',
                    destino: 'pedido',
                    pedido: null,
                    tzOrigem: tz?.etiquetaAtual ?? '—',
                    lote: tz?.lote ?? null,
                    nfe: null,
                  })
                }
                className="rounded-lg border border-border px-3 py-2 text-left hover:bg-muted/30 disabled:opacity-50"
              >
                <p className="text-[12px] font-bold">{s.produtoNome}</p>
                <p className="text-[10px] text-muted-foreground">
                  {s.registrado}/{s.esperado} · {s.status}
                </p>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <ModalSelecionarTz
        open={modalTz}
        onClose={() => setModalTz(false)}
        tzs={tzs}
        onSelect={(id) => void iniciarTz(id)}
      />
      <ModalEtiquetaParte
        open={!!etiquetaPreview}
        onClose={() => setEtiquetaPreview(null)}
        data={etiquetaPreview}
      />
      <ModalCancelarAcao
        open={modalCancelar}
        onClose={() => setModalCancelar(false)}
        onConfirm={() => setErro(null)}
        titulo="Cancelar ação da desossa"
      />

      {modalFinalizar && transformacaoId ? (
        <Dialog open onOpenChange={setModalFinalizar}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Finalizar transformação</DialogTitle>
            </DialogHeader>
            {checklist?.divergente ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Checklist divergente — registre o tipo antes de concluir.
                </p>
                <select
                  value={tipoDiv}
                  onChange={(e) => setTipoDiv(e.target.value)}
                  className="h-9 w-full rounded-md border border-border px-2 text-sm"
                >
                  <option value="subpeca_faltante">Subpeça faltante</option>
                  <option value="subpeca_excedente">Subpeça excedente</option>
                  <option value="produto_diferente">Produto diferente</option>
                  <option value="perda_informada">Perda informada</option>
                </select>
                <textarea
                  value={obsDiv}
                  onChange={(e) => setObsDiv(e.target.value)}
                  placeholder="Observação (ao menos 3 caracteres)"
                  className="min-h-20 w-full rounded-md border border-border p-2 text-sm"
                />
                <Button
                  onClick={async () => {
                    const rDiv = await fetch(
                      `/api/operacao/corte/${transformacaoId}/divergencia`,
                      {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          tipo: tipoDiv,
                          detalhe: {},
                          observacao: obsDiv,
                        }),
                      },
                    );
                    if (!rDiv.ok) {
                      setErro(
                        (await rDiv.json().catch(() => ({}))).message ?? 'Erro na divergência',
                      );
                      return;
                    }
                    const rConc = await fetch(
                      `/api/operacao/corte/${transformacaoId}/concluir`,
                      {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({}),
                      },
                    );
                    if (!rConc.ok) {
                      setErro((await rConc.json().catch(() => ({}))).message ?? 'Erro ao concluir');
                      return;
                    }
                    setModalFinalizar(false);
                  }}
                >
                  Registrar divergência e concluir
                </Button>
              </div>
            ) : (
              <Button
                onClick={async () => {
                  const r = await fetch(`/api/operacao/corte/${transformacaoId}/concluir`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({}),
                  });
                  if (!r.ok) {
                    setErro((await r.json().catch(() => ({}))).message ?? 'Erro ao concluir');
                    return;
                  }
                  setModalFinalizar(false);
                }}
              >
                Concluir
              </Button>
            )}
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
