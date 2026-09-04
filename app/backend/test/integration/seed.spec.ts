import { verify } from '@node-rs/argon2';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { and, count, eq, isNull, sql } from 'drizzle-orm';
import * as schema from '../../src/database/schema';
import { seed } from '../../src/database/seed';
import { DESCRICOES_PERMISSOES } from '../../src/common/rbac/permissoes';

describe('Seed idempotência', () => {
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;

  beforeAll(async () => {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error('DATABASE_URL não definida');

    pool = new Pool({ connectionString });
    db = drizzle(pool, { schema });

    // Executar seed 2× para provar idempotência (DoD da F1)
    await seed();
    await seed();
  }, 60_000);

  afterAll(async () => {
    await pool?.end();
  });

  it('tem exatamente 11 perfis canônicos após seed 2×', async () => {
    const [row] = await db.select({ total: count() }).from(schema.perfis);
    expect(row?.total).toBe(11);
  });

  it('tem exatamente o catálogo de permissões após seed 2× (idempotente)', async () => {
    const [row] = await db.select({ total: count() }).from(schema.permissoes);
    expect(row?.total).toBe(Object.keys(DESCRICOES_PERMISSOES).length);
  });

  it('tem exatamente 1 usuário admin após seed 2×', async () => {
    const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@alphacarnes.local';
    const rows = await db
      .select()
      .from(schema.usuarios)
      .where(eq(schema.usuarios.email, adminEmail));
    expect(rows.length).toBe(1);
  });

  it('usuário admin autenticável com perfil administrador após seed 2×', async () => {
    const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@alphacarnes.local';
    const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'change-me-admin-password';
    const [admin] = await db
      .select()
      .from(schema.usuarios)
      .where(and(eq(schema.usuarios.email, adminEmail), isNull(schema.usuarios.deletedAt)));
    expect(admin).toBeTruthy();
    expect(admin!.ativo).toBe(true);
    expect(await verify(admin!.senhaHash, adminPassword)).toBe(true);

    const perfisAdmin = await db
      .select({ slug: schema.perfis.slug })
      .from(schema.usuariosPerfis)
      .innerJoin(schema.perfis, eq(schema.usuariosPerfis.perfilId, schema.perfis.id))
      .where(eq(schema.usuariosPerfis.usuarioId, admin!.id));
    expect(perfisAdmin.map((p) => p.slug)).toEqual(['administrador']);
  });

  it('perfil corte tem a permissão CORTE_GERENCIAR após seed', async () => {
    const linhas = await db
      .select({ codigo: schema.permissoes.codigo })
      .from(schema.perfis)
      .innerJoin(schema.perfisPermissoes, eq(schema.perfis.id, schema.perfisPermissoes.perfilId))
      .innerJoin(schema.permissoes, eq(schema.perfisPermissoes.permissaoId, schema.permissoes.id))
      .where(eq(schema.perfis.slug, 'corte'));
    expect(linhas.map((l) => l.codigo)).toContain('CORTE_GERENCIAR');
  });

  it('perfil expedicao tem EXPEDICAO_GERENCIAR após seed', async () => {
    const linhas = await db
      .select({ codigo: schema.permissoes.codigo })
      .from(schema.perfis)
      .innerJoin(schema.perfisPermissoes, eq(schema.perfis.id, schema.perfisPermissoes.perfilId))
      .innerJoin(schema.permissoes, eq(schema.perfisPermissoes.permissaoId, schema.permissoes.id))
      .where(eq(schema.perfis.slug, 'expedicao'));
    expect(linhas.map((l) => l.codigo)).toContain('EXPEDICAO_GERENCIAR');
  });

  it('seed cria desdobramento AD-01 do boi casado (2 TZ + 2 DT + 2 PA)', async () => {
    const resultado = await db.execute<{
      compra: string;
      comercial: string;
      fator: string;
    }>(sql`
      SELECT po.codigo AS compra,
             pd.codigo AS comercial,
             r.fator_quantidade AS fator
      FROM regras_desdobramento_comercial r
      JOIN produtos po ON po.id = r.produto_origem_id
      JOIN produtos pd ON pd.id = r.produto_destino_id
      WHERE po.codigo = 'BOI'
        AND r.deleted_at IS NULL
    `);
    const regras = resultado.rows;
    expect(regras).toHaveLength(3);
    expect(regras.map((r) => ({ compra: r.compra, comercial: r.comercial, fator: Number(r.fator) }))).toEqual(
      expect.arrayContaining([
        { compra: 'BOI', comercial: 'TZ', fator: 2 },
        { compra: 'BOI', comercial: 'DT', fator: 2 },
        { compra: 'BOI', comercial: 'PA', fator: 2 },
      ]),
    );
  });

  it('perfil gestor tem EXPEDICAO_REABRIR após seed', async () => {
    const linhas = await db
      .select({ codigo: schema.permissoes.codigo })
      .from(schema.perfis)
      .innerJoin(schema.perfisPermissoes, eq(schema.perfis.id, schema.perfisPermissoes.perfilId))
      .innerJoin(schema.permissoes, eq(schema.perfisPermissoes.permissaoId, schema.permissoes.id))
      .where(eq(schema.perfis.slug, 'gestor'));
    expect(linhas.map((l) => l.codigo)).toContain('EXPEDICAO_REABRIR');
  });

  async function permissoesDoPerfil(slug: string): Promise<string[]> {
    const linhas = await db
      .select({ codigo: schema.permissoes.codigo })
      .from(schema.perfis)
      .innerJoin(schema.perfisPermissoes, eq(schema.perfis.id, schema.perfisPermissoes.perfilId))
      .innerJoin(schema.permissoes, eq(schema.perfisPermissoes.permissaoId, schema.permissoes.id))
      .where(eq(schema.perfis.slug, slug));
    return linhas.map((l) => l.codigo);
  }

  it('concede as permissões da Onda 1 exatamente aos perfis mapeados', async () => {
    expect(await permissoesDoPerfil('gestor')).toEqual(expect.arrayContaining([
      'OPERACOES_GERENCIAR', 'PEDIDO_OVERBOOKING_CONFIRMAR', 'OVERBOOKING_RESOLVER',
      'PEDIDO_FORNECEDOR_GERENCIAR', 'CONFERENCIA_CONCLUIR', 'PEDIDO_FINALIZAR',
    ]));
    expect(await permissoesDoPerfil('administrador')).toEqual(expect.arrayContaining([
      'OPERACOES_GERENCIAR', 'PEDIDO_OVERBOOKING_CONFIRMAR', 'OVERBOOKING_RESOLVER',
      'PEDIDO_FORNECEDOR_GERENCIAR', 'CONFERENCIA_CONCLUIR', 'PEDIDO_FINALIZAR',
    ]));
    expect(await permissoesDoPerfil('compras')).toEqual(expect.arrayContaining([
      'OPERACOES_GERENCIAR', 'PEDIDO_FORNECEDOR_GERENCIAR',
    ]));
    expect(await permissoesDoPerfil('comercial')).toEqual(expect.arrayContaining([
      'PEDIDO_OVERBOOKING_CONFIRMAR', 'PEDIDO_FINALIZAR',
    ]));
    expect(await permissoesDoPerfil('recebimento_pesagem')).toEqual(
      expect.arrayContaining(['CONFERENCIA_CONCLUIR']),
    );
  });

  it('nega OVERBOOKING_RESOLVER a perfis sem a permissão (segregação)', async () => {
    for (const slug of ['conferente', 'diretoria', 'logistica', 'comercial', 'compras']) {
      expect(await permissoesDoPerfil(slug)).not.toContain('OVERBOOKING_RESOLVER');
    }
  });
});
