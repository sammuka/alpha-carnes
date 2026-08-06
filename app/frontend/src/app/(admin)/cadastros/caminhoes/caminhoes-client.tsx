'use client';

import { useEffect, useState } from 'react';
import { Truck } from 'lucide-react';
import { toast } from 'sonner';
import { CadastroTabelaDrawer } from '@/components/cadastros/cadastro-tabela-drawer';
import { mensagemDeErro } from '@/lib/error-message';
import type { Caminhao } from '@/lib/frota';

interface RotaOpcao {
  id: string;
  nome: string;
}

export function CaminhoesClient({ podeGerenciar }: { podeGerenciar: boolean }) {
  const [rotas, setRotas] = useState<RotaOpcao[]>([]);

  useEffect(() => {
    void (async () => {
      const res = await fetch('/api/cadastros/rotas?page=1&pageSize=100', { cache: 'no-store' });
      if (!res.ok) {
        toast.error(await mensagemDeErro(res));
        return;
      }
      const dados = (await res.json()) as { data: RotaOpcao[] };
      setRotas(dados.data);
    })();
  }, []);

  return (
    <CadastroTabelaDrawer<Caminhao>
      titulo="Caminhões"
      subtitulo="Frota utilizada nas cargas e rotas de expedição."
      rotuloNovo="Novo Caminhão"
      rotuloSalvar="Salvar Caminhão"
      tituloDrawerNovo="Novo Caminhão"
      tituloDrawerEdicao={(c) => `Caminhão — ${c.placa}`}
      placeholderBusca="Buscar por placa ou descrição"
      substantivoSingular="caminhão"
      substantivoPlural="caminhões"
      endpoint="/api/cadastros/frota-caminhoes"
      larguraDrawer={460}
      podeGerenciar={podeGerenciar}
      mensagemVazia="Nenhum caminhão encontrado para os filtros aplicados."
      statusDe={(c) => c.status}
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
          chave: 'placa',
          titulo: 'Placa',
          tipo: 'mono',
          render: (c) => (
            <span className="inline-flex items-center gap-1.5">
              <Truck className="size-3" /> {c.placa}
            </span>
          ),
        },
        {
          chave: 'descricao',
          titulo: 'Descrição',
          render: (c) => <span className="text-foreground">{c.descricao ?? '—'}</span>,
        },
        {
          chave: 'capacidadeKg',
          titulo: 'Capacidade (kg)',
          tipo: 'numero',
          render: (c) => <>{c.capacidadeKg.toLocaleString('pt-BR')} kg</>,
        },
        {
          chave: 'rotaPadrao',
          titulo: 'Rota padrão',
          render: (c) => <span className="text-muted-foreground">{c.rotaPadraoNome ?? '—'}</span>,
        },
      ]}
      campos={[
        { nome: 'placa', rotulo: 'Placa', tipo: 'texto', obrigatorio: true, placeholder: 'ABC-1D23', monoespacado: true },
        { nome: 'descricao', rotulo: 'Descrição', tipo: 'texto', placeholder: 'Ex: Baú refrigerado — Mercedes 710' },
        { nome: 'capacidadeKg', rotulo: 'Capacidade (kg)', tipo: 'numero' },
        {
          nome: 'rotaPadraoId',
          rotulo: 'Rota padrão',
          tipo: 'select',
          placeholder: 'Sem rota padrão',
          opcoes: rotas.map((r) => ({ valor: r.id, rotulo: r.nome })),
        },
      ]}
      formularioVazio={{ placa: '', descricao: '', capacidadeKg: '0', rotaPadraoId: '', status: 'ativo' }}
      paraFormulario={(c) => ({
        placa: c.placa,
        descricao: c.descricao ?? '',
        capacidadeKg: String(c.capacidadeKg),
        rotaPadraoId: c.rotaPadraoId ?? '',
        status: c.status,
      })}
      paraPayload={(f) => ({
        placa: (f.placa ?? '').trim().toUpperCase(),
        descricao: (f.descricao ?? '').trim() || undefined,
        capacidadeKg: (f.capacidadeKg ?? '').trim() || '0',
        rotaPadraoId: (f.rotaPadraoId ?? '').trim() || null,
        status: f.status,
      })}
    />
  );
}
