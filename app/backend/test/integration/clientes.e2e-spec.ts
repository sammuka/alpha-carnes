import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../src/database/schema';
import { DRIZZLE } from '../../src/database/database.module';
import { createTestApp, cleanupDb, createTestUser, loginCookies } from '../helpers/test-app';

// CNPJ e CPF válidos (dígito verificador correto), usados nos cenários.
const CNPJ_VALIDO = '11222333000181';
const CPF_VALIDO = '52998224725';

describe('Clientes e2e (CRUD + RBAC + validação + soft delete + auditoria)', () => {
  let app: INestApplication;
  let adminCookies: string;
  let comercialCookies: string;

  beforeAll(async () => {
    app = await createTestApp();
    const admin = await createTestUser(app, { perfil: 'administrador' });
    const comercial = await createTestUser(app, { perfil: 'comercial' });
    adminCookies = await loginCookies(app, admin.adminEmail, admin.adminPassword);
    comercialCookies = await loginCookies(app, comercial.adminEmail, comercial.adminPassword);
  });

  afterAll(async () => {
    await cleanupDb(app);
    await app.close();
  });

  const novoCliente = (over: Record<string, unknown> = {}) => ({
    codigo: `CLI-${Math.floor(performance.now() * 1000)}-${Math.round(performance.timeOrigin)}`,
    razaoSocial: 'Cliente Teste LTDA',
    documentoFiscal: CNPJ_VALIDO,
    ...over,
  });

  describe('RBAC', () => {
    it('comercial (sem CLIENTES_GERENCIAR) recebe 403 ao criar', async () => {
      const res = await request(app.getHttpServer())
        .post('/clientes')
        .set('Cookie', comercialCookies)
        .send(novoCliente({ codigo: 'CLI-RBAC-1' }));
      expect(res.status).toBe(403);
      expect(res.body).not.toHaveProperty('success', true);
    });

    it('comercial (com CLIENTES_LER) consegue listar', async () => {
      const res = await request(app.getHttpServer()).get('/clientes').set('Cookie', comercialCookies);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('sem autenticação recebe 401', async () => {
      const res = await request(app.getHttpServer()).get('/clientes');
      expect(res.status).toBe(401);
    });
  });

  describe('Validação (Zod) — documento fiscal e unicidade', () => {
    it('rejeita documento fiscal inválido com 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/clientes')
        .set('Cookie', adminCookies)
        .send(novoCliente({ codigo: 'CLI-INV', documentoFiscal: '11222333000182' }));
      expect(res.status).toBe(400);
    });

    it('aceita CPF válido como documento fiscal', async () => {
      const res = await request(app.getHttpServer())
        .post('/clientes')
        .set('Cookie', adminCookies)
        .send(novoCliente({ codigo: 'CLI-CPF', documentoFiscal: CPF_VALIDO }));
      expect(res.status).toBe(201);
      expect(res.body.documentoFiscal).toBe(CPF_VALIDO);
    });

    it('rejeita documento fiscal duplicado com 409', async () => {
      const doc = '04252011000110';
      await request(app.getHttpServer())
        .post('/clientes')
        .set('Cookie', adminCookies)
        .send(novoCliente({ codigo: 'CLI-DUP-A', documentoFiscal: doc }));
      const res = await request(app.getHttpServer())
        .post('/clientes')
        .set('Cookie', adminCookies)
        .send(novoCliente({ codigo: 'CLI-DUP-B', documentoFiscal: doc }));
      expect(res.status).toBe(409);
    });

    it('rejeita código duplicado com 409', async () => {
      await request(app.getHttpServer())
        .post('/clientes')
        .set('Cookie', adminCookies)
        .send(novoCliente({ codigo: 'CLI-CODE-DUP', documentoFiscal: '34028316000103' }));
      const res = await request(app.getHttpServer())
        .post('/clientes')
        .set('Cookie', adminCookies)
        .send(novoCliente({ codigo: 'CLI-CODE-DUP', documentoFiscal: '33000167000101' }));
      expect(res.status).toBe(409);
    });
  });

  describe('CRUD + soft delete + restore', () => {
    it('cria, detalha, edita, remove (soft) e restaura', async () => {
      const criar = await request(app.getHttpServer())
        .post('/clientes')
        .set('Cookie', adminCookies)
        .send(novoCliente({ codigo: 'CLI-CRUD', documentoFiscal: '45283163000167', razaoSocial: 'Antiga SA' }));
      expect(criar.status).toBe(201);
      const id = criar.body.id;

      const detalhar = await request(app.getHttpServer()).get(`/clientes/${id}`).set('Cookie', adminCookies);
      expect(detalhar.status).toBe(200);

      const editar = await request(app.getHttpServer())
        .patch(`/clientes/${id}`)
        .set('Cookie', adminCookies)
        .send({ razaoSocial: 'Nova SA' });
      expect(editar.status).toBe(200);
      expect(editar.body.razaoSocial).toBe('Nova SA');

      const remover = await request(app.getHttpServer()).delete(`/clientes/${id}`).set('Cookie', adminCookies);
      expect(remover.status).toBe(200);

      // Soft delete: não aparece na listagem padrão e detalhar dá 404.
      const detalharRemovido = await request(app.getHttpServer())
        .get(`/clientes/${id}`)
        .set('Cookie', adminCookies);
      expect(detalharRemovido.status).toBe(404);

      const restaurar = await request(app.getHttpServer())
        .post(`/clientes/${id}/restaurar`)
        .set('Cookie', adminCookies);
      expect(restaurar.status).toBe(201);

      const detalharRestaurado = await request(app.getHttpServer())
        .get(`/clientes/${id}`)
        .set('Cookie', adminCookies);
      expect(detalharRestaurado.status).toBe(200);
    });

    it('não faz DELETE físico (registro permanece com deleted_at preenchido)', async () => {
      const criar = await request(app.getHttpServer())
        .post('/clientes')
        .set('Cookie', adminCookies)
        .send(novoCliente({ codigo: 'CLI-SOFT', documentoFiscal: '60746948000112' }));
      const id = criar.body.id;
      await request(app.getHttpServer()).delete(`/clientes/${id}`).set('Cookie', adminCookies);

      const { db } = app.get<{ db: NodePgDatabase<typeof schema> }>(DRIZZLE);
      const rows = await db.execute(sql`SELECT deleted_at FROM clientes WHERE id = ${id}`);
      expect(rows.rows.length).toBe(1);
      expect(rows.rows[0]?.deleted_at).not.toBeNull();
    });

    it('restauração exige CLIENTES_GERENCIAR — comercial recebe 403', async () => {
      const criar = await request(app.getHttpServer())
        .post('/clientes')
        .set('Cookie', adminCookies)
        .send(novoCliente({ codigo: 'CLI-REST-403', documentoFiscal: '07526557000100' }));
      const id = criar.body.id;
      await request(app.getHttpServer()).delete(`/clientes/${id}`).set('Cookie', adminCookies);

      const res = await request(app.getHttpServer())
        .post(`/clientes/${id}/restaurar`)
        .set('Cookie', comercialCookies);
      expect(res.status).toBe(403);
    });
  });

  describe('Update com todos os campos (cobre os ramos de override)', () => {
    it('atualiza todos os campos opcionais de uma vez', async () => {
      const criar = await request(app.getHttpServer())
        .post('/clientes')
        .set('Cookie', adminCookies)
        .send(novoCliente({ codigo: 'CLI-FULL', documentoFiscal: '50000004000148' }));
      const id = criar.body.id;

      const editar = await request(app.getHttpServer())
        .patch(`/clientes/${id}`)
        .set('Cookie', adminCookies)
        .send({
          codigo: 'CLI-FULL-2',
          razaoSocial: 'Razão Nova',
          nomeFantasia: 'Fantasia',
          documentoFiscal: '50000005000192',
          status: 'inativo',
          prioridade: 'alta',
          preferenciasJson: { prefereMaisPesada: true },
          dadosFiscaisJson: { cidade: 'Osasco' },
          dadosContatoJson: { email: 'c@c.com' },
          observacoesOperacionais: 'obs',
        });
      expect(editar.status).toBe(200);
      expect(editar.body.codigo).toBe('CLI-FULL-2');
      expect(editar.body.status).toBe('inativo');
      expect(editar.body.preferenciasJson).toEqual({ prefereMaisPesada: true });
    });

    it('cria cliente com todos os campos JSONB preenchidos (cobre ramos de default)', async () => {
      const res = await request(app.getHttpServer())
        .post('/clientes')
        .set('Cookie', adminCookies)
        .send(
          novoCliente({
            codigo: 'CLI-JSONB',
            documentoFiscal: '50000006000137',
            nomeFantasia: 'NF',
            status: 'ativo',
            prioridade: 'baixa',
            preferenciasJson: { aceitaSubstituicao: false },
            dadosFiscaisJson: { uf: 'SP' },
            dadosContatoJson: { nome: 'Contato' },
            observacoesOperacionais: 'obs2',
          }),
        );
      expect(res.status).toBe(201);
      expect(res.body.preferenciasJson).toEqual({ aceitaSubstituicao: false });
    });

    it('detalhar inexistente → 404; editar inexistente → 404', async () => {
      const inex = '019e9e00-0000-7000-8000-000000000999';
      expect((await request(app.getHttpServer()).get(`/clientes/${inex}`).set('Cookie', adminCookies)).status).toBe(404);
      expect(
        (
          await request(app.getHttpServer())
            .patch(`/clientes/${inex}`)
            .set('Cookie', adminCookies)
            .send({ razaoSocial: 'x' })
        ).status,
      ).toBe(404);
    });

    it('listagem com filtro de busca retorna resultados', async () => {
      const res = await request(app.getHttpServer())
        .get('/clientes?search=Razão&page=1&pageSize=5')
        .set('Cookie', adminCookies);
      expect(res.status).toBe(200);
      expect(res.body.pageSize).toBe(5);
    });

    it('listagem com incluirRemovidos=true cobre o ramo de removidos', async () => {
      const res = await request(app.getHttpServer())
        .get('/clientes?incluirRemovidos=true')
        .set('Cookie', adminCookies);
      expect(res.status).toBe(200);
    });
  });

  describe('Auditoria (antes/depois)', () => {
    it('cada mutação grava registro com dados anteriores/novos', async () => {
      const criar = await request(app.getHttpServer())
        .post('/clientes')
        .set('Cookie', adminCookies)
        .send(novoCliente({ codigo: 'CLI-AUDIT', documentoFiscal: '19131243000197', razaoSocial: 'Audit V1' }));
      const id = criar.body.id;

      await request(app.getHttpServer())
        .patch(`/clientes/${id}`)
        .set('Cookie', adminCookies)
        .send({ razaoSocial: 'Audit V2' });

      const { db } = app.get<{ db: NodePgDatabase<typeof schema> }>(DRIZZLE);
      const rows = await db.execute(
        sql`SELECT operacao, dados_anteriores, dados_novos FROM auditoria
            WHERE tabela = 'clientes' AND registro_id = ${id} ORDER BY created_at ASC`,
      );
      const insert = rows.rows.find((r) => r.operacao === 'INSERT');
      const update = rows.rows.find((r) => r.operacao === 'UPDATE');

      expect(insert).toBeDefined();
      expect((insert!.dados_novos as { razaoSocial: string }).razaoSocial).toBe('Audit V1');

      expect(update).toBeDefined();
      expect((update!.dados_anteriores as { razaoSocial: string }).razaoSocial).toBe('Audit V1');
      expect((update!.dados_novos as { razaoSocial: string }).razaoSocial).toBe('Audit V2');
    });
  });
});
