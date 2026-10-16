'use client';

import type { ReactNode } from 'react';
import { BadgeProvisorio } from '@/components/ui/badge-provisorio';
import { Skeleton } from '@/components/ui/skeleton';
import { ROTULOS_PRE_CONDICAO, rotuloDataHora } from '@/lib/fiscal-enquadramentos';
import { valorDiferenca, ROTULO_NOVO, TEXTO_SEM_DIFERENCAS } from '@/lib/fiscal-comum-ui';
import { SecaoRotulo } from '../empresas/aba-ficha';
import { Aviso, Regra } from '../empresas/abas-informativas';

/** Trilha em leitura de aplicacao.js L17: as duas primeiras etapas aparecem como vencidas; nada é transmitido. */
const ETAPAS = ['Preparação', 'Verificação', 'Autorização', 'Conclusão'] as const;
const ETAPAS_VENCIDAS = 2;

export function AbaMovimentacoes({ titulo = 'Etapas e evidências de negócio', children }: { titulo?: string; children?: ReactNode }) {
  return (
    <div className="grid gap-4 text-sm">
      <div>
        <SecaoRotulo>{titulo}</SecaoRotulo>
        <ol className="grid grid-cols-4 gap-2" aria-label="Etapas do processo">
          {ETAPAS.map((etapa, i) => (
            <li
              key={etapa}
              className={`border-t-[3px] px-1 py-2 text-[11px] ${i < ETAPAS_VENCIDAS ? 'border-primary text-foreground' : 'border-border text-muted-foreground'}`}
            >
              {etapa}
            </li>
          ))}
        </ol>
      </div>
      {children}
    </div>
  );
}

const CAMINHO_APROVACAO: Array<[string, string]> = [
  ['01 · Autor', 'Registra documento, versão e justificativa.'],
  ['02 · Revisor', 'Confere campos, normas, contratos e limites.'],
];

interface RegrasProps {
  /** Regras do catálogo da tela (catalogo.js), uma por linha. */
  regras: string[];
  /** Texto do passo 03 do caminho de aprovação. */
  passoAprovacao: string;
}

export function AbaRegrasFiscal({ regras, passoAprovacao }: RegrasProps) {
  return (
    <div className="text-sm">
      <SecaoRotulo>Regras de negócio documentadas</SecaoRotulo>
      {regras.map((regra) => <Regra key={regra}>{regra}</Regra>)}
      <div className="flex items-center gap-2">
        <SecaoRotulo>Caminho de aprovação</SecaoRotulo>
        <BadgeProvisorio codigo="H-E01-11" />
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {[...CAMINHO_APROVACAO, ['03 · Aprovação', passoAprovacao]].map(([titulo, texto]) => (
          <div key={titulo} className="rounded-md border border-border bg-surface-2 p-3 text-[11px]">
            <b className="mb-1.5 block">{titulo}</b>
            {texto}
          </div>
        ))}
      </div>
      <Aviso>A permissão é conferida no servidor. A visibilidade do menu não substitui o controle de acesso ou de alçada.</Aviso>
    </div>
  );
}

export interface EventoLinhaTempo {
  resumo: string | null;
  criadoEm: string;
  usuarioNome: string | null;
  justificativa: string | null;
  /** Número da versão de negócio (nunca o contador de concorrência). */
  numeroVersao?: number | null;
}

interface HistoricoProps {
  eventos: EventoLinhaTempo[];
  carregando: boolean;
  erro: string | null;
}

