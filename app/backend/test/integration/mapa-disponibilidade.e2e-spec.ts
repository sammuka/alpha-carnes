import { INestApplication } from '@nestjs/common';
import { somarQtd } from '../../src/common/crud/decimal';
import { MapaService } from '../../src/modules/comercial/disponibilidade/mapa.service';
import type { MapaProduto } from '../../src/modules/comercial/disponibilidade/dto/mapa.dto';
import { createTestApp, cleanupDb, createTestUser, loginCookies } from '../helpers/test-app';
import { montarCenarioMapa, type CtxFixtureMapa } from '../helpers/onda4-fixtures';

describe('mapa de disponibilidade — Onda 4 (D17)', () => {
  let app: INestApplication;
  let cookies: string;
  let mapaService: MapaService;
  let ctx: CtxFixtureMapa;

  async function request() {
    return (await import('supertest')).default;
  }

  beforeAll(async () => {
    app = await createTestApp();
    mapaService = app.get(MapaService);
  }, 60000);

  afterAll(async () => {
    await cleanupDb(app);
    await app.close();
  });

  beforeEach(async () => {
    await cleanupDb(app);
    const admin = await createTestUser(app, { perfil: 'administrador' });
    cookies = await loginCookies(app, admin.adminEmail, admin.adminPassword);
    ctx = await montarCenarioMapa(app, cookies, { dataOperacao: '2026-08-01' });
  }, 60000);

  function linhaDoItem(mapa: MapaProduto[]): MapaProduto {
    const linha = mapa.find((l) => l.itemComercialId === ctx.itemComercialId);
    if (!linha) throw new Error('Item comercial da fixture não apareceu no mapa');
    return linha;
  }

  it('mapa agrega os oito estados F V R C D O E e ocorrencia', async () => {
    const req = await request();
    const res = await req(app.getHttpServer())
      .get(`/comercial/disponibilidade/mapa?operacaoId=${ctx.operacaoId}`)
      .set('Cookie', cookies);
    expect(res.status).toBe(200);
    const linha = linhaDoItem(res.body as MapaProduto[]);
    expect(Object.keys(linha.estados).sort()).toEqual(['!', 'C', 'D', 'E', 'F', 'O', 'R', 'V'].sort());
    for (const estado of ['F', 'V', 'R', 'C', 'D', 'O', 'E', '!'] as const) {
      expect(linha.estados[estado]).toBeDefined();
      expect(linha.unidades[estado]).toBeDefined();
    }
  });

  it('deriva cada estado da tabela de origem correta', async () => {
    const mapa = await mapaService.consultar(ctx.operacaoId);
    const linha = linhaDoItem(mapa);

    expect(linha.unidades.F).toBe(1);
    expect(linha.estados.F).toBe('15.000');

    expect(linha.unidades.D).toBe(1);
    expect(linha.estados.D).toBe('8.000');

    expect(linha.unidades['!']).toBe(1);
    expect(linha.estados['!']).toBe('5.000');

    expect(linha.unidades.R).toBe(0);
    expect(linha.estados.R).toBe('50.000');

    expect(linha.unidades.C).toBe(0);
    expect(linha.estados.C).toBe('50.000');

    expect(linha.unidades.O).toBe(0);
    expect(linha.estados.O).toBe('40.000');

    expect(linha.estados.V).toBe('0.000');

    // Estado E: peça conferida + subitem em carga contam; a peça removida não conta.
    expect(linha.unidades.E).toBe(2);
    expect(linha.estados.E).toBe(somarQtd(ctx.pesoPecaConferida, ctx.pesoSubitemEmCarga));
  });

  it('drill-down devolve as unidades reais do estado selecionado', async () => {
    const req = await request();
    const res = await req(app.getHttpServer())
      .get(`/comercial/disponibilidade/mapa/${ctx.itemComercialId}/detalhe`)
      .query({ operacaoId: ctx.operacaoId, estado: 'E' })
      .set('Cookie', cookies);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(2);

    const restoDetalheF = await req(app.getHttpServer())
      .get(`/comercial/disponibilidade/mapa/${ctx.itemComercialId}/detalhe`)
      .query({ operacaoId: ctx.operacaoId, estado: 'F' })
      .set('Cookie', cookies);
    expect(restoDetalheF.status).toBe(200);
    expect(restoDetalheF.body.length).toBe(1);
    expect(restoDetalheF.body[0].peso_original).toBe('15.000');
  });
});
