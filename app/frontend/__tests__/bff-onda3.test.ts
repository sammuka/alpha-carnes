import { existsSync } from 'node:fs';
import { join } from 'node:path';

jest.mock('next/server', () => ({
  NextRequest: class {
    nextUrl: URL;
    constructor(url: string) {
      this.nextUrl = new URL(url);
    }
  },
  NextResponse: {
    json: (payload: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => payload,
    }),
  },
}));

import { NextRequest } from 'next/server';

const ROTAS = [
  'cadastros/representantes/canais/route.ts',
  'cadastros/frota-caminhoes/route.ts',
  'cadastros/frota-caminhoes/[id]/route.ts',
  'cadastros/frota-motoristas/route.ts',
  'cadastros/frota-motoristas/[id]/route.ts',
  'cadastros/modelos-etiqueta/route.ts',
  'cadastros/modelos-etiqueta/[id]/route.ts',
  'cadastros/fornecedores/contagens/route.ts',
  'cadastros/fornecedores/[id]/historico/route.ts',
  'cadastros/regras-desdobramento/simular/route.ts',
  'desossa/regras-transformacao/simular/route.ts',
  'admin/perfis/catalogo/route.ts',
  'admin/perfis/[slug]/menus/route.ts',
  'admin/usuarios/resumo-perfis/route.ts',
  'admin/usuarios/[id]/aprovar/route.ts',
  'admin/auditoria/facetas/route.ts',
  'admin/auditoria/export/route.ts',
  'admin/parametros/route.ts',
  'admin/parametros/chave/[chave]/route.ts',
];

it('todas as rotas BFF da Onda 3 existem', () => {
  const faltando = ROTAS.filter((rota) => !existsSync(join('src', 'app', 'api', rota)));
  expect(faltando).toEqual([]);
});

it('erro do backend vira status e message no BFF', async () => {
  jest.doMock('@/lib/api', () => ({
    fetchBackend: async () => ({ data: null, error: 'Sem permissão', status: 403 }),
  }));
  const { GET } = await import('../src/app/api/admin/perfis/catalogo/route');
  // `NextRequest` (e não `Request`) porque o handler lê `req.nextUrl.searchParams`.
  const res = await GET(new NextRequest('http://localhost/api/admin/perfis/catalogo'));
  expect(res.status).toBe(403);
  await expect(res.json()).resolves.toEqual({ message: 'Sem permissão' });
});
