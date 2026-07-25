'use client';

import { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import type { ClienteVinculado } from '@/lib/representantes';

export function ClientesVinculados({ representanteId }: { representanteId: string }) {
  const [clientes, setClientes] = useState<ClienteVinculado[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      try {
        const res = await fetch(`/api/cadastros/representantes/${representanteId}`, { cache: 'no-store' });
        if (!res.ok) {
          if (ativo) setErro('Não foi possível carregar os clientes vinculados.');
          return;
        }
        const detalhe = (await res.json()) as { clientesVinculados: ClienteVinculado[] };
        if (ativo) setClientes(detalhe.clientesVinculados);
      } catch {
        if (ativo) setErro('Não foi possível carregar os clientes vinculados.');
      }
    })();
    return () => {
      ativo = false;
    };
  }, [representanteId]);

  if (erro) {
    return <p role="alert" className="text-[12px] text-destructive">{erro}</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="flex items-center gap-1.5 text-[12px] font-semibold text-text-graphite">
        <Users className="size-3.5 text-text-muted" /> Clientes vinculados
        {clientes !== null && ` (${clientes.length})`}
      </p>
      {clientes === null ? (
        <p className="text-[12px] text-text-muted">Carregando…</p>
      ) : clientes.length === 0 ? (
        <p className="text-[12px] text-text-muted">Nenhum cliente vinculado.</p>
      ) : (
        <div className="flex flex-col gap-1.5 rounded-lg bg-surface-subtle p-3">
          {clientes.map((c) => (
            <div key={c.id} className="text-[12px] text-text-ink">
              {c.nomeFantasia ?? c.razaoSocial}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
