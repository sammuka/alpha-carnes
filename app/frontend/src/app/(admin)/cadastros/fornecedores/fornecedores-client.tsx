'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { CadastroTabelaDrawer } from '@/components/cadastros/cadastro-tabela-drawer';
import { mensagemDeErro } from '@/lib/error-message';
import { mascararCpfCnpj, mascararTelefone } from '@/lib/masks';
import {
  rotuloTipoDivergencia,
  tipoDivergenciaEhSlugConhecido,
} from '@/lib/rotulos-tipo-divergencia';

interface Fornecedor {
  id: string;
  codigo: string;
  razaoSocial: string;
  documentoFiscal: string;
  status: 'ativo' | 'inativo';
  observacoes?: string | null;
  contatosJson?: {
    nome?: string;
    telefone?: string;
    email?: string;
    cargo?: string;
  } | null;
  parametrosOperacionaisJson?: {
    romaneioAntecipado?: boolean;
    horarioLimiteRecebimento?: string;
    capacidadeMaximaKg?: number;
    toleranciaDivergenciaPercentual?: number;
    notaQualidade?: 'A' | 'B' | 'C';
  } | null;
}

interface Historico {
  ocorrenciasAno: number;
  ultimaDivergencia: { data: string; tipo: string } | null;
}

function UltimaDivergenciaLinha({ item }: { item: { data: string; tipo: string } }) {
  const dataFmt = new Date(item.data).toLocaleDateString('pt-BR');
  const textoTipo = rotuloTipoDivergencia(item.tipo);

  if (tipoDivergenciaEhSlugConhecido(item.tipo)) {
    return (
      <span className="font-medium text-foreground">
        {dataFmt} · {textoTipo}
      </span>
    );
  }

  return (
    <span className="inline-flex max-w-full items-center gap-1 font-medium text-foreground">
      <span>{dataFmt} ·</span>
      <span className="truncate max-w-[220px]" title={item.tipo}>
        {textoTipo}
      </span>
    </span>
  );
}

