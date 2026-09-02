'use client';

import { useEffect, useState } from 'react';
import { User } from 'lucide-react';
import { toast } from 'sonner';
import { CadastroTabelaDrawer } from '@/components/cadastros/cadastro-tabela-drawer';
import { mensagemDeErro } from '@/lib/error-message';
import type { Caminhao, Motorista } from '@/lib/frota';
import { mascararTelefone } from '@/lib/masks';

const ROTULO_VINCULO: Record<string, string> = {
  motorista: 'Motorista',
  agregado: 'Agregado',
  chapa: 'Chapa',
};

export function MotoristasClient({ podeGerenciar }: { podeGerenciar: boolean }) {
  const [caminhoes, setCaminhoes] = useState<Caminhao[]>([]);

  useEffect(() => {
    void (async () => {
      const res = await fetch('/api/cadastros/frota-caminhoes?page=1&pageSize=100&status=ativo', { cache: 'no-store' });
      if (!res.ok) {
        toast.error(await mensagemDeErro(res));
        return;
      }
      const dados = (await res.json()) as { data: Caminhao[] };
      setCaminhoes(dados.data);
    })();
  }, []);

  return (
    <CadastroTabelaDrawer<Motorista>
      titulo="Motoristas"
      subtitulo="Motoristas vinculados às cargas e caminhões de expedição."
      rotuloNovo="Novo Motorista"
      rotuloSalvar="Salvar Motorista"
      tituloDrawerNovo="Novo Motorista"
      tituloDrawerEdicao={(m) => `Motorista — ${m.nome}`}
      placeholderBusca="Buscar por nome ou documento"
      substantivoSingular="motorista"
      substantivoPlural="motoristas"
      endpoint="/api/cadastros/frota-motoristas"
      larguraDrawer={520}
      podeGerenciar={podeGerenciar}
      mensagemVazia="Nenhum motorista encontrado para os filtros aplicados."
      statusDe={(m) => m.status}
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
        {
          chave: 'nome',
          titulo: 'Nome',
          render: (m) => (
            <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
              <User className="size-3.5 text-muted-foreground" /> {m.nome}
            </span>
          ),
        },
        {
          chave: 'documento',
          titulo: 'Documento',
          tipo: 'mono',
          render: (m) => m.documento,
        },
        {
          chave: 'telefone',
          titulo: 'Telefone',
          render: (m) => <span className="text-muted-foreground">{m.telefone ?? m.celular ?? '—'}</span>,
        },
        {
          chave: 'tipoVinculo',
          titulo: 'Vínculo',
          render: (m) => (
            <span className="text-muted-foreground">{m.tipoVinculo ? ROTULO_VINCULO[m.tipoVinculo] : '—'}</span>
          ),
        },
        {
          chave: 'validadeHabilitacao',
          titulo: 'CNH válida até',
          render: (m) => <span className="text-muted-foreground">{m.validadeHabilitacao ?? '—'}</span>,
        },
        {
          chave: 'caminhaoPadrao',
          titulo: 'Caminhão padrão',
          render: (m) =>
            m.caminhaoPadraoPlaca ? (
              <span className="font-data text-[11px] text-fg-secondary">
                {m.caminhaoPadraoAtivo === false ? `${m.caminhaoPadraoPlaca} (inativo)` : m.caminhaoPadraoPlaca}
              </span>
            ) : (
              <span className="text-muted-foreground">—</span>
            ),
        },
      ]}
      campos={[
        { nome: 'nome', rotulo: 'Nome', tipo: 'texto', obrigatorio: true, placeholder: 'Ex: Carlos Souza', maxLength: 200 },
        { nome: 'documento', rotulo: 'Documento', tipo: 'texto', obrigatorio: true, placeholder: 'CNH nº', monoespacado: true, maxLength: 100 },
        { nome: 'telefone', rotulo: 'Telefone', tipo: 'texto', placeholder: '(11) 90000-0000', mascara: mascararTelefone },
        { nome: 'celular', rotulo: 'Celular', tipo: 'texto', placeholder: '(11) 90000-0000', mascara: mascararTelefone },
        {
          nome: 'tipoVinculo',
          rotulo: 'Vínculo',
          tipo: 'select',
          placeholder: 'Não informado',
          opcoes: [
            { valor: 'motorista', rotulo: 'Motorista' },
            { valor: 'agregado', rotulo: 'Agregado' },
            { valor: 'chapa', rotulo: 'Chapa' },
          ],
        },
        {
          nome: 'caminhaoPadraoId',
          rotulo: 'Caminhão padrão',
          tipo: 'combobox',
          placeholder: 'Sem caminhão padrão',
          opcoes: caminhoes.map((c) => ({
            valor: c.id,
            rotulo: `${c.placa}${c.descricao ? ` — ${c.descricao}` : ''}${c.status === 'ativo' ? '' : ' (inativo)'}`,
          })),
        },
        { nome: 'rg', rotulo: 'RG', tipo: 'texto', monoespacado: true, maxLength: 30 },
        { nome: 'carteiraProfissional', rotulo: 'Carteira profissional (CTPS)', tipo: 'texto', monoespacado: true, maxLength: 50 },
        { nome: 'nacionalidade', rotulo: 'Nacionalidade', tipo: 'texto', maxLength: 50 },
        { nome: 'carteiraHabilitacao', rotulo: 'CNH (número)', tipo: 'texto', monoespacado: true, maxLength: 30 },
        { nome: 'validadeHabilitacao', rotulo: 'CNH — validade', tipo: 'data' },
        { nome: 'emissaoHabilitacao', rotulo: 'CNH — emissão', tipo: 'data' },
        { nome: 'dataPrimeiraHabilitacao', rotulo: 'CNH — primeira habilitação', tipo: 'data' },
        { nome: 'inicioVinculo', rotulo: 'Início do vínculo', tipo: 'data' },
        { nome: 'contato', rotulo: 'Contato', tipo: 'texto', placeholder: 'Contato adicional', maxLength: 200 },
        { nome: 'email', rotulo: 'E-mail', tipo: 'texto', placeholder: 'nome@dominio.com', maxLength: 200 },
      ]}
      formularioVazio={{
        nome: '', documento: '', telefone: '', caminhaoPadraoId: '', status: 'ativo',
        celular: '', tipoVinculo: '', rg: '', carteiraProfissional: '', nacionalidade: '',
        carteiraHabilitacao: '', validadeHabilitacao: '', emissaoHabilitacao: '',
        dataPrimeiraHabilitacao: '', inicioVinculo: '', contato: '', email: '',
      }}
      paraFormulario={(m) => ({
        nome: m.nome,
        documento: m.documento,
        telefone: m.telefone ?? '',
        caminhaoPadraoId: m.caminhaoPadraoId ?? '',
        status: m.status,
        celular: m.celular ?? '',
        tipoVinculo: m.tipoVinculo ?? '',
        rg: m.rg ?? '',
        carteiraProfissional: m.carteiraProfissional ?? '',
        nacionalidade: m.nacionalidade ?? '',
        carteiraHabilitacao: m.carteiraHabilitacao ?? '',
        validadeHabilitacao: m.validadeHabilitacao ?? '',
        emissaoHabilitacao: m.emissaoHabilitacao ?? '',
        dataPrimeiraHabilitacao: m.dataPrimeiraHabilitacao ?? '',
        inicioVinculo: m.inicioVinculo ?? '',
        contato: m.contato ?? '',
        email: m.email ?? '',
      })}
      paraPayload={(f) => ({
        nome: (f.nome ?? '').trim(),
        documento: (f.documento ?? '').trim(),
        telefone: (f.telefone ?? '').trim() || undefined,
        caminhaoPadraoId: (f.caminhaoPadraoId ?? '').trim() || null,
        status: f.status,
        celular: (f.celular ?? '').trim() || undefined,
        tipoVinculo: (f.tipoVinculo ?? '').trim() || undefined,
        rg: (f.rg ?? '').trim() || undefined,
        carteiraProfissional: (f.carteiraProfissional ?? '').trim() || undefined,
        nacionalidade: (f.nacionalidade ?? '').trim() || undefined,
        carteiraHabilitacao: (f.carteiraHabilitacao ?? '').trim() || undefined,
        validadeHabilitacao: (f.validadeHabilitacao ?? '').trim() || undefined,
        emissaoHabilitacao: (f.emissaoHabilitacao ?? '').trim() || undefined,
        dataPrimeiraHabilitacao: (f.dataPrimeiraHabilitacao ?? '').trim() || undefined,
        inicioVinculo: (f.inicioVinculo ?? '').trim() || undefined,
        contato: (f.contato ?? '').trim() || undefined,
        email: (f.email ?? '').trim() || undefined,
      })}
    />
  );
}
