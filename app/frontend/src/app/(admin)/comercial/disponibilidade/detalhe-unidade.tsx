'use client';

import { PackageSearch } from 'lucide-react';
import type { DetalheMapa, EstadoMapa, MapaProduto } from '@/lib/mapa-disponibilidade';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';

const ROTULOS: Record<string, string> = {
  id: 'Identificador',
  etiqueta_atual: 'Etiqueta',
  peso_original: 'Peso',
  status_peca: 'Status da peça',
  recebimento_id: 'Recebimento',
  quantidade_disponivel: 'Quantidade disponível',
  compra_programada_id: 'Compra programada',
  numero_interno: 'Número interno',
  carga_item_id: 'Item da carga',
  caminhao_id: 'Caminhão',
  placa: 'Placa',
  status_caminhao: 'Status do caminhão',
  tipo_origem: 'Origem',
  quantidade_reservada: 'Quantidade reservada',
  tipo_consumo: 'Tipo de consumo',
  pedido_venda_id: 'Pedido',
  status_pedido: 'Status do pedido',
  cliente_id: 'Cliente',
  razao_social: 'Razão social',
};

interface DetalheUnidadeProps {
  produto: MapaProduto | null;
  estado: EstadoMapa | null;
  unidades: DetalheMapa[];
  carregando: boolean;
}

export function DetalheUnidade({
  produto,
  estado,
  unidades,
  carregando,
}: DetalheUnidadeProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Unidades do grupo</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5">
        <p className="text-xs text-muted-foreground">
          {produto && estado ? `${produto.descricao} · estado ${estado}` : 'Selecione um bloco do mapa.'}
        </p>
        {carregando && <p className="text-sm text-muted-foreground">Carregando unidades...</p>}
        {!carregando && produto && estado && unidades.length === 0 && (
          <EmptyState icon={<PackageSearch />} title="Nenhuma unidade real neste estado." />
        )}
        {unidades.map((unidade, index) => (
          <article key={`${String(Object.values(unidade)[0])}-${index}`} className="rounded-md border border-border p-2.5">
            <dl className="grid gap-2">
              {Object.entries(unidade).map(([campo, valor]) => (
                <div key={campo}>
                  <dt className="text-[10px] font-medium uppercase tracking-[0.03em] text-muted-foreground">
                    {ROTULOS[campo] ?? campo}
                  </dt>
                  <dd className="break-words text-xs font-semibold">
                    {valor == null || valor === '' ? '—' : String(valor)}
                  </dd>
                </div>
              ))}
            </dl>
          </article>
        ))}
      </CardContent>
    </Card>
  );
}
