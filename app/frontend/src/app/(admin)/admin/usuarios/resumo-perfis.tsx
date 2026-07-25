'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { mensagemDeErro } from '@/lib/error-message';

interface LinhaResumo {
  slug: string;
  nome: string;
  total: number;
}

/** As três cores do protótipo pelos tokens da Onda 2 — hex literal em `src` reprova em
 *  `tokens-ds.test.ts` (decisão 46). */
const CORES = ['var(--color-violet-accent)', 'var(--color-brand-blue-mid)', 'var(--color-success)'];

export function ResumoPerfis() {
  const [linhas, setLinhas] = useState<LinhaResumo[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/admin/usuarios/resumo-perfis', { cache: 'no-store' });
        if (!res.ok) {
          setErro(await mensagemDeErro(res));
          return;
        }
        setLinhas((await res.json()) as LinhaResumo[]);
      } catch {
        setErro('Erro de conexão com o servidor.');
      }
    })();
  }, []);

  const maior = linhas?.reduce((max, l) => Math.max(max, l.total), 0) ?? 0;

  return (
    <Card className="space-y-4 p-5">
      <div className="flex items-center gap-2">
        <Shield className="size-5 text-primary" />
        <h2 className="font-bold">Resumo de Perfis</h2>
      </div>

      {erro && (
        <p role="alert" className="text-sm text-destructive">
          {erro}
        </p>
      )}

      {!erro && !linhas && <p className="text-sm text-muted-foreground">Carregando…</p>}

      {linhas?.map((linha, indice) => (
        <div key={linha.slug} className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="font-medium">{linha.nome}</span>
            <span className="text-muted-foreground">
              {linha.total} {linha.total === 1 ? 'usuário' : 'usuários'}
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted">
            <div
              className="h-2 rounded-full"
              style={{
                width: maior > 0 ? `${(linha.total / maior) * 100}%` : '0%',
                backgroundColor: CORES[indice % CORES.length],
              }}
            />
          </div>
        </div>
      ))}

      <Button asChild variant="outline" className="w-full">
        <Link href="/admin/perfis">Gerenciar Permissões (RBAC)</Link>
      </Button>
    </Card>
  );
}
