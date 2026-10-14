'use client';

import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  formatarDataIso,
  ROTULOS_CRT,
  type AlteracaoAberta,
  type EstabelecimentoDetalhe,
  type RegimeVersao,
} from '@/lib/fiscal-empresas';
import { PillSituacao } from './pill-situacao';
import { SecaoRotulo } from './aba-ficha';

const ETAPAS = ['Preparação', 'Verificação', 'Autorização', 'Conclusão'] as const;

/** Quantas etapas da trilha já foram vencidas, a partir da situação do estabelecimento. */
function etapasConcluidas(situacao: EstabelecimentoDetalhe['situacao']): number {
  switch (situacao) {
    case 'REVIEW':
      return 2;
    case 'SUSPENDED':
      return 3;
    case 'APPROVED':
      return 4;
    default:
      return 1;
  }
}

function nomeRegime(regime: RegimeVersao): string {
  return `${ROTULOS_CRT[regime.crt]} a partir de ${formatarDataIso(regime.vigenciaInicio)}`;
}

export interface AcoesMovimentacao {
  onEstabelecimento: (acao: 'submeter' | 'aprovar' | 'rejeitar' | 'suspender' | 'reativar' | 'remover') => void;
  onNovoRegime: () => void;
  onEditarRegime: (regime: RegimeVersao) => void;
  onRegime: (regime: RegimeVersao, acao: 'submeter' | 'aprovar' | 'rejeitar' | 'remover') => void;
  onEditarAlteracao: () => void;
  onAlteracao: (alteracao: AlteracaoAberta, acao: 'submeter' | 'aprovar' | 'rejeitar' | 'descartar') => void;
}

interface AbaMovimentacoesProps extends AcoesMovimentacao {
  det: EstabelecimentoDetalhe;
  podeGerenciar: boolean;
  podeAprovar: boolean;
}

function BotaoAcao({
  rotulo,
  onClick,
  perigosa,
  principal,
  nome,
}: {
  rotulo: string;
  onClick: () => void;
  perigosa?: boolean;
  principal?: boolean;
  /** Nome acessível quando o rótulo se repete na tela (ex.: ações por linha de regime). */
  nome?: string;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={perigosa ? 'destructiveOutline' : principal ? 'default' : 'secondary'}
      aria-label={nome}
      onClick={onClick}
    >
      {rotulo}
    </Button>
  );
}

