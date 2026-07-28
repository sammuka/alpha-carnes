'use client';

import type { DetalheMapa, EstadoMapa, MapaProduto } from '@/lib/mapa-disponibilidade';

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
    <aside className="rounded-xl border bg-card">
      <div className="border-b px-4 py-3">
        <h2 className="font-semibold">Unidades do grupo</h2>
        <p className="text-xs text-muted-foreground">
          {produto && estado ? `${produto.descricao} · estado ${estado}` : 'Selecione um bloco do mapa.'}
        </p>
      </div>
      <div className="space-y-3 p-4">
        {carregando && <p className="text-sm text-muted-foreground">Carregando unidades...</p>}
        {!carregando && produto && estado && unidades.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhuma unidade real neste estado.</p>
        )}
        {unidades.map((unidade, index) => (
          <article key={`${String(Object.values(unidade)[0])}-${index}`} className="rounded-lg border p-3">
            <dl className="grid gap-2">
              {Object.entries(unidade).map(([campo, valor]) => (
                <div key={campo}>
                  <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
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
      </div>
    </aside>
  );
}
