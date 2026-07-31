import { INestApplication } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import request from 'supertest';
import { DRIZZLE } from '../../src/database/database.module';
import * as schema from '../../src/database/schema';
import { createTestApp, cleanupDb, createTestUser, loginCookies } from '../helpers/test-app';

function uid(prefix: string): string {
  return `${prefix}-${Math.round(performance.now() * 1000)}-${Math.floor(Math.random() * 1e6)}`;
}

describe('usuarios-representantes e2e (E5.1 Tasks 19–20)', () => {
  let app: INestApplication;
  let adminCookies: string;
  let gestorCookies: string;
  let db: NodePgDatabase<typeof schema>;

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get<{ db: NodePgDatabase<typeof schema> }>(DRIZZLE).db;
    const admin = await createTestUser(app, { perfil: 'administrador' });
    const gestor = await createTestUser(app, { perfil: 'gestor' });
    adminCookies = await loginCookies(app, admin.adminEmail, admin.adminPassword);
    gestorCookies = await loginCookies(app, gestor.adminEmail, gestor.adminPassword);
  });

  afterAll(async () => {
    await cleanupDb(app);
    await app.close();
  });

  it('migration materializa constraints e índices de usuarios_representantes', async () => {
    const rows = await db.execute<{ conname: string }>(sql`
      SELECT conname FROM pg_constraint
      WHERE conrelid = 'usuarios_representantes'::regclass
    `);
    const nomes = rows.rows.map((r) => r.conname);
    expect(nomes.some((n) => n.includes('pk_usuarios_representantes'))).toBe(true);
    expect(nomes.some((n) => n.includes('usuario_id'))).toBe(true);
    expect(nomes.some((n) => n.includes('representante_id'))).toBe(true);

    const idx = await db.execute(sql`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'usuarios_representantes'
        AND indexname = 'idx_usuarios_representantes_representante'
    `);
    expect(idx.rows.length).toBe(1);
  });

  it('migração 0020 integra a journal sem drift', async () => {
    const journal = await db.execute<{ tag: string }>(sql`
      SELECT tag FROM drizzle.__drizzle_migrations ORDER BY created_at
    `);
    const tags = journal.rows.map((r) => r.tag);
    expect(tags).toContain('0020_onda5_usuarios_representantes');
  });

  it('nega anônimo e gestor e permite administrador', async () => {
    const [rep] = await db.insert(schema.representantes)
      .values({ codigo: uid('REP'), nome: 'Rep Auth' })
      .returning();
    const [usuario] = await db.insert(schema.usuarios)
      .values({
        nome: 'Alvo',
        email: `${uid('u')}@test.local`,
        senhaHash: 'x',
      })
      .returning();
    if (!rep || !usuario) throw new Error('fixture');

    await request(app.getHttpServer())
      .put(`/usuarios/${usuario.id}/representantes`)
      .send({ representantes: [rep.id] })
      .expect(401);

    await request(app.getHttpServer())
      .put(`/usuarios/${usuario.id}/representantes`)
      .set('Cookie', gestorCookies)
      .send({ representantes: [rep.id] })
      .expect(403);

    await request(app.getHttpServer())
      .put(`/usuarios/${usuario.id}/representantes`)
      .set('Cookie', adminCookies)
      .send({ representantes: [rep.id] })
      .expect(200);
  });

  it('valida o conjunto de representantes', async () => {
    const [usuario] = await db.insert(schema.usuarios)
      .values({ nome: 'Val', email: `${uid('v')}@test.local`, senhaHash: 'x' })
      .returning();
    if (!usuario) throw new Error('fixture');

    await request(app.getHttpServer())
      .put(`/usuarios/${usuario.id}/representantes`)
      .set('Cookie', adminCookies)
      .send({ representantes: ['nao-uuid'] })
      .expect(400);

    const [rep] = await db.insert(schema.representantes)
      .values({ codigo: uid('REP'), nome: 'Dup' })
      .returning();
    if (!rep) throw new Error('rep');

    await request(app.getHttpServer())
      .put(`/usuarios/${usuario.id}/representantes`)
      .set('Cookie', adminCookies)
      .send({ representantes: [rep.id, rep.id] })
      .expect(400);
  });

  it('não grava conjunto parcialmente inválido', async () => {
    const [usuario] = await db.insert(schema.usuarios)
      .values({ nome: 'Inv', email: `${uid('i')}@test.local`, senhaHash: 'x' })
      .returning();
    if (!usuario) throw new Error('fixture');

    const fakeId = '00000000-0000-4000-8000-000000000099';
    await request(app.getHttpServer())
      .put(`/usuarios/${usuario.id}/representantes`)
      .set('Cookie', adminCookies)
      .send({ representantes: [fakeId] })
      .expect(400);

    const linhas = await db.select().from(schema.usuariosRepresentantes)
      .where(sql`${schema.usuariosRepresentantes.usuarioId} = ${usuario.id}`);
    expect(linhas).toHaveLength(0);
  });

  it('expõe semântica todos e restrito sem sentinela', async () => {
    const [rep] = await db.insert(schema.representantes)
      .values({ codigo: uid('REP'), nome: 'Escopo Rep' })
      .returning();
    const [usuarioTodos] = await db.insert(schema.usuarios)
      .values({ nome: 'Todos', email: `${uid('t')}@test.local`, senhaHash: 'x' })
      .returning();
    const [usuarioRestrito] = await db.insert(schema.usuarios)
      .values({ nome: 'Restrito', email: `${uid('r')}@test.local`, senhaHash: 'x' })
      .returning();
    if (!rep || !usuarioTodos || !usuarioRestrito) throw new Error('fixture');

    await db.insert(schema.usuariosRepresentantes)
      .values({ usuarioId: usuarioRestrito.id, representanteId: rep.id });

    const detTodos = await request(app.getHttpServer())
      .get(`/usuarios/${usuarioTodos.id}`)
      .set('Cookie', adminCookies)
      .expect(200);
    expect(detTodos.body.escopoRepresentantes).toBe('todos');
    expect(detTodos.body.representantesPermitidos).toEqual([]);

    const detRestrito = await request(app.getHttpServer())
      .get(`/usuarios/${usuarioRestrito.id}`)
      .set('Cookie', adminCookies)
      .expect(200);
    expect(detRestrito.body.escopoRepresentantes).toBe('restrito');
    expect(detRestrito.body.representantesPermitidos).toHaveLength(1);
  });

  it('mesmo conjunto é no-op', async () => {
    const [rep] = await db.insert(schema.representantes)
      .values({ codigo: uid('REP'), nome: 'Noop' })
      .returning();
    const [usuario] = await db.insert(schema.usuarios)
      .values({ nome: 'Noop', email: `${uid('n')}@test.local`, senhaHash: 'x' })
      .returning();
    if (!rep || !usuario) throw new Error('fixture');

    await request(app.getHttpServer())
      .put(`/usuarios/${usuario.id}/representantes`)
      .set('Cookie', adminCookies)
      .send({ representantes: [rep.id] })
      .expect(200);

    const antes = await db.select().from(schema.auditoria)
      .where(sql`${schema.auditoria.tabela} = 'usuarios_representantes' AND ${schema.auditoria.registroId} = ${usuario.id}`);
    const countAntes = antes.length;

    await request(app.getHttpServer())
      .put(`/usuarios/${usuario.id}/representantes`)
      .set('Cookie', adminCookies)
      .send({ representantes: [rep.id] })
      .expect(200);

    const depois = await db.select().from(schema.auditoria)
      .where(sql`${schema.auditoria.tabela} = 'usuarios_representantes' AND ${schema.auditoria.registroId} = ${usuario.id}`);
    expect(depois.length).toBe(countAntes);
  });

  it('audita substituição com antes e depois', async () => {
    const [rep1] = await db.insert(schema.representantes)
      .values({ codigo: uid('R1'), nome: 'Antes' })
      .returning();
    const [rep2] = await db.insert(schema.representantes)
      .values({ codigo: uid('R2'), nome: 'Depois' })
      .returning();
    const [usuario] = await db.insert(schema.usuarios)
      .values({ nome: 'Aud', email: `${uid('a')}@test.local`, senhaHash: 'x' })
      .returning();
    if (!rep1 || !rep2 || !usuario) throw new Error('fixture');

    await request(app.getHttpServer())
      .put(`/usuarios/${usuario.id}/representantes`)
      .set('Cookie', adminCookies)
      .send({ representantes: [rep1.id] })
      .expect(200);

    await request(app.getHttpServer())
      .put(`/usuarios/${usuario.id}/representantes`)
      .set('Cookie', adminCookies)
      .send({ representantes: [rep2.id] })
      .expect(200);

    const audit = await db.select().from(schema.auditoria)
      .where(sql`${schema.auditoria.tabela} = 'usuarios_representantes' AND ${schema.auditoria.registroId} = ${usuario.id}`)
      .orderBy(schema.auditoria.createdAt);
    const ultima = audit[audit.length - 1];
    expect(ultima?.dadosAnteriores).toMatchObject({ representantes: [rep1.id] });
    expect(ultima?.dadosNovos).toMatchObject({ representantes: [rep2.id] });
  });

  it('criação com escopo é atômica', async () => {
    const [rep] = await db.insert(schema.representantes)
      .values({ codigo: uid('REP'), nome: 'Criar' })
      .returning();
    if (!rep) throw new Error('rep');

    const email = `${uid('criar')}@test.local`;
    const res = await request(app.getHttpServer())
      .post('/usuarios')
      .set('Cookie', adminCookies)
      .send({
        nome: 'Novo Escopo',
        email,
        password: 'TestPass@123456',
        perfis: ['comercial'],
        representantes: [rep.id],
      })
      .expect(201);

    const vinculos = await db.select().from(schema.usuariosRepresentantes)
      .where(sql`${schema.usuariosRepresentantes.usuarioId} = ${res.body.id}`);
    expect(vinculos).toHaveLength(1);
    expect(res.body.escopoRepresentantes).toBe('restrito');
  });

  it('restauração preserva representantes permitidos', async () => {
    const [rep] = await db.insert(schema.representantes)
      .values({ codigo: uid('REP'), nome: 'Restore' })
      .returning();
    const [usuario] = await db.insert(schema.usuarios)
      .values({ nome: 'Restore', email: `${uid('rest')}@test.local`, senhaHash: 'x' })
      .returning();
    if (!rep || !usuario) throw new Error('fixture');

    await db.insert(schema.usuariosRepresentantes)
      .values({ usuarioId: usuario.id, representanteId: rep.id });

    await request(app.getHttpServer())
      .delete(`/usuarios/${usuario.id}`)
      .set('Cookie', adminCookies)
      .expect(200);

    await request(app.getHttpServer())
      .post(`/usuarios/${usuario.id}/restaurar`)
      .set('Cookie', adminCookies)
      .expect(201);

    const vinculos = await db.select().from(schema.usuariosRepresentantes)
      .where(sql`${schema.usuariosRepresentantes.usuarioId} = ${usuario.id}`);
    expect(vinculos).toHaveLength(1);
  });

  it('projeta usuários vinculados ordenados por representante', async () => {
    const [rep] = await db.insert(schema.representantes)
      .values({ codigo: uid('REP'), nome: 'Proj' })
      .returning();
    const [u1] = await db.insert(schema.usuarios)
      .values({ nome: 'Beto', email: `${uid('b')}@test.local`, senhaHash: 'x' })
      .returning();
    const [u2] = await db.insert(schema.usuarios)
      .values({ nome: 'Ana', email: `${uid('a2')}@test.local`, senhaHash: 'x' })
      .returning();
    if (!rep || !u1 || !u2) throw new Error('fixture');

    await db.insert(schema.usuariosRepresentantes).values([
      { usuarioId: u1.id, representanteId: rep.id },
      { usuarioId: u2.id, representanteId: rep.id },
    ]);

    const lista = await request(app.getHttpServer())
      .get('/representantes')
      .set('Cookie', adminCookies)
      .expect(200);
    const linha = lista.body.data.find((r: { id: string }) => r.id === rep.id);
    expect(linha.usuariosVinculadosCount).toBe(2);

    const detalhe = await request(app.getHttpServer())
      .get(`/representantes/${rep.id}`)
      .set('Cookie', adminCookies)
      .expect(200);
    expect(detalhe.body.usuariosVinculados.map((u: { nome: string }) => u.nome))
      .toEqual(['Ana', 'Beto']);
  });

  it('auth me expõe escopo real da sessão', async () => {
    const comercial = await createTestUser(app, { perfil: 'comercial' });
    const cookies = await loginCookies(app, comercial.adminEmail, comercial.adminPassword);

    const meTodos = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', cookies)
      .expect(200);
    expect(meTodos.body.escopoRepresentantes.tipo).toBe('todos');

    const [usuario] = await db.select().from(schema.usuarios)
      .where(sql`${schema.usuarios.email} = ${comercial.adminEmail}`);
    const [rep] = await db.insert(schema.representantes)
      .values({ codigo: uid('REP'), nome: 'Me Rep' })
      .returning();
    if (!usuario || !rep) throw new Error('fixture');

    await db.insert(schema.usuariosRepresentantes)
      .values({ usuarioId: usuario.id, representanteId: rep.id });

    const meRestrito = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', cookies)
      .expect(200);
    expect(meRestrito.body.escopoRepresentantes.tipo).toBe('restrito');
    expect(meRestrito.body.escopoRepresentantes.representantes[0].nome).toBe('Me Rep');
  });
});
