'use client';

import { useEffect, useState } from 'react';
import { Info } from 'lucide-react';
import { CadastroTabelaDrawer } from '@/components/cadastros/cadastro-tabela-drawer';
import { BadgeCount } from '@/components/ui/badge-count';
import type { Representante } from '@/lib/representantes';
import { ClientesVinculados } from './clientes-vinculados';
import { UsuariosVinculados } from './usuarios-vinculados';

const BANNER = (
  <div className="flex gap-2 rounded-md border border-primary-soft-border bg-info-soft px-3 py-2 text-xs text-info-fg">
    <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
    <p>Todo cliente tem um vendedor/representante associado; o pedido herda do cliente.</p>
  </div>
);

export function RepresentantesClient({ podeGerenciar }: { podeGerenciar: boolean }) {
  const [canais, setCanais] = useState<string[]>([]);

  // Opções reais de `tipo_canal` (decisão 44.3): sem canal cadastrado, o `select` não aparece.
  useEffect(() => {
    void (async () => {
      const res = await fetch('/api/cadastros/representantes/canais', { cache: 'no-store' });
      if (res.ok) setCanais((await res.json()) as string[]);
    })();
  }, []);

  return (
    <CadastroTabelaDrawer<Representante>
      titulo="Representantes"
      subtitulo="Vendedores e representantes que atendem clientes e pedidos."
      rotuloNovo="Novo Representante"
      rotuloSalvar="Salvar Representante"
      tituloDrawerNovo="Novo Representante"
      tituloDrawerEdicao={(r) => `Representante — ${r.nome}`}
      placeholderBusca="Buscar por nome ou contato"
      substantivoSingular="representante"
      substantivoPlural="representantes"
      endpoint="/api/cadastros/representantes"
      larguraDrawer={520}
      podeGerenciar={podeGerenciar}
      mensagemVazia="Nenhum representante encontrado para os filtros aplicados."
      bannerTopo={BANNER}
      bannerDrawer={BANNER}
      statusDe={(r) => r.status}
      filtros={
        canais.length > 0
          ? [
              {
                nome: 'tipoCanal',
                rotuloTodos: 'Canal: Todos',
                opcoes: canais.map((c) => ({ valor: c, rotulo: c })),
              },
              {
                nome: 'status',
                rotuloTodos: 'Status: Todos',
                opcoes: [
                  { valor: 'ativo', rotulo: 'Ativo' },
                  { valor: 'inativo', rotulo: 'Inativo' },
                ],
              },
            ]
          : [
              {
                nome: 'status',
                rotuloTodos: 'Status: Todos',
                opcoes: [
                  { valor: 'ativo', rotulo: 'Ativo' },
                  { valor: 'inativo', rotulo: 'Inativo' },
                ],
              },
            ]
      }
      colunas={[
        {
          chave: 'nome',
          titulo: 'Nome',
          render: (r) => <span className="font-semibold text-foreground">{r.nome}</span>,
        },
        {
          chave: 'tipoCanal',
          titulo: 'Tipo/canal',
          render: (r) =>
            r.tipoCanal ? (
              <BadgeCount>{r.tipoCanal}</BadgeCount>
            ) : (
              <span className="text-muted-foreground">—</span>
            ),
        },
        {
          chave: 'contato',
          titulo: 'Contato',
          render: (r) => <span className="text-muted-foreground">{r.contato ?? '—'}</span>,
        },
        {
          chave: 'clientesVinculados',
          titulo: 'Clientes vinculados',
          render: (r) => (
            <BadgeCount>{typeof r.clientesVinculados === 'number' ? r.clientesVinculados : 0}</BadgeCount>
          ),
        },
        {
          chave: 'usuariosVinculadosCount',
          titulo: 'Usuários vinculados',
          render: (representante) => <BadgeCount>{representante.usuariosVinculadosCount}</BadgeCount>,
        },
      ]}
      campos={[
        { nome: 'codigo', rotulo: 'Código', tipo: 'texto', obrigatorio: true, placeholder: 'REP-01', monoespacado: true, maxLength: 50 },
        { nome: 'nome', rotulo: 'Nome', tipo: 'texto', obrigatorio: true, placeholder: 'Ex: Sabrina', maxLength: 200 },
        { nome: 'tipoCanal', rotulo: 'Tipo / canal', tipo: 'texto', placeholder: 'Ex: Interno', maxLength: 100 },
        { nome: 'contato', rotulo: 'Contato', tipo: 'texto', placeholder: 'Telefone e/ou e-mail', maxLength: 200 },
        { nome: 'observacao', rotulo: 'Observação', tipo: 'textarea' },
      ]}
      formularioVazio={{ codigo: '', nome: '', tipoCanal: '', contato: '', observacao: '', status: 'ativo' }}
      paraFormulario={(r) => ({
        codigo: r.codigo,
        nome: r.nome,
        tipoCanal: r.tipoCanal ?? '',
        contato: r.contato ?? '',
        observacao: r.observacao ?? '',
        status: r.status,
      })}
      paraPayload={(f) => ({
        codigo: (f.codigo ?? '').trim(),
        nome: (f.nome ?? '').trim(),
        tipoCanal: (f.tipoCanal ?? '').trim() || undefined,
        contato: (f.contato ?? '').trim() || undefined,
        observacao: (f.observacao ?? '').trim() || undefined,
        status: f.status,
      })}
      blocosDrawer={(representante) => (
        representante ? (
          <>
            <ClientesVinculados representanteId={representante.id} />
            <UsuariosVinculados representanteId={representante.id} />
          </>
        ) : null
      )}
    />
  );
}
