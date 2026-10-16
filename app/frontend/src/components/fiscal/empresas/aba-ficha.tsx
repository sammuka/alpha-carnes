'use client';

import { useState } from 'react';
import { CheckCircle2, CircleAlert, ClipboardList, Pencil } from 'lucide-react';
import { BadgeProvisorio } from '@/components/ui/badge-provisorio';
import { Button } from '@/components/ui/button';
import {
  fiscalApi,
  formatarDataIso,
  mascararCnae,
  mascararCnpjAlfanumerico,
  mensagemDoErroFiscal,
  ROTULOS_CRT,
  ROTULOS_TIPO_CNAE,
  type CnaeItem,
  type EstabelecimentoDetalhe,
  type PreCondicao,
  type RegimeVersao,
} from '@/lib/fiscal-empresas';
import { TEXTO_OPCIONAL } from './campos-dados-fiscais';
import { PillSituacao } from './pill-situacao';

export function SecaoRotulo({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-2 mt-1 text-[10px] font-extrabold uppercase tracking-[0.1em] text-primary">{children}</h3>;
}

export function Campo({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`min-w-0 space-y-1 ${className ?? ''}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">{label}</p>
      <div className="min-h-8 rounded-md bg-surface-2 px-2.5 py-1.5 text-[13px] text-foreground">{children}</div>
    </div>
  );
}

function CampoProvisorioLeitura({ label }: { label: string }) {
  return (
    <Campo label={label}>
      <span className="flex flex-wrap items-center gap-1.5 text-muted-foreground">
        Não informado <BadgeProvisorio /> <span className="text-[11px]">{TEXTO_OPCIONAL}</span>
      </span>
    </Campo>
  );
}

/** Regime vigente hoje (aprovado, iniciado e sem fim vencido); a data civil é a do navegador. */
export function regimeVigenteDe(regimes: RegimeVersao[]): RegimeVersao | null {
  const hoje = new Date().toLocaleDateString('en-CA');
  return (
    regimes
      .filter((r) => r.situacao === 'APPROVED' && r.vigenciaInicio <= hoje && (!r.vigenciaFim || r.vigenciaFim >= hoje))
      .sort((a, b) => b.vigenciaInicio.localeCompare(a.vigenciaInicio))[0] ?? null
  );
}

function ListaCnaes({ cnaes }: { cnaes: CnaeItem[] }) {
  if (cnaes.length === 0) return <span className="text-muted-foreground">Nenhuma atividade informada</span>;
  const ordenados = [...cnaes].sort((a, b) => (a.tipo === b.tipo ? a.codigo.localeCompare(b.codigo) : a.tipo === 'PRINCIPAL' ? -1 : 1));
  return (
    <ul className="space-y-0.5">
      {ordenados.map((c) => (
        <li key={`${c.codigo}-${c.tipo}`}>
          <span className="font-data">{mascararCnae(c.codigo)}</span> — {c.descricao}{' '}
          <span className="text-[11px] text-muted-foreground">({ROTULOS_TIPO_CNAE[c.tipo]})</span>
        </li>
      ))}
    </ul>
  );
}

function BlocoAlteracaoPendente({ det }: { det: EstabelecimentoDetalhe }) {
  const alt = det.alteracaoAberta;
  if (!alt) return null;
  const linhas: Array<[string, string, string]> = [
    ['Estabelecimento', det.nome, alt.nome],
    ['Inscrição estadual', det.inscricaoEstadual, alt.inscricaoEstadual],
    ['Inscrição municipal', det.inscricaoMunicipal, alt.inscricaoMunicipal],
    ['Estado', det.uf, alt.uf],
  ];
  return (
    <section aria-label="Alteração aguardando revisão" className="rounded-md border border-warning-soft-border bg-warning-soft p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h3 className="text-[13px] font-bold text-warning-fg">Alteração aguardando revisão</h3>
        <PillSituacao situacao={alt.situacao} rotulo={alt.situacao === 'DRAFT' ? 'Proposta em rascunho' : 'Aguardando revisão'} />
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-muted-foreground">
            <th className="py-1 pr-3 font-semibold">Campo</th>
            <th className="py-1 pr-3 font-semibold">Aprovado</th>
            <th className="py-1 font-semibold">Proposto</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map(([campo, aprovado, proposto]) => (
            <tr key={campo} className={aprovado === proposto ? '' : 'font-semibold text-warning-fg'}>
              <td className="py-1 pr-3">{campo}</td>
              <td className="py-1 pr-3">{aprovado}</td>
              <td className="py-1">{proposto}</td>
            </tr>
          ))}
          <tr className="align-top">
            <td className="py-1 pr-3">Atividades econômicas</td>
            <td className="py-1 pr-3">
              <ListaCnaes cnaes={det.cnaes} />
            </td>
            <td className="py-1">
              <ListaCnaes cnaes={alt.cnaes} />
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}

const ROTULOS_PRE_CONDICAO: Record<string, string> = {
  ESTABELECIMENTO_APROVADO: 'Estabelecimento aprovado',
  REGIME_VIGENTE_APROVADO: 'Regime tributário aprovado e vigente',
  CNAE_PRINCIPAL_INFORMADO: 'Atividade econômica principal informada',
  MUNICIPIO_INFORMADO: 'Município informado',
  CERTIFICADO_VINCULADO: 'Certificado vinculado',
};

function ListaPreCondicoes({ itens }: { itens: PreCondicao[] }) {
  return (
    <ul aria-label="Pré-condições" className="space-y-1 rounded-md border border-border p-3 text-xs">
      {itens.map((item) => {
        const estado = item.atendida ? 'Atendida' : item.provisoria ? 'Provisória' : 'Pendente';
        return (
          <li key={item.codigo} className="flex items-center gap-2">
            {item.atendida ? (
              <CheckCircle2 className="size-3.5 text-success-fg" aria-hidden="true" />
            ) : (
              <CircleAlert className={`size-3.5 ${item.provisoria ? 'text-warning-fg' : 'text-danger-fg'}`} aria-hidden="true" />
            )}
            <span className="flex-1">{ROTULOS_PRE_CONDICAO[item.codigo] ?? 'Condição'}</span>
            <span className="font-semibold">{estado}</span>
            {!item.atendida && item.provisoria && <span className="text-muted-foreground">não bloqueia a aprovação</span>}
          </li>
        );
      })}
    </ul>
  );
}

interface AbaFichaProps {
  det: EstabelecimentoDetalhe;
  podeGerenciar: boolean;
  /** Recarregar do servidor invalida as pré-condições já exibidas. */
  chaveRecarga: number;
  onEditar: () => void;
  onEditarEmpresa: () => void;
  onVerHistorico: () => void;
}

export function AbaFicha({ det, podeGerenciar, chaveRecarga, onEditar, onEditarEmpresa, onVerHistorico }: AbaFichaProps) {
  const vigente = regimeVigenteDe(det.regimes);
  const [pre, setPre] = useState<{ chave: number; itens: PreCondicao[] } | null>(null);
  const [erroPre, setErroPre] = useState<string | null>(null);
  const [validando, setValidando] = useState(false);
  // Aprovado só muda por proposta; com uma proposta já em revisão não se abre outra.
  const propostaEmRevisao = det.situacao === 'APPROVED' && det.alteracaoAberta?.situacao === 'REVIEW';
  const editavel = det.situacao === 'DRAFT' || det.situacao === 'REJECTED' || (det.situacao === 'APPROVED' && !propostaEmRevisao);

  const validar = async () => {
    setValidando(true);
    setErroPre(null);
    try {
      setPre({ chave: chaveRecarga, itens: await fiscalApi.preCondicoes(det.id) });
    } catch (falha) {
      setErroPre(mensagemDoErroFiscal(falha));
    } finally {
      setValidando(false);
    }
  };

  return (
    <div className="space-y-4">
      <BlocoAlteracaoPendente det={det} />

      <div>
        <SecaoRotulo>Informações do registro selecionado</SecaoRotulo>
        <p className="mb-2 text-[11px] font-semibold text-muted-foreground">Dados principais</p>
        <div className="grid grid-cols-1 gap-x-3.5 gap-y-2.5 sm:grid-cols-2">
          <Campo label="Empresa">
            <span className="flex items-center justify-between gap-2">
              {det.empresa?.razaoSocial ?? '—'}
              {podeGerenciar && det.empresa && (
                <Button type="button" variant="ghost" size="iconSm" aria-label="Editar empresa" title="Editar empresa" onClick={onEditarEmpresa}>
                  <Pencil />
                </Button>
              )}
            </span>
          </Campo>
          <Campo label="Razão social">{det.empresa?.razaoSocial ?? '—'}</Campo>
          <Campo label="CNPJ">
            <span className="font-data">{mascararCnpjAlfanumerico(det.cnpj)}</span>
          </Campo>
          <Campo label="Estabelecimento">{det.nome}</Campo>
          <Campo label="Inscrição estadual">{det.inscricaoEstadual}</Campo>
          <Campo label="Inscrição municipal">{det.inscricaoMunicipal}</Campo>
          <Campo label="Estado">{det.uf}</Campo>
          <CampoProvisorioLeitura label="Município" />
          <Campo label="Atividade econômica (CNAE)" className="sm:col-span-2">
            <ListaCnaes cnaes={det.cnaes} />
          </Campo>
          <CampoProvisorioLeitura label="Certificado vinculado" />
          <Campo label="Regime tributário">
            {vigente ? ROTULOS_CRT[vigente.crt] : <span className="text-muted-foreground">Sem regime vigente</span>}
          </Campo>
          <Campo label="Início de vigência">{formatarDataIso(vigente?.vigenciaInicio)}</Campo>
          <Campo label="Fim de vigência">{vigente ? (vigente.vigenciaFim ? formatarDataIso(vigente.vigenciaFim) : 'Sem fim') : '—'}</Campo>
          <Campo label="Situação">
            <PillSituacao situacao={det.situacao} />
          </Campo>
        </div>
      </div>

      <div>
        <SecaoRotulo>Trilha e responsabilização</SecaoRotulo>
        <div className="grid grid-cols-1 gap-x-3.5 gap-y-2.5 sm:grid-cols-3">
          <Campo label="Empresa">{det.empresa?.razaoSocial ?? '—'}</Campo>
          <Campo label="Situação">
            <PillSituacao situacao={det.situacao} />
          </Campo>
          <Campo label="Responsável">{det.responsavel.nome || '—'}</Campo>
        </div>
        {det.justificativaSituacao && (
          <p className="mt-2 text-xs text-muted-foreground">Motivo registrado: {det.justificativaSituacao}</p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          disabled={!podeGerenciar || !editavel}
          title={
            !podeGerenciar
              ? 'Você não tem permissão para editar.'
              : editavel
                ? det.situacao === 'APPROVED'
                  ? 'Cadastro aprovado: abre uma proposta de alteração.'
                  : undefined
                : propostaEmRevisao
                  ? 'Há uma alteração aguardando revisão.'
                  : 'Disponível em rascunho, rejeitado ou aprovado.'
          }
          onClick={onEditar}
        >
          <Pencil /> Editar versão
        </Button>
        <Button type="button" variant="secondary" loading={validando} onClick={() => void validar()}>
          <ClipboardList /> Validar pré-condições
        </Button>
        <Button type="button" variant="secondary" onClick={onVerHistorico}>
          Consultar histórico
        </Button>
      </div>

      {erroPre && (
        <p role="alert" className="text-xs text-destructive">
          {erroPre}
        </p>
      )}
      {pre && pre.chave === chaveRecarga && <ListaPreCondicoes itens={pre.itens} />}
    </div>
  );
}
