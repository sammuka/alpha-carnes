'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  formatarDataHora,
  ROTULOS_OBJETO_HISTORICO,
  ROTULOS_SITUACAO,
  rotuloAcaoHistorico,
  type EventoHistorico,
  type SituacaoEstabelecimento,
} from '@/lib/fiscal-empresas';
import { SecaoRotulo } from './aba-ficha';

export interface EstadoHistorico {
  carregando: boolean;
  erro: string | null;
  eventos: EventoHistorico[];
}

function rotuloSituacao(valor: string | null): string | null {
  return valor ? (ROTULOS_SITUACAO[valor as SituacaoEstabelecimento] ?? null) : null;
}

/** Linha do tempo da auditoria: objeto, ação, quando, quem, justificativa. Nunca mostra identificadores. */
export function AbaHistorico({ estado, onTentarNovamente }: { estado: EstadoHistorico; onTentarNovamente: () => void }) {
  const eventos = [...estado.eventos].sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));

  return (
    <div>
      <SecaoRotulo>Histórico e justificativas</SecaoRotulo>

      {estado.carregando && (
        <div className="space-y-2" aria-label="Carregando histórico" role="status">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-3/4" />
        </div>
      )}

      {!estado.carregando && estado.erro && (
        <div role="alert" className="flex items-center gap-3 text-xs text-destructive">
          {estado.erro}
          <Button type="button" size="sm" variant="secondary" onClick={onTentarNovamente}>
            Tentar novamente
          </Button>
        </div>
      )}

      {!estado.carregando && !estado.erro && eventos.length === 0 && (
        <p className="text-xs text-muted-foreground">Nenhum evento registrado para este estabelecimento.</p>
      )}

      {!estado.carregando && !estado.erro && eventos.length > 0 && (
        <ol className="grid gap-2.5">
          {eventos.map((evento, i) => {
            const anterior = rotuloSituacao(evento.situacaoAnterior);
            const nova = rotuloSituacao(evento.situacaoNova);
            return (
              <li key={`${evento.criadoEm}-${i}`} className="border-l-2 border-border-strong py-1 pl-3.5 text-[11px]">
                <strong className="block text-xs">
                  {ROTULOS_OBJETO_HISTORICO[evento.objeto] ?? 'Cadastro'} — {rotuloAcaoHistorico(evento)}
                </strong>
                <small className="text-[10px] text-muted-foreground">
                  {formatarDataHora(evento.criadoEm)} • {evento.usuarioNome || 'Sistema'}
                </small>
                {nova && (
                  <span className="block text-muted-foreground">
                    Situação: {anterior ? `${anterior} → ` : ''}
                    {nova}
                  </span>
                )}
                {evento.justificativa && <span className="block">Justificativa: {evento.justificativa}</span>}
              </li>
            );
          })}
        </ol>
      )}

      <p className="my-3 rounded-md bg-info-soft p-2.5 text-[11px] text-info-fg">
        A auditoria preserva evento, responsável, objeto e justificativa. Identificadores técnicos nunca são apresentados nesta tela.
      </p>
    </div>
  );
}
