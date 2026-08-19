import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, cleanupDb, createTestUser, loginCookies } from '../helpers/test-app';
import { MENUS_CANONICOS, MENUS_VISIVEIS_POR_PERFIL } from '../../src/common/rbac/menus-canonicos';
import { DESCRICOES_PERMISSOES } from '../../src/common/rbac/permissoes';
import { DRIZZLE } from '../../src/database/database.module';

describe('Perfis — menus visíveis e catálogo', () => {
  let app: INestApplication;
  let adminCookies: string;
  let comercialCookies: string;

  beforeAll(async () => {
    app = await createTestApp();
    const admin = await createTestUser(app, { perfil: 'administrador' });
    const comercial = await createTestUser(app, { perfil: 'comercial' });
    adminCookies = await loginCookies(app, admin.adminEmail, admin.adminPassword);
    comercialCookies = await loginCookies(app, comercial.adminEmail, comercial.adminPassword);

    // Harness: createTestUser não popula menus_visiveis; o seed canônico é a pré-condição DoD-13.
    const { seedMenusVisiveis } = await import('../../src/database/seed');
    await seedMenusVisiveis(app.get(DRIZZLE).db);
  });

  afterAll(async () => {
    await cleanupDb(app);
    await app.close();
  });

  const srv = () => app.getHttpServer();

  it('define menus visiveis, audita e rejeita href desconhecido', async () => {
    const antes = await request(srv()).get('/perfis').set('Cookie', adminCookies);
    const conferente = antes.body.find((p: { slug: string }) => p.slug === 'conferente');
    expect(conferente.menusVisiveis).toEqual(['/carga/conferencia']);

    const ok = await request(srv()).put('/perfis/conferente/menus').set('Cookie', adminCookies)
      .send({ menus: ['/carga/conferencia', '/estoque/consulta'] });
    expect(ok.status).toBe(200);
    expect(ok.body.menusVisiveis).toEqual(['/carga/conferencia', '/estoque/consulta']);

    const ruim = await request(srv()).put('/perfis/conferente/menus').set('Cookie', adminCookies)
      .send({ menus: ['/rota/inexistente'] });
    expect(ruim.status).toBe(400);

    const inalterado = await request(srv()).get('/perfis').set('Cookie', adminCookies);
    expect(inalterado.body.find((p: { slug: string }) => p.slug === 'conferente').menusVisiveis)
      .toEqual(['/carga/conferencia', '/estoque/consulta']);

    const log = await request(srv()).get('/auditoria?modulo=perfis').set('Cookie', adminCookies);
    expect(log.body.data.some((l: { dadosNovos: { slug?: string } }) => l.dadosNovos.slug === 'conferente')).toBe(true);
  });

  it('seed de menus visiveis reconcilia perfil alterado', async () => {
    await request(srv()).put('/perfis/corte/menus').set('Cookie', adminCookies).send({ menus: [] });
    const { seedMenusVisiveis } = await import('../../src/database/seed');
    await seedMenusVisiveis(app.get(DRIZZLE).db);

    const depois = await request(srv()).get('/perfis').set('Cookie', adminCookies);
    expect(depois.body.find((p: { slug: string }) => p.slug === 'corte').menusVisiveis)
      .toEqual(MENUS_VISIVEIS_POR_PERFIL.corte);
  });

  it('menu visivel nao concede acesso a api', async () => {
    await request(srv()).put('/perfis/comercial/menus').set('Cookie', adminCookies)
      .send({ menus: [...MENUS_CANONICOS] });
    const negado = await request(srv()).get('/frota/caminhoes').set('Cookie', comercialCookies);
    expect(negado.status).toBe(403);
  });

  it('catalogo de permissoes cobre todo o mapa de descricoes', async () => {
    const res = await request(srv()).get('/perfis/catalogo').set('Cookie', adminCookies);
    expect(res.status).toBe(200);
    const codigos = res.body.grupos
      .flatMap((g: { permissoes: { codigo: string }[] }) => g.permissoes.map((p) => p.codigo))
      .sort();
    expect(codigos).toEqual(Object.keys(DESCRICOES_PERMISSOES).sort());
    expect(res.body.menus).toHaveLength(41);
  });
});
