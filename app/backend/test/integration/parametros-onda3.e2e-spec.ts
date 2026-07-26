import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, cleanupDb, createTestUser, loginCookies } from '../helpers/test-app';
import { DRIZZLE } from '../../src/database/database.module';

const CHAVES = [
  'comercial.overbooking_permitido', 'comercial.prioridade_consumo', 'operacao.fifo_estoque',
  'operacao.cadencia_dias_semana', 'operacao.composicao_boi_casado', 'operacao.regras_transformacao_tz',
  'fiscal.seguro_integrado', 'fiscal.emissao_fiscal', 'fiscal.expiracao_reserva_rascunho',
];

describe('Parametros Onda 3 e2e', () => {
  let app: INestApplication;
  let adminCookies: string;

  beforeAll(async () => {
    app = await createTestApp();
    const admin = await createTestUser(app, { perfil: 'administrador' });
    adminCookies = await loginCookies(app, admin.adminEmail, admin.adminPassword);
  });

  afterAll(async () => {
    await cleanupDb(app);
    await app.close();
  });

  const srv = () => app.getHttpServer();

  it('seed cria as 9 chaves de parametro da v1.1 com AD-01, AD-02 e AD-06 honradas', async () => {
    const { seedParametros } = await import('../../src/database/seed');
    await seedParametros(app.get(DRIZZLE).db);

    const lista = await request(srv()).get('/parametros?pageSize=100').set('Cookie', adminCookies);
    const chaves = lista.body.data.map((p: { chave: string }) => p.chave);
    for (const chave of CHAVES) expect(chaves).toContain(chave);

    const porChave = (chave: string) =>
      lista.body.data.find((p: { chave: string }) => p.chave === chave).valorJson as {
        texto: string; provisorio: boolean; pendencia: string | null; tipo: string;
        valor?: unknown; dias?: number[];
      };

    // Cadência: cartão P1 + array `dias` consumido por gerar-cadencia.
    const cadencia = porChave('operacao.cadencia_dias_semana');
    expect(cadencia.tipo).toBe('texto');
    expect(cadencia.valor).toBe('1,3,5');
    expect(cadencia.dias).toEqual([1, 3, 5]);
    expect(cadencia.provisorio).toBe(true);
    expect(cadencia.pendencia).toBe('P1');

    // AD-01: composição confirmada — sem badge Provisório.
    const boi = porChave('operacao.composicao_boi_casado');
    expect(boi.texto).toContain('2 TZ + 2 DT + 2 PA');
    expect(boi.provisorio).toBe(false);
    expect(boi.pendencia).toBeNull();

    // AD-02: emissão fiscal decidida — nota de homologação no lugar do badge.
    const fiscal = porChave('fiscal.emissao_fiscal');
    expect(fiscal.provisorio).toBe(false);
    expect(fiscal.texto).toContain('aguardando homologação');

    // AD-06: sem TTL de reserva — cartão informativo, não parâmetro pendente.
    const reserva = porChave('fiscal.expiracao_reserva_rascunho');
    expect(reserva.provisorio).toBe(false);
    expect(reserva.tipo).toBe('info');
    expect(reserva.texto).toContain('Sem expiração automática');

    const provisorios = lista.body.data
      .filter(
        (p: { chave: string; valorJson: { provisorio?: boolean } }) =>
          CHAVES.includes(p.chave) && p.valorJson.provisorio === true,
      )
      .map((p: { chave: string; valorJson: { pendencia: string } }) => [p.chave, p.valorJson.pendencia])
      .sort();
    expect(provisorios).toEqual([
      ['operacao.cadencia_dias_semana', 'P1'],
      ['operacao.regras_transformacao_tz', 'P12'],
    ]);
  });

  it('atualiza parametro por chave, audita e 404 em chave desconhecida', async () => {
    const patch = await request(srv())
      .patch('/parametros/chave/fiscal.seguro_integrado').set('Cookie', adminCookies)
      .send({ valorJson: { grupo: 'Fiscal', tipo: 'toggle', titulo: 'Seguro integrado', texto: 'x', valor: true, provisorio: false, pendencia: null } });
    expect(patch.status).toBe(200);
    expect(patch.body.valorJson.valor).toBe(true);

    const log = await request(srv())
      .get('/auditoria?tabela=parametros&operacao=UPDATE').set('Cookie', adminCookies);
    expect(log.body.total).toBeGreaterThanOrEqual(1);

    const inexistente = await request(srv())
      .patch('/parametros/chave/nao.existe').set('Cookie', adminCookies).send({ valorJson: {} });
    expect(inexistente.status).toBe(404);
  });
});