export function AbaMovimentacoes({
  det,
  podeGerenciar,
  podeAprovar,
  onEstabelecimento,
  onNovoRegime,
  onEditarRegime,
  onRegime,
  onEditarAlteracao,
  onAlteracao,
}: AbaMovimentacoesProps) {
  const concluidas = etapasConcluidas(det.situacao);
  const alt = det.alteracaoAberta;
  const regimes = [...det.regimes].sort((a, b) => b.vigenciaInicio.localeCompare(a.vigenciaInicio));
  const sit = det.situacao;

  return (
    <div className="space-y-4">
      <div>
        <SecaoRotulo>Etapas e evidências de negócio</SecaoRotulo>
        <ol className="grid grid-cols-4 gap-2" aria-label="Etapas do cadastro">
          {ETAPAS.map((etapa, i) => (
            <li
              key={etapa}
              aria-current={i === concluidas - 1 ? 'step' : undefined}
              className={`border-t-[3px] px-1 py-2 text-[11px] ${i < concluidas ? 'border-primary text-foreground' : 'border-border text-muted-foreground'}`}
            >
              {etapa}
            </li>
          ))}
        </ol>
      </div>

      <div>
        <SecaoRotulo>Ações do estabelecimento</SecaoRotulo>
        <div className="flex flex-wrap gap-2">
          {podeGerenciar && sit === 'DRAFT' && <BotaoAcao principal rotulo="Enviar para revisão" onClick={() => onEstabelecimento('submeter')} />}
          {podeAprovar && sit === 'REVIEW' && <BotaoAcao principal rotulo="Aprovar" onClick={() => onEstabelecimento('aprovar')} />}
          {podeAprovar && sit === 'REVIEW' && <BotaoAcao perigosa rotulo="Rejeitar" onClick={() => onEstabelecimento('rejeitar')} />}
          {podeAprovar && sit === 'APPROVED' && <BotaoAcao perigosa rotulo="Suspender" onClick={() => onEstabelecimento('suspender')} />}
          {podeGerenciar && sit === 'SUSPENDED' && <BotaoAcao rotulo="Reativar para revisão" onClick={() => onEstabelecimento('reativar')} />}
          {podeGerenciar && (sit === 'DRAFT' || sit === 'REJECTED') && (
            <BotaoAcao perigosa rotulo="Remover" onClick={() => onEstabelecimento('remover')} />
          )}
        </div>
      </div>

      {alt && (
        <div>
          <SecaoRotulo>Alteração do cadastro aprovado</SecaoRotulo>
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-border p-3 text-xs">
            <PillSituacao situacao={alt.situacao} rotulo={alt.situacao === 'DRAFT' ? 'Proposta em rascunho' : 'Aguardando revisão'} />
            <span className="flex-1 text-muted-foreground">Proposta para {alt.nome}</span>
            {podeGerenciar && alt.situacao === 'DRAFT' && <BotaoAcao rotulo="Editar proposta" onClick={onEditarAlteracao} />}
            {podeGerenciar && alt.situacao === 'DRAFT' && <BotaoAcao principal rotulo="Submeter proposta" onClick={() => onAlteracao(alt, 'submeter')} />}
            {podeGerenciar && alt.situacao === 'DRAFT' && <BotaoAcao perigosa rotulo="Descartar proposta" onClick={() => onAlteracao(alt, 'descartar')} />}
            {podeAprovar && alt.situacao === 'REVIEW' && <BotaoAcao principal rotulo="Aprovar alteração" onClick={() => onAlteracao(alt, 'aprovar')} />}
            {podeAprovar && alt.situacao === 'REVIEW' && <BotaoAcao perigosa rotulo="Rejeitar alteração" onClick={() => onAlteracao(alt, 'rejeitar')} />}
          </div>
        </div>
      )}

      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <SecaoRotulo>Versões de regime tributário</SecaoRotulo>
          {podeGerenciar && sit !== 'SUSPENDED' && (
            <Button type="button" size="sm" variant="secondary" onClick={onNovoRegime}>
              <Plus /> Nova versão
            </Button>
          )}
        </div>
        <div className="overflow-hidden rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Regime tributário</TableHead>
                <TableHead>Início</TableHead>
                <TableHead>Fim</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {regimes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="h-16 text-center text-xs text-muted-foreground">
                    Nenhuma versão de regime registrada. Use &quot;Nova versão&quot; para ativar um regime por vigência.
                  </TableCell>
                </TableRow>
              )}
              {regimes.map((regime) => (
                <TableRow key={regime.id}>
                  <TableCell>{ROTULOS_CRT[regime.crt]}</TableCell>
                  <TableCell>{formatarDataIso(regime.vigenciaInicio)}</TableCell>
                  <TableCell>{regime.vigenciaFim ? formatarDataIso(regime.vigenciaFim) : 'Sem fim'}</TableCell>
                  <TableCell>
                    <PillSituacao situacao={regime.situacao} />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap justify-end gap-1">
                      {podeGerenciar && (regime.situacao === 'DRAFT' || regime.situacao === 'REJECTED') && (
                        <BotaoAcao rotulo="Editar" nome={`Editar regime ${nomeRegime(regime)}`} onClick={() => onEditarRegime(regime)} />
                      )}
                      {podeGerenciar && regime.situacao === 'DRAFT' && (
                        <BotaoAcao principal rotulo="Submeter" nome={`Submeter regime ${nomeRegime(regime)}`} onClick={() => onRegime(regime, 'submeter')} />
                      )}
                      {podeAprovar && regime.situacao === 'REVIEW' && (
                        <BotaoAcao principal rotulo="Aprovar" nome={`Aprovar regime ${nomeRegime(regime)}`} onClick={() => onRegime(regime, 'aprovar')} />
                      )}
                      {podeAprovar && regime.situacao === 'REVIEW' && (
                        <BotaoAcao perigosa rotulo="Rejeitar" nome={`Rejeitar regime ${nomeRegime(regime)}`} onClick={() => onRegime(regime, 'rejeitar')} />
                      )}
                      {podeGerenciar && (regime.situacao === 'DRAFT' || regime.situacao === 'REJECTED') && (
                        <BotaoAcao perigosa rotulo="Remover" nome={`Remover regime ${nomeRegime(regime)}`} onClick={() => onRegime(regime, 'remover')} />
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
