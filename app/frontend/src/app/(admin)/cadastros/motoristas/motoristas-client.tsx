'use client';

import { useEffect, useState } from 'react';
import { User } from 'lucide-react';
import { toast } from 'sonner';
import { CadastroTabelaDrawer } from '@/components/cadastros/cadastro-tabela-drawer';
import { mensagemDeErro } from '@/lib/error-message';
import type { Caminhao, Motorista } from '@/lib/frota';
import { mascararTelefone } from '@/lib/masks';

export function MotoristasClient({ podeGerenciar }: { podeGerenciar: boolean }) {
  const [caminhoes, setCaminhoes] = useState<Caminhao[]>([]);

  useEffect(() => {
    void (async () => {
      const res = await fetch('/api/cadastros/frota-caminhoes?page=1&pageSize=100', { cache: 'no-store' });
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
      larguraDrawer={460}
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
          render: (m) => <span className="text-muted-foreground">{m.telefone ?? '—'}</span>,
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
        {
          nome: 'caminhaoPadraoId',
          rotulo: 'Caminhão padrão',
          tipo: 'select',
          placeholder: 'Sem caminhão padrão',
          opcoes: caminhoes.map((c) => ({
            valor: c.id,
            rotulo: c.status === 'ativo' ? c.placa : `${c.placa} (inativo)`,
          })),
        },
      ]}
      formularioVazio={{ nome: '', documento: '', telefone: '', caminhaoPadraoId: '', status: 'ativo' }}
      paraFormulario={(m) => ({
        nome: m.nome,
        documento: m.documento,
        telefone: m.telefone ?? '',
        caminhaoPadraoId: m.caminhaoPadraoId ?? '',
        status: m.status,
      })}
      paraPayload={(f) => ({
        nome: (f.nome ?? '').trim(),
        documento: (f.documento ?? '').trim(),
        telefone: (f.telefone ?? '').trim() || undefined,
        caminhaoPadraoId: (f.caminhaoPadraoId ?? '').trim() || null,
        status: f.status,
      })}
    />
  );
}