/** Linha do tempo do protótipo (renderHistory): título, `quando • quem` e a justificativa. */
export function AbaHistoricoFiscal({ eventos, carregando, erro }: HistoricoProps) {
  const ordenados = [...eventos].sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
  return (
    <div className="text-sm">
      <SecaoRotulo>Histórico e justificativas</SecaoRotulo>
      {carregando && <Skeleton className="h-16" aria-label="Carregando histórico" />}
      {erro && <p role="alert" className="mb-2 text-xs text-destructive">{erro}</p>}
      {!carregando && !erro && ordenados.length === 0 && (
        <p className="text-xs text-muted-foreground">Nenhum evento de histórico.</p>
      )}
      <ol className="grid gap-2.5">
        {ordenados.map((evento, indice) => (
          <li key={`${evento.criadoEm}-${indice}`} className="border-l-2 border-border-strong py-1 pl-3.5 text-[11px]">
            <strong className="block text-xs">{evento.resumo}</strong>
            <small className="text-[10px] text-muted-foreground">
              {rotuloDataHora(evento.criadoEm)} • {evento.usuarioNome || 'Sistema'}
            </small>
            {evento.justificativa && <span className="block">Justificativa: {evento.justificativa}</span>}
            {evento.numeroVersao != null && <span className="block text-muted-foreground">Versão {evento.numeroVersao}</span>}
          </li>
        ))}
      </ol>
      <Aviso>
        A auditoria preserva evento, responsável, objeto e justificativa. Identificadores técnicos nunca são apresentados nesta tela.
      </Aviso>
    </div>
  );
}

export interface LinhaDiferenca {
  campo: string;
  antes: string | null;
  depois: string;
}

/** Diferenças `campo: antes → depois`; datas em dd/MM/aaaa e "antes" ausente rotulado como novo. */
export function ListaDiferencas({ diferencas, semDiferencas = true }: { diferencas: LinhaDiferenca[]; semDiferencas?: boolean }) {
  if (diferencas.length === 0) {
    return semDiferencas ? <p role="status" className="text-xs text-muted-foreground">{TEXTO_SEM_DIFERENCAS}</p> : null;
  }
  return (
    <ul aria-label="Diferenças" className="grid gap-1 text-xs">
      {diferencas.map((item) => (
        <li key={item.campo}>
          <b>{item.campo}</b>:{' '}
          {item.antes == null
            ? <><span className="text-muted-foreground">{ROTULO_NOVO}</span> → {valorDiferenca(item.depois)}</>
            : <>{valorDiferenca(item.antes)} → {valorDiferenca(item.depois)}</>}
        </li>
      ))}
    </ul>
  );
}

export interface ItemPreCondicao {
  codigo: string;
  atendida: boolean;
  provisoria: boolean;
  texto?: string;
}

/** Rótulo legível de cada pré-condição e a pendência que a torna provisória. */
const ROTULOS_PRE_CONDICAO_FISCAL: Record<string, { rotulo: string; pendencia?: string }> = {
  ...ROTULOS_PRE_CONDICAO,
  ENQUADRAMENTO_ATIVO: { rotulo: 'Enquadramento ativo' },
  CAMPOS_TRIBUTARIOS: { rotulo: 'Campos tributários preenchidos' },
  REGRA_APROVADA_VIGENTE: { rotulo: 'Regra aprovada vigente na competência' },
  MEMORIA_SEM_DOCUMENTO: { rotulo: 'Memória sem documento fiscal' },
  REGRA_APROVADA: { rotulo: 'Regra aprovada' },
  AUTOR_IDENTIFICADO: { rotulo: 'Autor identificado' },
  CENARIO_REGRESSAO: { rotulo: 'Cenário de regressão vinculado' },
  PERFIS_ALEM_ADMINISTRADOR: { rotulo: 'Perfis além do administrador definidos', pendencia: 'H-E01-12' },
};

/** Resultado de "Validar pré-condições": carregando, erro e lista com o selo da pendência. */
export function ListaPreCondicoes({ itens, carregando, erro }: { itens: ItemPreCondicao[]; carregando: boolean; erro: string | null }) {
  return (
    <>
      {carregando && <Skeleton className="h-10" aria-label="Validando pré-condições" />}
      {erro && <p role="alert" className="text-xs text-destructive">{erro}</p>}
      {itens.length > 0 && (
        <ul aria-label="Pré-condições" className="grid gap-1.5 text-xs">
          {itens.map((item) => {
            const info = ROTULOS_PRE_CONDICAO_FISCAL[item.codigo];
            const estado = item.provisoria ? 'provisória' : item.atendida ? 'atendida' : 'pendente';
            return (
              <li key={item.codigo} className="flex flex-wrap items-center gap-2">
                <span>{info?.rotulo ?? 'Pré-condição'}: {estado}</span>
                {item.provisoria && info?.pendencia && <BadgeProvisorio codigo={info.pendencia} />}
                {item.texto && <span className="w-full text-muted-foreground">{item.texto}</span>}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
