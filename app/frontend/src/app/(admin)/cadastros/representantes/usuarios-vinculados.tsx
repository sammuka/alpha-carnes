'use client';

import { useCallback, useEffect, useState } from 'react';
import { extrairMensagemErro } from '@/lib/error-message';
import type { Representante, UsuarioVinculado } from '@/lib/representantes';
import { Button } from '@/components/ui/button';

export function UsuariosVinculados({
  representanteId,
}: {
  representanteId: string;
}) {
  const [usuarios, setUsuarios] = useState<UsuarioVinculado[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setUsuarios(null);
    setErro(null);
    try {
      const resposta = await fetch(
        `/api/cadastros/representantes/${representanteId}`,
        { cache: 'no-store' },
      );
      if (!resposta.ok) {
        const corpo = await resposta.json().catch(() => ({}));
        setErro(extrairMensagemErro(
          corpo,
          'Não foi possível carregar os usuários vinculados.',
        ));
        return;
      }
      const detalhe = (await resposta.json()) as Representante;
      setUsuarios(detalhe.usuariosVinculados ?? []);
    } catch {
      setErro('Não foi possível carregar os usuários vinculados.');
    }
  }, [representanteId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.02em] text-fg-secondary">
        Usuários vinculados{usuarios !== null ? ` (${usuarios.length})` : ''}
      </p>
      {erro ? (
        <div className="flex flex-col items-start gap-2">
          <p role="alert" className="text-[12px] text-destructive">{erro}</p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => void carregar()}
          >
            Tentar novamente
          </Button>
        </div>
      ) : usuarios === null ? (
        <p aria-busy="true" className="text-[12px] text-muted-foreground">
          Carregando usuários vinculados…
        </p>
      ) : usuarios.length === 0 ? (
        <p className="text-[12px] text-muted-foreground">Nenhum usuário vinculado.</p>
      ) : (
        <div className="flex flex-col gap-1.5 rounded-md bg-surface-2 p-2.5">
          {usuarios.map((usuario) => (
            <div key={usuario.id} className="text-[12px] text-foreground">
              <span className="font-medium">{usuario.nome}</span>
              <span className="ml-1 text-muted-foreground">{usuario.email}</span>
              {!usuario.ativo && <span className="ml-1">(Inativo)</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
