import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { eq, and, isNull, sql } from 'drizzle-orm';
import { DRIZZLE } from '../../src/database/database.module';
import * as schema from '../../src/database/schema';
import { OperacoesService } from '../../src/modules/operacoes/operacoes.service';
import { createTestApp, cleanupDb, createTestUser, loginCookies } from '../helpers/test-app';

describe('operacoes e2e', () => {
  let app: INestApplication;
  let gestorCookies: string;
  let comercialCookies: string;

  beforeAll(async () => {
    app = await createTestApp();
    const gestor = await createTestUser(app, { perfil: 'gestor' });
    const comercial = await createTestUser(app, { perfil: 'comercial' });
    gestorCookies = await loginCookies(app, gestor.adminEmail, gestor.adminPassword);
    comercialCookies = await loginCookies(app, comercial.adminEmail, comercial.adminPassword);

    const { db } = app.get<{ db: typeof schema extends never ? never : import('drizzle-orm/node-postgres').NodePgDatabase<typeof schema> }>(DRIZZLE);
    const valorCadencia = {
      grupo: 'Operação',
      tipo: 'texto',
      titulo: 'Cadência de geração de Operações',
      texto: 'Segunda, quarta e sexta.',
      valor: '1,3,5',
      dias: [1, 3, 5],
      provisorio: true,
      pendencia: 'P1',
    };
    await db.insert(schema.parametros).values({
      chave: 'operacao.cadencia_dias_semana',
      descricao: 'Cadência de geração de Operações',
      valorJson: valorCadencia,
    }).onConflictDoUpdate({
      target: schema.parametros.chave,
      set: { valorJson: valorCadencia, deletedAt: null, updatedAt: new Date() },
    });
  });

  afterAll(async () => {
    await cleanupDb(app);
    await app.close();
  });

  it('unique ativa; gerar duas vezes cria zero na segunda execução', async () => {
    const de = '2026-08-03'; // segunda
    const ate = '2026-08-07'; // sexta
    const primeira = await request(app.getHttpServer())
      .post('/operacoes/gerar-cadencia')
      .set('Cookie', gestorCookies)
      .send({ de, ate });
    expect(primeira.status).toBe(201);
    expect(primeira.body.criadas).toBeGreaterThan(0);

    const segunda = await request(app.getHttpServer())
      .post('/operacoes/gerar-cadencia')
      .set('Cookie', gestorCookies)
      .send({ de, ate });
    expect(segunda.status).toBe(201);
    expect(segunda.body.criadas).toBe(0);

    const { db } = app.get(DRIZZLE) as { db: import('drizzle-orm/node-postgres').NodePgDatabase<typeof schema> };
    const contagem = await db.select({ total: sql<number>`count(*)::int` })
      .from(schema.operacoes)
      .where(and(isNull(schema.operacoes.deletedAt), eq(schema.operacoes.data, '2026-08-03')));
    expect(contagem[0]?.total).toBe(1);
  });

  it('comercial sem OPERACOES_GERENCIAR recebe 403', async () => {
    const res = await request(app.getHttpServer())
      .post('/operacoes/extraordinaria')
      .set('Cookie', comercialCookies)
      .send({ data: '2026-08-10', rotulo: 'Extra' });
    expect(res.status).toBe(403);
  });

  it('listar/detalhar/extraordinaria/status cobrem ciclo de vida', async () => {
    const data = '2026-08-14'; // sexta fora do intervalo do teste de cadência
    const criar = await request(app.getHttpServer())
      .post('/operacoes/extraordinaria')
      .set('Cookie', gestorCookies)
      .send({ data, rotulo: 'Operação extraordinária de teste' });
    expect(criar.status).toBe(201);
    expect(criar.body.extraordinaria).toBe(true);

    const duplicada = await request(app.getHttpServer())
      .post('/operacoes/extraordinaria')
      .set('Cookie', gestorCookies)
      .send({ data, rotulo: 'Duplicada' });
    expect(duplicada.status).toBe(409);

    const lista = await request(app.getHttpServer())
      .get('/operacoes')
      .query({ de: data, ate: data, status: 'aberta', pagina: 1, limite: 10 })
      .set('Cookie', gestorCookies);
    expect(lista.status).toBe(200);
    expect(lista.body.total).toBeGreaterThanOrEqual(1);
    expect(lista.body.page).toBe(1);
    expect(lista.body.pageSize).toBe(10);
    const encontrada = lista.body.data.find((o: { id: string }) => o.id === criar.body.id);
    expect(encontrada).toBeDefined();
    expect(typeof encontrada.comprasProgramadas).toBe('number');
    expect(typeof encontrada.pedidosVenda).toBe('number');
    expect(typeof encontrada.pendenciasOverbookingAbertas).toBe('number');
    for (let i = 1; i < lista.body.data.length; i++) {
      expect(lista.body.data[i - 1].data >= lista.body.data[i].data).toBe(true);
    }

    const detalhe = await request(app.getHttpServer())
      .get(`/operacoes/${criar.body.id}`)
      .set('Cookie', gestorCookies);
    expect(detalhe.status).toBe(200);
    expect(detalhe.body.id).toBe(criar.body.id);

    const inexistente = await request(app.getHttpServer())
      .get('/operacoes/019ea000-0000-7000-8000-0000000000aa')
      .set('Cookie', gestorCookies);
    expect(inexistente.status).toBe(404);

    const andamento = await request(app.getHttpServer())
      .patch(`/operacoes/${criar.body.id}/status`)
      .set('Cookie', gestorCookies)
      .send({ status: 'em_andamento' });
    expect(andamento.status).toBe(200);
    expect(andamento.body.status).toBe('em_andamento');

    const fechada = await request(app.getHttpServer())
      .patch(`/operacoes/${criar.body.id}/status`)
      .set('Cookie', gestorCookies)
      .send({ status: 'fechada' });
    expect(fechada.status).toBe(200);
    expect(fechada.body.status).toBe('fechada');

    const invalida = await request(app.getHttpServer())
      .patch(`/operacoes/${criar.body.id}/status`)
      .set('Cookie', gestorCookies)
      .send({ status: 'aberta' });
    expect(invalida.status).toBe(409);
  });

  it('filtra por status', async () => {
    const res = await request(app.getHttpServer())
      .get('/operacoes')
      .query({ status: 'aberta', pagina: 1, limite: 50 })
      .set('Cookie', gestorCookies);
    expect(res.status).toBe(200);
    for (const op of res.body.data) {
      expect(op.status).toBe('aberta');
    }
  });

  it('filtra por período', async () => {
    const res = await request(app.getHttpServer())
      .get('/operacoes')
      .query({ de: '2026-08-01', ate: '2026-08-07', pagina: 1, limite: 50 })
      .set('Cookie', gestorCookies);
    expect(res.status).toBe(200);
    for (const op of res.body.data) {
      expect(op.data >= '2026-08-01' && op.data <= '2026-08-07').toBe(true);
    }
  });

  it('filtra por extraordinaria', async () => {
    const res = await request(app.getHttpServer())
      .get('/operacoes')
      .query({ extraordinaria: 'true', pagina: 1, limite: 50 })
      .set('Cookie', gestorCookies);
    expect(res.status).toBe(200);
    for (const op of res.body.data) {
      expect(op.extraordinaria).toBe(true);
    }
  });

  it('traz contadores de compras, pedidos e pendências', async () => {
    const res = await request(app.getHttpServer())
      .get('/operacoes')
      .query({ pagina: 1, limite: 5 })
      .set('Cookie', gestorCookies);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    for (const op of res.body.data) {
      expect(op).toHaveProperty('comprasProgramadas');
      expect(op).toHaveProperty('pedidosVenda');
      expect(op).toHaveProperty('pendenciasOverbookingAbertas');
    }
  });

  it('resolverCorrente devolve a próxima não fechada', async () => {
    // As demais operações do arquivo usam datas fixas (2026-08-03..07); garante aqui uma
    // operação sempre no futuro para não depender da data em que o CI roda (evita a suíte
    // decair para a "última" operação, que outro teste pode ter fechado).
    const { db } = app.get(DRIZZLE) as { db: import('drizzle-orm/node-postgres').NodePgDatabase<typeof schema> };
    const dataFutura = new Date(Date.now() + 365 * 86_400_000).toISOString().slice(0, 10);
    await db.insert(schema.operacoes).values({
      data: dataFutura,
      diaSemana: new Date(`${dataFutura}T12:00:00Z`).getUTCDay(),
      rotulo: 'Operação futura (teste resolverCorrente)',
    });

    const service = app.get(OperacoesService);
    const corrente = await service.resolverCorrente();
    expect(corrente).toBeDefined();
    expect(corrente.status).not.toBe('fechada');
  });

  it('resolverCorrente lança OPERACAO_INEXISTENTE em base vazia', async () => {
    const { db } = app.get(DRIZZLE) as { db: import('drizzle-orm/node-postgres').NodePgDatabase<typeof schema> };
    await db.update(schema.operacoes).set({ deletedAt: new Date() });
    const service = app.get(OperacoesService);
    await expect(service.resolverCorrente()).rejects.toMatchObject({
      response: { message: 'OPERACAO_INEXISTENTE' },
    });
  });
});
