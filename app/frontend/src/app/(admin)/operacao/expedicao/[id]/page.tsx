import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getMe } from '@/lib/auth';
import { fetchBackend } from '@/lib/api';
import type { CaminhaoDetalhe } from '@/lib/operacao';

export default async function ExpedicaoDetalhePage(props: { params: Promise<{ id: string }> }) {
  const user = await getMe();
  if (!user) redirect('/login');
  if (!user.permissoes.includes('EXPEDICAO_GERENCIAR')) {
    return <p className="text-sm text-destructive">Você não tem permissão para visualizar expedição.</p>;
  }

  const { id } = await props.params;
  const { data, error } = await fetchBackend<CaminhaoDetalhe>(`/operacao/expedicao/caminhoes/${id}`);

  if (error || !data) {
    return (
      <div className="space-y-3">
        <Link href="/operacao/expedicao" className="text-sm text-primary hover:underline">
          Voltar para expedição
        </Link>
        <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          Erro ao carregar caminhão: {error ?? 'desconhecido'}
        </div>
      </div>
    );
  }

  const { caminhao, pedidos } = data;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/operacao/expedicao" className="text-sm text-primary hover:underline">
            Voltar para expedição
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-foreground">Caminhão {caminhao.placa}</h1>
          <p className="text-sm text-muted-foreground">
            {caminhao.motorista} · {caminhao.dataOperacao}
            {caminhao.rota ? ` · ${caminhao.rota}` : ''}
          </p>
        </div>
        <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground" data-testid="status-caminhao">
          {caminhao.statusCaminhao.replace(/_/g, ' ')}
        </span>
      </div>

      <section className="rounded-md border border-border bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold text-foreground">Pedidos vinculados</h2>
        {pedidos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum pedido vinculado a este caminhão.</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="border border-border p-2 text-left font-medium">Pedido</th>
                <th className="border border-border p-2 text-right font-medium">Previsto</th>
                <th className="border border-border p-2 text-right font-medium">Carregado</th>
                <th className="border border-border p-2 text-right font-medium">Ordem</th>
              </tr>
            </thead>
            <tbody>
              {pedidos.map((pedido) => (
                <tr key={pedido.pedidoVendaId}>
                  <td className="border border-border p-2 font-mono text-xs">{pedido.pedidoVendaId}</td>
                  <td className="border border-border p-2 text-right">{pedido.previsto}</td>
                  <td className="border border-border p-2 text-right">{pedido.carregado}</td>
                  <td className="border border-border p-2 text-right">{pedido.ordemNaCarga ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
