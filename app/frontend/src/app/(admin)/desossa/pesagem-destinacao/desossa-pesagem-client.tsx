'use client';

import { useCallback, useEffect, useState } from 'react';
import { Beef, ClipboardList, Printer } from 'lucide-react';
import { SeletorOperacao } from '@/components/gestao/seletor-operacao';
import { BadgeCount } from '@/components/ui/badge-count';
import { BadgeProvisorio } from '@/components/ui/badge-provisorio';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { FilterChip } from '@/components/ui/filter-chip';
import { FormField } from '@/components/ui/form-field';
import { PageHeader } from '@/components/ui/page-header';
import { SelectNative } from '@/components/ui/select-native';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/cn';
import { extrairMensagemErro, mensagemDeErro } from '@/lib/error-message';
import type {
  ChecklistResponse,
  PecaElegivelDesossa,
  RegraTransformacao,
} from '@/lib/desossa';

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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Selecionar TZ para desossa</DialogTitle>
        </DialogHeader>
        <p className="text-[12px] text-muted-foreground">
          Peças encaminhadas pela balança principal. Leia a etiqueta (QR) ou selecione manualmente.
        </p>
        {disponiveis.length === 0 ? (
          <EmptyState title="Nenhum TZ disponível para desossa." />
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {disponiveis.map((t) => (
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
                  <p className="font-data text-[13px] font-bold">{t.etiquetaAtual ?? t.pecaId}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {t.produtoCodigo ?? 'TZ'} · status {t.statusPeca}
                  </p>
                </div>
                <span className="mt-0.5 font-data text-[13px] font-bold">
                  {t.pesoOriginal ? `${t.pesoOriginal} kg` : '—'}
                </span>
              </button>
            ))}
          </div>
        )}
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
    fornecedor: string | null;
  } | null;
}) {
  if (!data) return null;
  const tipoEtq = data.destino === 'pedido' ? 'Parte para Pedido' : 'Parte para Estoque';
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Etiqueta gerada</DialogTitle>
        </DialogHeader>
        <pre className="rounded-md bg-surface-2 p-4 font-data text-[11px] leading-relaxed">
          <span className="block text-[10px] uppercase tracking-widest text-muted-foreground">
            {tipoEtq}
          </span>
          <span className="mt-1 block text-[18px] font-black text-violet-900">{data.produto}</span>
          <span className="block text-violet-700">Origem: desossa</span>
          <span className="mt-3 grid grid-cols-2 gap-y-1.5 border-t border-dashed border-violet-200 pt-3">
            <span className="block">
              <span className="text-muted-foreground">Peso: </span>
              <span className="font-bold">{data.peso} kg</span>
            </span>
            <span className="block">
              <span className="text-muted-foreground">Origem peso: </span>
              <span>{data.origemPeso}</span>
            </span>
            <span className="block">
              <span className="text-muted-foreground">Destino: </span>
              <span className="font-bold">{data.destino}</span>
            </span>
            {data.pedido ? (
              <span className="col-span-2 block">
                <span className="text-muted-foreground">Pedido: </span>
                <span className="font-bold">{data.pedido}</span>
              </span>
            ) : null}
            <span className="col-span-2 block">
              <span className="text-muted-foreground">Peça mãe (TZ): </span>
              <span className="font-bold text-violet-800">{data.tzOrigem}</span>
            </span>
            <span className="block">
              <span className="text-muted-foreground">Lote: </span>
              <span>{data.lote ?? '—'}</span>
            </span>
            <span className="block">
              <span className="text-muted-foreground">NF-e: </span>
              <span>{data.nfe ?? '—'}</span>
            </span>
            <span className="col-span-2 block">
              <span className="text-muted-foreground">Frigorífico: </span>
              <span>{data.fornecedor ?? '—'}</span>
            </span>
          </span>
        </pre>
        <DialogFooter>
          <Button variant="secondary">
            <Printer /> Reimprimir
          </Button>
          <Button onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ModalCancelarAcao({
  open,
  onClose,
  acao,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  acao: {
    produto: string;
    peso: string;
    destino: string;
    hora: string;
    etiqueta: string;
    tzOrigem: string;
  } | null;
  onConfirm: (motivo: string, obs: string) => void;
}) {
  const [motivo, setMotivo] = useState('');
  const [obs, setObs] = useState('');
  if (!acao) return null;
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancelar registro de parte</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-y-1.5 rounded-lg bg-muted/40 p-3 text-[12px]">
          <div>
            <span className="text-muted-foreground">Produto: </span>
            <span className="font-semibold">{acao.produto}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Peso: </span>
            <span className="font-semibold">{acao.peso}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Destino: </span>
            <span className="font-semibold">{acao.destino}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Hora: </span>
            <span className="font-semibold">{acao.hora}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Etiqueta: </span>
            <span className="font-semibold">{acao.etiqueta}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Peça mãe: </span>
            <span className="font-semibold text-violet-800">{acao.tzOrigem}</span>
          </div>
        </div>
        <FormField label="Motivo do cancelamento" required htmlFor="motivo-cancelar-acao-desossa">
          <SelectNative
            id="motivo-cancelar-acao-desossa"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          >
            <option value="">Selecione o motivo</option>
            {[
              'Peso informado incorretamente',
              'Produto registrado incorretamente',
              'Pedido selecionado incorretamente',
              'Destino selecionado incorretamente',
              'Etiqueta impressa incorretamente',
              'Outro',
            ].map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </SelectNative>
        </FormField>
        <FormField label="Observação" htmlFor="obs-cancelar-acao-desossa">
          <Textarea
            id="obs-cancelar-acao-desossa"
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            rows={2}
          />
        </FormField>
        <p className="text-[12px] text-danger-fg">
          O cancelamento estorna a associação/destino da parte, invalida a etiqueta anterior e
          devolve a saída ao checklist da transformação.
        </p>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Voltar
          </Button>
          <Button
            variant="destructive"
            disabled={!motivo}
            onClick={() => {
              onConfirm(motivo, obs);
              onClose();
            }}
          >
            Confirmar Cancelamento
          </Button>
        </DialogFooter>
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
  const [acaoCancelando, setAcaoCancelando] = useState<{
    produto: string;
    peso: string;
    destino: string;
    hora: string;
    etiqueta: string;
    tzOrigem: string;
  } | null>(null);
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
    fornecedor: string | null;
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
      setErro(await mensagemDeErro(res, 'Falha ao carregar TZs'));
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
      setErro(
        extrairMensagemErro(body, (body as { mensagem?: string }).mensagem ?? 'Falha ao carregar checklist'),
      );
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
      setErro(
        extrairMensagemErro(body, (body as { mensagem?: string }).mensagem ?? 'Falha ao vincular regra'),
      );
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
      setErro(await mensagemDeErro(res, 'Falha ao iniciar corte'));
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
    <div className="space-y-3">
      <PageHeader
        title="Pesagem e Destinação"
        subtitle="Escolha o TZ, vincule a regra A/B e registre as saídas da transformação."
      >
        <SeletorOperacao />
      </PageHeader>

      {erro ? <p className="text-sm text-destructive">{erro}</p> : null}

      <Card>
        <CardContent className="space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                TZ origem
              </p>
              <p className="mt-1 font-data text-[15px] font-bold">
                {tz?.etiquetaAtual ?? 'Nenhum TZ selecionado'}
              </p>
            </div>
            <Button type="button" onClick={() => setModalTz(true)}>
              Selecionar TZ
            </Button>
          </div>

          {tz ? (
            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-2.5">
              <span className="mr-1 whitespace-nowrap text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Regra de transformação:
              </span>
              {regras.map((r) => (
                <FilterChip
                  key={r.id}
                  active={regraId === r.id}
                  disabled={regraBloqueada && regraId !== r.id}
                  onClick={() => void vincularRegra(r.id)}
                  title={
                    regraBloqueada && regraId !== r.id
                      ? 'A regra não pode ser alterada após registrar a primeira saída. Cancele os registros para trocar.'
                      : undefined
                  }
                >
                  {r.nome}
                </FilterChip>
              ))}
              <BadgeProvisorio codigo="P12" texto="Regras provisórias — validar com cliente" />
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Empty states — DesossaPesagem.tsx:604-624 (protótipo feature/completude-v1.1) */}
      {!tz ? (
        <EmptyState
          icon={<Beef />}
          title="Selecione ou leia a etiqueta de um TZ encaminhado à desossa"
          description="As peças enviadas pela balança principal aparecem na lista de seleção."
          action={
            <Button type="button" onClick={() => setModalTz(true)}>
              Selecionar TZ
            </Button>
          }
          className="py-16"
        />
      ) : !regraId || !checklist ? (
        <EmptyState
          icon={<ClipboardList />}
          title={`Escolha a regra de transformação para o ${tz.etiquetaAtual ?? tz.pecaId}`}
          description="A regra define as saídas esperadas (quantidade fixa; peso variável capturado aqui). A definição é obrigatória antes de registrar as partes."
          className="py-16"
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Saídas da regra</CardTitle>
            <BadgeCount>
              {registradas}/{checklist.slots.length}
            </BadgeCount>
            <div className="ml-auto flex gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  const slot = checklist.slots.find((s) => s.registrado > 0) ?? checklist.slots[0];
                  if (!slot) return;
                  setAcaoCancelando({
                    produto: slot.produtoNome,
                    peso: '—',
                    destino: 'pedido',
                    hora: new Date().toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    }),
                    etiqueta: `${slot.produtoCodigo}-PEND`,
                    tzOrigem: tz?.etiquetaAtual ?? '—',
                  });
                  setModalCancelar(true);
                }}
              >
                Cancelar ação
              </Button>
              <Button type="button" size="sm" onClick={() => setModalFinalizar(true)}>
                Finalizar
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-1.5">
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
                    fornecedor: tz?.origem ?? null,
                  })
                }
                className={cn(
                  'rounded-md border px-3 py-2 text-left transition-colors duration-100 disabled:cursor-not-allowed disabled:opacity-60',
                  s.registrado > 0
                    ? 'border-success-soft-border bg-success-soft'
                    : 'border-border hover:bg-surface-2',
                )}
              >
                <p className="text-[12px] font-bold">{s.produtoNome}</p>
                <p className="text-[10px] text-muted-foreground">
                  {s.registrado}/{s.esperado} · {s.status}
                </p>
              </button>
            ))}
          </CardContent>
        </Card>
      )}

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
        onClose={() => {
          setModalCancelar(false);
          setAcaoCancelando(null);
        }}
        acao={acaoCancelando}
        onConfirm={() => setErro(null)}
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
                <SelectNative
                  value={tipoDiv}
                  onChange={(e) => setTipoDiv(e.target.value)}
                >
                  <option value="subpeca_faltante">Subpeça faltante</option>
                  <option value="subpeca_excedente">Subpeça excedente</option>
                  <option value="produto_diferente">Produto diferente</option>
                  <option value="perda_informada">Perda informada</option>
                </SelectNative>
                <Textarea
                  value={obsDiv}
                  onChange={(e) => setObsDiv(e.target.value)}
                  placeholder="Observação (ao menos 3 caracteres)"
                  className="min-h-20"
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
                      setErro(await mensagemDeErro(rDiv, 'Erro na divergência'));
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
                      setErro(await mensagemDeErro(rConc, 'Erro ao concluir'));
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
                    setErro(await mensagemDeErro(r, 'Erro ao concluir'));
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
