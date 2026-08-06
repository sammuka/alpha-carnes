'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
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
    <Card>
      <CardHeader>
        <Shield className="size-4 text-primary" />
        <CardTitle>Resumo de Perfis</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {erro && (
          <p role="alert" className="text-sm text-destructive">
            {erro}
          </p>
        )}

        {!erro && !linhas && <p className="text-sm text-muted-foreground">Carregando…</p>}

        {linhas?.map((linha, indice) => (
          <div key={linha.slug} className="space-y-1">
            <div className="flex justify-between text-[11px]">
              <span className="font-medium text-foreground">{linha.nome}</span>
              <span className="text-muted-foreground">
                {linha.total} {linha.total === 1 ? 'usuário' : 'usuários'}
              </span>
            </div>
            <div className="h-1 w-full rounded-full bg-surface-3">
              <div
                className="h-1 rounded-full bg-primary"
                style={{
                  width: maior > 0 ? `${(linha.total / maior) * 100}%` : '0%',
                  backgroundColor: CORES[indice % CORES.length],
                }}
              />
            </div>
          </div>
        ))}
      </CardContent>
      <CardFooter>
        <Button asChild variant="secondary" className="w-full">
          <Link href="/admin/perfis">Gerenciar Permissões (RBAC)</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