function BlocoHistorico({ fornecedorId }: { fornecedorId: string }) {
  const [historico, setHistorico] = useState<Historico | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    setHistorico(null);
    setErro(null);
    void (async () => {
      try {
        const res = await fetch(`/api/cadastros/fornecedores/${fornecedorId}/historico`, { cache: 'no-store' });
        if (!res.ok) {
          setErro(await mensagemDeErro(res));
          return;
        }
        setHistorico((await res.json()) as Historico);
      } catch {
        setErro('Erro de conexão com o servidor.');
      }
    })();
  }, [fornecedorId]);

  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-2 border-b border-border pb-2 text-[13px] font-bold text-foreground">
        <AlertTriangle className="size-4 text-muted-foreground" />
        Histórico &amp; Ocorrências
      </h3>

      {erro ? (
        <p role="alert" className="text-sm text-destructive">
          {erro}
        </p>
      ) : !historico ? (
        <p className="text-sm text-muted-foreground">Carregando histórico…</p>
      ) : (
        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 rounded-md border border-border p-3 text-xs">
          <div>
            <p className="text-muted-foreground">Total de Ocorrências (Ano)</p>
            <p className="font-medium text-destructive">
              {historico.ocorrenciasAno} {historico.ocorrenciasAno === 1 ? 'registro' : 'registros'}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Última Divergência</p>
            {historico.ultimaDivergencia ? (
              <UltimaDivergenciaLinha item={historico.ultimaDivergencia} />
            ) : (
              <p className="font-medium text-foreground">—</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

export function FornecedoresClient({ podeGerenciar }: { podeGerenciar: boolean }) {
  return (
    <CadastroTabelaDrawer<Fornecedor>
      titulo="Fornecedores / Frigoríficos"
      subtitulo="Cadastro de fornecedores e parâmetros operacionais"
      rotuloNovo="Novo Fornecedor"
      rotuloSalvar="Salvar Fornecedor"
      tituloDrawerNovo="Novo Fornecedor"
      tituloDrawerEdicao={(f) => `Fornecedor — ${f.razaoSocial}`}
      placeholderBusca="Buscar por razão social, código ou documento"
      substantivoSingular="fornecedor"
      substantivoPlural="fornecedores"
      endpoint="/api/cadastros/fornecedores"
      larguraDrawer={520}
      podeGerenciar={podeGerenciar}
      mensagemVazia="Nenhum fornecedor encontrado para os filtros aplicados."
      statusDe={(f) => f.status}
      filtros={[
        {
          nome: 'status',
          rotuloTodos: 'Status: Todos',
          opcoes: [
            { valor: 'ativo', rotulo: 'Ativo' },
            { valor: 'inativo', rotulo: 'Inativo' },
          ],
        },
      ]}
      colunas={[
        { chave: 'codigo', titulo: 'Código', tipo: 'mono', render: (f) => f.codigo },
        {
          chave: 'razaoSocial',
          titulo: 'Razão Social',
          render: (f) => <span className="font-semibold text-foreground">{f.razaoSocial}</span>,
        },
        {
          chave: 'documentoFiscal',
          titulo: 'CNPJ/CPF',
          render: (f) => mascararCpfCnpj(f.documentoFiscal),
        },
      ]}
      campos={[
        { nome: 'codigo', rotulo: 'Código', tipo: 'texto', obrigatorio: true, monoespacado: true, maxLength: 50 },
        { nome: 'razaoSocial', rotulo: 'Razão Social', tipo: 'texto', obrigatorio: true, maxLength: 200 },
        {
          nome: 'documentoFiscal',
          rotulo: 'CNPJ/CPF',
          tipo: 'texto',
          obrigatorio: true,
          placeholder: '00.000.000/0000-00',
          mascara: mascararCpfCnpj,
        },
        { nome: 'observacoes', rotulo: 'Observações', tipo: 'textarea' },
        { nome: 'nome', rotulo: 'Nome do contato', tipo: 'texto', maxLength: 200 },
        { nome: 'telefone', rotulo: 'Telefone', tipo: 'texto', mascara: mascararTelefone },
        { nome: 'email', rotulo: 'E-mail', tipo: 'texto' },
        { nome: 'cargo', rotulo: 'Cargo', tipo: 'texto', maxLength: 100 },
        {
          nome: 'romaneioAntecipado',
          rotulo: 'Romaneio antecipado',
          tipo: 'select',
          opcoes: [
            { valor: 'false', rotulo: 'Não' },
            { valor: 'true', rotulo: 'Sim' },
          ],
        },
        {
          nome: 'horarioLimiteRecebimento',
          rotulo: 'Horário Limite Recebimento',
          tipo: 'texto',
          placeholder: 'HH:MM',
          maxLength: 5,
        },
        { nome: 'capacidadeMaximaKg', rotulo: 'Capacidade Max. Caminhão (kg)', tipo: 'numero' },
        { nome: 'toleranciaDivergenciaPercentual', rotulo: 'Tolerância de Divergência (%)', tipo: 'numero' },
        {
          nome: 'notaQualidade',
          rotulo: 'Nota de Qualidade',
          tipo: 'select',
          opcoes: [
            { valor: '', rotulo: '—' },
            { valor: 'A', rotulo: 'A (Excelente)' },
            { valor: 'B', rotulo: 'B (Bom)' },
            { valor: 'C', rotulo: 'C (Regular)' },
          ],
        },
      ]}
      formularioVazio={{
        codigo: '',
        razaoSocial: '',
        documentoFiscal: '',
        observacoes: '',
        nome: '',
        telefone: '',
        email: '',
        cargo: '',
        romaneioAntecipado: 'false',
        horarioLimiteRecebimento: '',
        capacidadeMaximaKg: '',
        toleranciaDivergenciaPercentual: '',
        notaQualidade: '',
        status: 'ativo',
      }}
      paraFormulario={(f) => ({
        codigo: f.codigo,
        razaoSocial: f.razaoSocial,
        documentoFiscal: mascararCpfCnpj(f.documentoFiscal),
        observacoes: f.observacoes ?? '',
        nome: f.contatosJson?.nome ?? '',
        telefone: f.contatosJson?.telefone ?? '',
        email: f.contatosJson?.email ?? '',
        cargo: f.contatosJson?.cargo ?? '',
        romaneioAntecipado: f.parametrosOperacionaisJson?.romaneioAntecipado ? 'true' : 'false',
        horarioLimiteRecebimento: f.parametrosOperacionaisJson?.horarioLimiteRecebimento ?? '',
        capacidadeMaximaKg: f.parametrosOperacionaisJson?.capacidadeMaximaKg != null
          ? String(f.parametrosOperacionaisJson.capacidadeMaximaKg)
          : '',
        toleranciaDivergenciaPercentual: f.parametrosOperacionaisJson?.toleranciaDivergenciaPercentual != null
          ? String(f.parametrosOperacionaisJson.toleranciaDivergenciaPercentual)
          : '',
        notaQualidade: f.parametrosOperacionaisJson?.notaQualidade ?? '',
        status: f.status,
      })}
      paraPayload={(form) => ({
        codigo: (form.codigo ?? '').trim(),
        razaoSocial: (form.razaoSocial ?? '').trim(),
        documentoFiscal: (form.documentoFiscal ?? '').replace(/\D/g, ''),
        observacoes: (form.observacoes ?? '').trim() || undefined,
        status: form.status,
        contatosJson: {
          nome: (form.nome ?? '').trim() || undefined,
          telefone: (form.telefone ?? '').trim() || undefined,
          email: (form.email ?? '').trim() || undefined,
          cargo: (form.cargo ?? '').trim() || undefined,
        },
        parametrosOperacionaisJson: {
          romaneioAntecipado: form.romaneioAntecipado === 'true',
          horarioLimiteRecebimento: (form.horarioLimiteRecebimento ?? '').trim() || undefined,
          capacidadeMaximaKg: form.capacidadeMaximaKg ? Number(form.capacidadeMaximaKg) : undefined,
          toleranciaDivergenciaPercentual: form.toleranciaDivergenciaPercentual
            ? Number(form.toleranciaDivergenciaPercentual)
            : undefined,
          notaQualidade: form.notaQualidade === 'A' || form.notaQualidade === 'B' || form.notaQualidade === 'C'
            ? form.notaQualidade
            : undefined,
        },
      })}
      blocosDrawer={(fornecedor) => (fornecedor ? <BlocoHistorico fornecedorId={fornecedor.id} /> : null)}
    />
  );
}
