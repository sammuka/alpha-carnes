import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, cleanupDb, createTestUser, loginCookies } from '../helpers/test-app';

/**
 * ADR-008 / B1: a resolução de permissões vem do banco (perfis_permissoes). Editar as
 * permissões de um perfil altera o acesso efetivo no PRÓXIMO login (as permissões viajam
 * no access token — sem invalidação ativa nesta fase, ADR-008 §4).
 */
describe('Perfis e2e — gestão de permissões em runtime (ADR-008)', () => {
  let app: INestApplication;
  let adminCookies: string;

  beforeAll(async () => {
    app = await createTestApp();
    const admin = await createTestUser(app, { perfil: 'administrador' });
    // 'comercial' começa sem CLIENTES_GERENCIAR (apenas leituras).
    await createTestUser(app, { perfil: 'comercial' });
    adminCookies = await loginCookies(app, admin.adminEmail, admin.adminPassword);
  });

  afterAll(async () => {
    await cleanupDb(app);
    await app.close();
  });

  it('admin lista perfis com suas permissões', async () => {
    const res = await request(app.getHttpServer()).get('/perfis').set('Cookie', adminCookies);
    expect(res.status).toBe(200);
    const comercial = (res.body as Array<{ slug: string; permissoes: string[] }>).find(
      (p) => p.slug === 'comercial',
    );
    expect(comercial).toBeDefined();
    expect(comercial!.permissoes).not.toContain('CLIENTES_GERENCIAR');
  });

  it('rejeita permissões desconhecidas com 400, sem alterar o perfil', async () => {
    const res = await request(app.getHttpServer())
      .put('/perfis/comercial/permissoes')
      .set('Cookie', adminCookies)
      .send({ permissoes: ['PERMISSAO_INEXISTENTE'] });
    expect(res.status).toBe(400);
  });

  it('retorna 404 ao definir permissões de perfil inexistente', async () => {
    const res = await request(app.getHttpServer())
      .put('/perfis/perfil_que_nao_existe/permissoes')
      .set('Cookie', adminCookies)
      .send({ permissoes: ['CLIENTES_LER'] });
    expect(res.status).toBe(404);
  });

  it('aceita lista vazia de permissões (remove todas do perfil)', async () => {
    const res = await request(app.getHttpServer())
      .put('/perfis/conferente/permissoes')
      .set('Cookie', adminCookies)
      .send({ permissoes: [] });
    expect(res.status).toBe(200);
    expect(res.body.permissoes).toEqual([]);
  });

  it('adicionar CLIENTES_GERENCIAR ao perfil concede acesso no PRÓXIMO login (403 → 201)', async () => {
    // Novo usuário comercial, login inicial sem CLIENTES_GERENCIAR.
    const userA = await createTestUser(app, { perfil: 'comercial' });
    const cookiesAntes = await loginCookies(app, userA.adminEmail, userA.adminPassword);

    const negadoAntes = await request(app.getHttpServer())
      .post('/clientes')
      .set('Cookie', cookiesAntes)
      .send({ codigo: 'CLI-PROP-1', razaoSocial: 'Prop', documentoFiscal: '11222333000181' });
    expect(negadoAntes.status).toBe(403);

    // Concede CLIENTES_LER + CLIENTES_GERENCIAR ao perfil comercial.
    const update = await request(app.getHttpServer())
      .put('/perfis/comercial/permissoes')
      .set('Cookie', adminCookies)
      .send({ permissoes: ['CLIENTES_LER', 'CLIENTES_GERENCIAR'] });
    expect(update.status).toBe(200);

    // Token antigo ainda nega (permissões viajam no token — sem invalidação ativa).
    const aindaNegado = await request(app.getHttpServer())
      .post('/clientes')
      .set('Cookie', cookiesAntes)
      .send({ codigo: 'CLI-PROP-2', razaoSocial: 'Prop', documentoFiscal: '04252011000110' });
    expect(aindaNegado.status).toBe(403);

    // Novo login → novas permissões → acesso concedido.
    const cookiesDepois = await loginCookies(app, userA.adminEmail, userA.adminPassword);
    const permitidoDepois = await request(app.getHttpServer())
      .post('/clientes')
      .set('Cookie', cookiesDepois)
      .send({ codigo: 'CLI-PROP-3', razaoSocial: 'Prop', documentoFiscal: '34028316000103' });
    expect(permitidoDepois.status).toBe(201);
  });

  it('remover permissão do perfil revoga o acesso no PRÓXIMO login (200/201 → 403)', async () => {
    const userB = await createTestUser(app, { perfil: 'logistica' });
    // Concede gerência de clientes ao logistica e loga.
    await request(app.getHttpServer())
      .put('/perfis/logistica/permissoes')
      .set('Cookie', adminCookies)
      .send({ permissoes: ['CLIENTES_LER', 'CLIENTES_GERENCIAR'] });
    const cookiesComAcesso = await loginCookies(app, userB.adminEmail, userB.adminPassword);
    const permitido = await request(app.getHttpServer())
      .post('/clientes')
      .set('Cookie', cookiesComAcesso)
      .send({ codigo: 'CLI-REV-1', razaoSocial: 'Rev', documentoFiscal: '33000167000101' });
    expect(permitido.status).toBe(201);

    // Remove a gerência (mantém só leitura).
    await request(app.getHttpServer())
      .put('/perfis/logistica/permissoes')
      .set('Cookie', adminCookies)
      .send({ permissoes: ['CLIENTES_LER'] });

    // Próximo login → sem gerência → 403.
    const cookiesSemAcesso = await loginCookies(app, userB.adminEmail, userB.adminPassword);
    const negado = await request(app.getHttpServer())
      .post('/clientes')
      .set('Cookie', cookiesSemAcesso)
      .send({ codigo: 'CLI-REV-2', razaoSocial: 'Rev', documentoFiscal: '60746948000112' });
    expect(negado.status).toBe(403);
  });
});
