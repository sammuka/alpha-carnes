import { INestApplication } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import request from 'supertest';
import { createTestApp, cleanupDb, createTestUser, loginCookies } from '../helpers/test-app';
import { DRIZZLE } from '../../src/database/database.module';
import * as schema from '../../src/database/schema';
import { centrosCusto, contasContabeis } from '../../src/database/schema/contabilidade-plano.schema';
import {
  politicasContabilizacao,
  politicaVersoes,
  politicaSimulacoes,
} from '../../src/database/schema/contabilidade-politicas.schema';
import { PlanoContasService } from '../../src/modules/contabilidade/plano/plano.service';
import type { CriarContaDto } from '../../src/modules/contabilidade/plano/dto/plano.dto';
import { PoliticasContabilizacaoService } from '../../src/modules/contabilidade/politicas/politicas.service';
import type { ConfigurarPoliticaDto } from '../../src/modules/contabilidade/politicas/dto/politicas.dto';

function dtoConta(parcial: Partial<CriarContaDto>): CriarContaDto {
  return {
    codigo: '1',
    nome: 'Caixa e bancos',
    classificacao: 'sintetica',
    natureza: 'ATIVO',
    grupo: 'Circulante',
    contaPaiCodigo: null,
    centroCodigo: 'CT1',
    vigenciaInicio: '2026-10-01',
    vigenciaFim: null,
    justificativa: 'abertura',
    ...parcial,
  };
}

function dtoConfigurar(parcial: Partial<ConfigurarPoliticaDto> = {}): ConfigurarPoliticaDto {
  return {
    tipoEvento: 'LIQUIDACAO',
    competencia: '2026-10',
    contaDebitoCodigo: '1.1.01',
    contaCreditoCodigo: '2.1.01',
    centroCodigo: 'CT1',
    vigenciaInicio: '2026-10-01',
    justificativa: 'abre a regra',
    ...parcial,
  };
}

describe('Políticas de contabilização', () => {
  let app: INestApplication;
  let db: NodePgDatabase<typeof schema>;
  let adminId: string;
  let autorId: string;
  let outraPessoaId: string;
  let plano: PlanoContasService;
  let service: PoliticasContabilizacaoService;
  let adminCookies: string;
  let comercialCookies: string;

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get<{ db: NodePgDatabase<typeof schema> }>(DRIZZLE).db;
    const admin = await createTestUser(app, { perfil: 'administrador' });
    const [usuario] = await db.select().from(schema.usuarios).where(eq(schema.usuarios.email, admin.adminEmail));
    if (!usuario) throw new Error('admin ausente');
    adminId = usuario.id;
    autorId = usuario.id;
    const outra = await createTestUser(app, { perfil: 'administrador' });
    const [pessoa] = await db.select().from(schema.usuarios).where(eq(schema.usuarios.email, outra.adminEmail));
    if (!pessoa) throw new Error('segunda pessoa ausente');
    outraPessoaId = pessoa.id;
    plano = app.get(PlanoContasService);
    service = app.get(PoliticasContabilizacaoService);
    const comercial = await createTestUser(app, { perfil: 'comercial' });
    adminCookies = await loginCookies(app, admin.adminEmail, admin.adminPassword);
    comercialCookies = await loginCookies(app, comercial.adminEmail, comercial.adminPassword);
  });

  const srv = () => app.getHttpServer();

  beforeEach(async () => {
    await db.execute(sql`delete from politica_simulacoes`);
    await db.execute(sql`delete from politica_versoes`);
    await db.execute(sql`delete from politicas_contabilizacao`);
  });

  afterAll(async () => {
    await cleanupDb(app);
    await app.close();
  });

  async function limparPlano() {
    await db.execute(sql`delete from conta_versoes`);
    await db.execute(sql`delete from contas_contabeis`);
    await db.execute(sql`delete from centros_custo`);
  }

  async function aprovarDireto(codigo: string) {
    await db.execute(sql`
      update conta_versoes v
         set situacao = 'APPROVED'
        from contas_contabeis c
       where v.conta_id = c.id
         and c.codigo = ${codigo}
         and v.numero = 1
    `);
  }

  async function prepararContasAnaliticas() {
    await limparPlano();
    await plano.criarCentro({ codigo: 'CT1', nome: 'Operação industrial', justificativa: 'abre centro' }, autorId);
    await plano.criar(dtoConta({ codigo: '1', classificacao: 'sintetica', contaPaiCodigo: null, nome: 'Ativo' }), autorId);
    await aprovarDireto('1');
    await plano.criar(dtoConta({ codigo: '1.1.01', classificacao: 'analitica', contaPaiCodigo: '1', nome: 'Caixa' }), autorId);
    await aprovarDireto('1.1.01');
    await plano.criar(dtoConta({ codigo: '2', classificacao: 'sintetica', contaPaiCodigo: null, nome: 'Passivo', natureza: 'PASSIVO' }), autorId);
    await aprovarDireto('2');
    await plano.criar(dtoConta({ codigo: '2.1.01', classificacao: 'analitica', contaPaiCodigo: '2', nome: 'Fornecedores', natureza: 'PASSIVO' }), autorId);
    await aprovarDireto('2.1.01');
  }

  async function prepararContaSinteticaAprovada(codigo: string) {
    await limparPlano();
    await plano.criarCentro({ codigo: 'CT1', nome: 'Operação industrial', justificativa: 'abre centro' }, autorId);
    await plano.criar(dtoConta({ codigo, classificacao: 'sintetica', contaPaiCodigo: null }), autorId);
    await aprovarDireto(codigo);
  }

  async function novaVersaoDaConta(codigo: string, numero: number, situacao: 'SUSPENDED' | 'DRAFT' | 'REVIEW' | 'REJECTED') {
    await db.execute(sql`
      insert into conta_versoes (conta_id, numero, nome, classificacao, natureza, grupo, conta_pai_id,
                                 centro_custo_id, vigencia_inicio, vigencia_fim, situacao, justificativa, responsavel_id)
      select v.conta_id, ${numero}, v.nome, v.classificacao, v.natureza, v.grupo, v.conta_pai_id,
             v.centro_custo_id, v.vigencia_inicio, v.vigencia_fim, ${situacao}, 'caso de teste', v.responsavel_id
        from conta_versoes v
        join contas_contabeis c on c.id = v.conta_id
       where c.codigo = ${codigo} and v.numero = 1
    `);
  }

  it('recusa tipo fora do enum, competência fora do dia 01 e simulação desbalanceada', async () => {
    await limparPlano();
    const centro = await db.insert(centrosCusto).values({ codigo: 'CT1', nome: 'Operação industrial' }).returning();
    const debito = await db.insert(contasContabeis).values({ codigo: '1.1.01' }).returning();
    const credito = await db.insert(contasContabeis).values({ codigo: '2.1.01' }).returning();
    const politica = await db.insert(politicasContabilizacao).values({
      codigo: 'LIQUIDACAO-2026-10',
      tipoEvento: 'LIQUIDACAO',
      competencia: '2026-10-01',
    }).returning();
    await expect(db.insert(politicasContabilizacao).values({
      codigo: 'OUTRO-2026-10',
      tipoEvento: 'COMPRA',
      competencia: '2026-10-01',
    })).rejects.toThrow();
    await expect(db.insert(politicasContabilizacao).values({
      codigo: 'LIQUIDACAO-2026-11',
      tipoEvento: 'LIQUIDACAO',
      competencia: '2026-11-15',
    })).rejects.toThrow();
    const versao = await db.insert(politicaVersoes).values({
      politicaId: politica[0].id,
      numero: 1,
      contaDebitoId: debito[0].id,
      contaCreditoId: credito[0].id,
      centroCustoId: centro[0].id,
      vigenciaInicio: '2026-10-01',
      situacao: 'DRAFT',
      justificativa: 'abre',
      responsavelId: adminId,
    }).returning();
    await expect(db.insert(politicaSimulacoes).values({
      politicaId: politica[0].id,
      versaoNumero: versao[0].numero,
      valor: '10.00',
      debito: '10.00',
      credito: '10.01',
    })).rejects.toThrow();
  });

  it('recusa evento duplicado e não grava a segunda política', async () => {
    await prepararContasAnaliticas();
    await service.configurar(dtoConfigurar(), autorId);
    await expect(service.configurar(dtoConfigurar(), autorId)).rejects.toMatchObject({
      status: 409,
      response: { message: 'evento duplicado', codigo: 'LIQUIDACAO-2026-10' },
    });
    const lista = await service.listar({ pagina: 1, q: '', situacao: '', competencia: '', ordenar: 'competencia', direcao: 'asc' });
    expect(lista.total).toBe(1);
  });

  it('não troca o tipo de ocorrência e mantém a origem', async () => {
    await prepararContasAnaliticas();
    const politica = await service.configurar(dtoConfigurar(), autorId);
    await expect(service.editar(politica.codigo, {
      numero: 1,
      tipoEvento: 'TARIFA',
      competencia: '2026-10',
      contaDebitoCodigo: '1.1.01',
      contaCreditoCodigo: '2.1.01',
      centroCodigo: 'CT1',
      vigenciaInicio: '2026-10-01',
      justificativa: 'tenta trocar a origem',
    }, autorId)).rejects.toMatchObject({
      status: 422,
      response: { message: 'origem imutável', codigo: 'LIQUIDACAO-2026-10' },
    });
    expect((await service.obter(politica.codigo)).tipoEvento).toBe('LIQUIDACAO');
  });

  it('recusa conta sintética como mapeamento ausente', async () => {
    await prepararContaSinteticaAprovada('1');
    await expect(service.configurar(dtoConfigurar({ contaDebitoCodigo: '1' }), autorId)).rejects.toMatchObject({
      status: 422,
      response: { message: 'mapeamento ausente', codigo: 'LIQUIDACAO-2026-10' },
    });
    expect((await service.listar({ pagina: 1, q: '', situacao: '', competencia: '', ordenar: 'competencia', direcao: 'asc' })).total).toBe(0);
  });

  it('simular não grava diário, razão nem partida', async () => {
    await prepararContasAnaliticas();
    const politica = await service.configurar(dtoConfigurar(), autorId);
    const saida = await service.simular(politica.codigo, {
      numero: 1,
      valor: '10.10',
      justificativa: 'simula',
    }, autorId);
    expect(saida.simulacaoDebito).toBe('10.10');
    expect(saida.simulacaoCredito).toBe('10.10');
    expect(saida.situacao).toBe('DRAFT');
    for (const nome of ['lancamentos_contabeis', 'diario_contabil', 'razao_contabil', 'partidas_contabeis']) {
      const tabelas = await db.execute(sql`select to_regclass(${'public.' + nome}) as nome`);
      expect(tabelas.rows[0].nome).toBeNull();
    }
  });

  it('não aprova sem mapeamento simulado', async () => {
    await prepararContasAnaliticas();
    const politica = await service.configurar(dtoConfigurar(), autorId);
    await expect(service.aprovar(politica.codigo, { numero: 1, justificativa: 'aprova' }, outraPessoaId))
      .rejects.toMatchObject({ status: 422, response: { message: 'mapeamento ausente', codigo: politica.codigo } });
    expect((await service.obter(politica.codigo)).situacao).toBe('DRAFT');
  });

  it('o autor não aprova a própria regra', async () => {
    await prepararContasAnaliticas();
    const politica = await service.configurar(dtoConfigurar(), autorId);
    await service.simular(politica.codigo, { numero: 1, valor: '10.00', justificativa: 'simula' }, autorId);
    await expect(service.aprovar(politica.codigo, { numero: 1, justificativa: 'eu mesmo' }, autorId))
      .rejects.toMatchObject({
        status: 422,
        response: { message: 'aprovador diferente do autor', codigo: politica.codigo },
      });
    expect((await service.obter(politica.codigo)).situacao).toBe('DRAFT');
  });

  it('nega a política a um perfil que não é administrador', async () => {
    const res = await request(srv()).get('/contabilidade/politicas').set('Cookie', comercialCookies);
    expect(res.status).toBe(403);
  });

  it('não devolve uuid na listagem', async () => {
    const res = await request(srv()).get('/contabilidade/politicas').set('Cookie', adminCookies);
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i,
    );
  });

  it('devolve 422 com message e codigo quando o mapeamento não existe', async () => {
    const res = await request(srv()).post('/contabilidade/politicas').set('Cookie', adminCookies).send({
      tipoEvento: 'LIQUIDACAO',
      competencia: '2026-10',
      contaDebitoCodigo: 'nao-existe',
      contaCreditoCodigo: 'tambem-nao',
      centroCodigo: 'CT1',
      vigenciaInicio: '2026-10-01',
      justificativa: 'tenta',
    });
    expect(res.status).toBe(422);
    expect(res.body).toEqual({
      statusCode: 422,
      message: { message: 'mapeamento ausente', codigo: 'LIQUIDACAO-2026-10' },
      timestamp: expect.any(String),
      path: '/contabilidade/politicas',
      requestId: 'unknown',
    });
  });

describe('entrada inválida responde 400 e não grava', () => {
  const corpo = {
    tipoEvento: 'LIQUIDACAO',
    competencia: '2026-10',
    contaDebitoCodigo: '1.1.01',
    contaCreditoCodigo: '2.1.01',
    centroCodigo: 'CT1',
    vigenciaInicio: '2026-10-01',
    justificativa: 'tenta',
  };
  const post = (rota: string, enviado: object) =>
    request(srv()).post(rota).set('Cookie', adminCookies).send(enviado);
  const get = (rota: string) => request(srv()).get(rota).set('Cookie', adminCookies);

  const invalidosDeOrigem: [string, Record<string, unknown>][] = [
    ['competência com mês 13', { competencia: '2026-13' }],
    ['competência com mês 00', { competencia: '2026-00' }],
    ['competência com ano 0000', { competencia: '0000-05' }],
    ['vigência em 30 de fevereiro', { vigenciaInicio: '2026-02-30' }],
    ['vigência com mês 13', { vigenciaInicio: '2026-13-01' }],
    ['vigência com ano 0000', { vigenciaInicio: '0000-01-01' }],
  ];

  it.each(invalidosDeOrigem)('configurar recusa %s', async (_rotulo, parcial) => {
    await prepararContasAnaliticas();
    const res = await post('/contabilidade/politicas', { ...corpo, ...parcial });
    expect(res.status).toBe(400);
    expect(res.body.statusCode).toBe(400);
    expect(await db.select().from(politicasContabilizacao)).toHaveLength(0);
  });

  it.each(invalidosDeOrigem)('validar recusa %s', async (_rotulo, parcial) => {
    await prepararContasAnaliticas();
    const res = await post('/contabilidade/politicas/validar', { ...corpo, ...parcial });
    expect(res.status).toBe(400);
  });

  // Guarda: o enum do DTO já recusa hoje. Passa antes e depois e trava a regressão; não prova reprodução.
  it('guarda: configurar e validar recusam tipo fora do enum', async () => {
    await prepararContasAnaliticas();
    for (const rota of ['/contabilidade/politicas', '/contabilidade/politicas/validar']) {
      expect((await post(rota, { ...corpo, tipoEvento: 'COMPRA' })).status).toBe(400);
    }
    expect(await db.select().from(politicasContabilizacao)).toHaveLength(0);
  });

  it.each([
    ['competência com mês 13', { competencia: '2026-13' }],
    ['vigência em 30 de fevereiro', { vigenciaInicio: '2026-02-30' }],
    ['número zero', { numero: 0 }],
    ['número negativo', { numero: -1 }],
    ['número fracionário', { numero: 1.5 }],
    ['justificativa vazia', { justificativa: '   ' }],
  ])('editar recusa %s', async (_rotulo, parcial) => {
    await prepararContasAnaliticas();
    const politica = await service.configurar(dtoConfigurar(), autorId);
    const res = await post(`/contabilidade/politicas/${politica.codigo}/editar`, {
      numero: 1,
      contaDebitoCodigo: '1.1.01',
      contaCreditoCodigo: '2.1.01',
      centroCodigo: 'CT1',
      vigenciaInicio: '2026-10-01',
      justificativa: 'edita',
      ...parcial,
    });
    expect(res.status).toBe(400);
  });

  it.each([
    ['negativo', '-1.00'],
    ['três casas decimais', '1.005'],
    ['uma casa decimal', '10.5'],
    ['sem casas decimais', '10'],
    ['vírgula no lugar do ponto', '10,50'],
    ['14 dígitos inteiros', '12345678901234.00'],
    ['texto', 'abc'],
    ['vazio', ''],
  ])('simular recusa valor %s e não grava simulação', async (_rotulo, valor) => {
    await prepararContasAnaliticas();
    const politica = await service.configurar(dtoConfigurar(), autorId);
    const res = await post(`/contabilidade/politicas/${politica.codigo}/simular`, {
      numero: 1,
      valor,
      justificativa: 'simula',
    });
    expect(res.status).toBe(400);
    expect(await db.select().from(politicaSimulacoes)).toHaveLength(0);
  });

  it.each([
    ['número zero', { numero: 0 }],
    ['número texto', { numero: 'um' }],
    ['justificativa ausente', { justificativa: undefined }],
  ])('aprovar recusa %s', async (_rotulo, parcial) => {
    await prepararContasAnaliticas();
    const politica = await service.configurar(dtoConfigurar(), autorId);
    const res = await post(`/contabilidade/politicas/${politica.codigo}/aprovar`, {
      numero: 1,
      justificativa: 'aprova',
      ...parcial,
    });
    expect(res.status).toBe(400);
    expect((await service.obter(politica.codigo)).situacao).toBe('DRAFT');
  });

  // Guarda: o ZodValidationPipe do lote (controller L61-L65) já responde 400 hoje.
  it('guarda: lote recusa valor monetário inválido e não grava simulação', async () => {
    await prepararContasAnaliticas();
    const politica = await service.configurar(dtoConfigurar(), autorId);
    const res = await post('/contabilidade/politicas/lote', {
      acao: 'simular',
      codigos: [politica.codigo],
      justificativa: 'simula',
      numeroPorCodigo: { [politica.codigo]: 1 },
      valor: '1.005',
    });
    expect(res.status).toBe(400);
    expect(await db.select().from(politicaSimulacoes)).toHaveLength(0);
  });

  it.each([
    ['competência com mês 13', '?competencia=2026-13'],
    ['página maior que o teto', '?pagina=99999999999'],
  ])('listar e exportar recusam %s', async (_rotulo, consulta) => {
    expect((await get(`/contabilidade/politicas${consulta}`)).status).toBe(400);
    expect((await get(`/contabilidade/politicas/exportar${consulta}`)).status).toBe(400);
  });

  // Guardas: página 0 (min(1)) e os enums de situação e ordenação já respondem 400 hoje.
  it.each([
    ['página zero', '?pagina=0'],
    ['situação fora do enum', '?situacao=APROVADA'],
    ['ordenação fora do enum', '?ordenar=senha'],
  ])('guarda: listar e exportar recusam %s', async (_rotulo, consulta) => {
    expect((await get(`/contabilidade/politicas${consulta}`)).status).toBe(400);
    expect((await get(`/contabilidade/politicas/exportar${consulta}`)).status).toBe(400);
  });

  it('guarda: ação inexistente continua 404', async () => {
    const res = await post('/contabilidade/politicas/LIQUIDACAO-2026-10/destruir', { numero: 1, justificativa: 'x' });
    expect(res.status).toBe(404);
  });
});

  describe('conta cuja versão em vigor está suspensa', () => {
    it('configurar recusa a conta com 422 e não grava a política', async () => {
      await prepararContasAnaliticas();
      await novaVersaoDaConta('1.1.01', 2, 'SUSPENDED');
      const res = await request(srv()).post('/contabilidade/politicas').set('Cookie', adminCookies).send(dtoConfigurar());
      expect(res.status).toBe(422);
      expect(res.body.message).toEqual({ message: 'mapeamento ausente', codigo: 'LIQUIDACAO-2026-10' });
      expect(await db.select().from(politicasContabilizacao)).toHaveLength(0);
    });

    it('a conta suspensa não aparece nas opções do combo', async () => {
      await prepararContasAnaliticas();
      await novaVersaoDaConta('1.1.01', 2, 'SUSPENDED');
      const res = await request(srv()).get('/contabilidade/politicas/opcoes').set('Cookie', adminCookies);
      expect(res.status).toBe(200);
      const codigos = (res.body.contas as { codigo: string }[]).map((conta) => conta.codigo);
      expect(codigos).not.toContain('1.1.01');
      expect(codigos).toContain('2.1.01');
    });

    it('simular recusa quando a conta foi suspensa depois da configuração', async () => {
      await prepararContasAnaliticas();
      const politica = await service.configurar(dtoConfigurar(), autorId);
      await novaVersaoDaConta('1.1.01', 2, 'SUSPENDED');
      await expect(service.simular(politica.codigo, { numero: 1, valor: '10.00', justificativa: 'simula' }, autorId))
        .rejects.toMatchObject({ status: 422, response: { message: 'mapeamento ausente', codigo: politica.codigo } });
      expect(await db.select().from(politicaSimulacoes)).toHaveLength(0);
    });

    it.each(['1.1.01', '2.1.01'])(
      'aprovar recusa quando a conta %s foi suspensa depois da simulação e a regra continua em rascunho',
      async (codigoConta) => {
        await prepararContasAnaliticas();
        const politica = await service.configurar(dtoConfigurar(), autorId);
        await service.simular(politica.codigo, { numero: 1, valor: '10.00', justificativa: 'simula' }, autorId);
        await novaVersaoDaConta(codigoConta, 2, 'SUSPENDED');
        await expect(service.aprovar(politica.codigo, { numero: 1, justificativa: 'aprova' }, outraPessoaId))
          .rejects.toMatchObject({ status: 422, response: { message: 'mapeamento ausente', codigo: politica.codigo } });
        expect((await service.obter(politica.codigo)).situacao).toBe('DRAFT');
      },
    );

    it.each(['DRAFT', 'REVIEW', 'REJECTED'] as const)(
      'guarda: uma versão %s mais nova não derruba a conta em vigor nem tira a conta das opções',
      async (situacao) => {
        await prepararContasAnaliticas();
        await novaVersaoDaConta('1.1.01', 2, situacao);
        const politica = await service.configurar(dtoConfigurar(), autorId);
        expect(politica.situacao).toBe('DRAFT');
        const opcoes = await service.listarOpcoes();
        expect(opcoes.contas.map((conta) => conta.codigo)).toContain('1.1.01');
      },
    );
  });

  describe('valor simulado maior que zero', () => {
    async function politicaPronta() {
      await prepararContasAnaliticas();
      return service.configurar(dtoConfigurar(), autorId);
    }

    it.each(['0.00', '0000000000000.00'])('HTTP recusa %s com 400 e não grava', async (valor) => {
      const politica = await politicaPronta();
      const res = await request(srv()).post(`/contabilidade/politicas/${politica.codigo}/simular`)
        .set('Cookie', adminCookies).send({ numero: 1, valor, justificativa: 'simula' });
      expect(res.status).toBe(400);
      expect(await db.select().from(politicaSimulacoes)).toHaveLength(0);
    });

    it('o serviço recusa 0.00 com 422, para quem chama sem passar pelo DTO', async () => {
      const politica = await politicaPronta();
      await expect(service.simular(politica.codigo, { numero: 1, valor: '0.00', justificativa: 'simula' }, autorId))
        .rejects.toMatchObject({
          status: 422,
          response: { message: 'valor deve ser maior que zero', codigo: politica.codigo },
        });
      expect(await db.select().from(politicaSimulacoes)).toHaveLength(0);
    });

    it('o lote recusa 0.00 e desfaz tudo', async () => {
      const politica = await politicaPronta();
      const res = await request(srv()).post('/contabilidade/politicas/lote').set('Cookie', adminCookies).send({
        acao: 'simular',
        codigos: [politica.codigo],
        justificativa: 'simula',
        numeroPorCodigo: { [politica.codigo]: 1 },
        valor: '0.00',
      });
      expect(res.status).toBe(400);
      expect(await db.select().from(politicaSimulacoes)).toHaveLength(0);
    });

    it('uma simulação 0.00 já gravada não destrava a aprovação', async () => {
      const politica = await politicaPronta();
      await db.execute(sql`
        insert into politica_simulacoes (politica_id, versao_numero, valor, debito, credito)
        select p.id, 1, 0, 0, 0 from politicas_contabilizacao p where p.codigo = ${politica.codigo}
      `);
      await expect(service.aprovar(politica.codigo, { numero: 1, justificativa: 'aprova' }, outraPessoaId))
        .rejects.toMatchObject({ status: 422, response: { message: 'mapeamento ausente', codigo: politica.codigo } });
      expect((await service.obter(politica.codigo)).situacao).toBe('DRAFT');
    });

    it('0.01 é o menor valor aceito e permite a aprovação por outra pessoa', async () => {
      const politica = await politicaPronta();
      await service.simular(politica.codigo, { numero: 1, valor: '0.01', justificativa: 'simula' }, autorId);
      const aprovada = await service.aprovar(politica.codigo, { numero: 1, justificativa: 'aprova' }, outraPessoaId);
      expect(aprovada.situacao).toBe('APPROVED');
    });
  });

  async function politicaComExclusaoLogica() {
    await prepararContasAnaliticas();
    const politica = await service.configurar(dtoConfigurar(), autorId);
    await db.execute(sql`update politicas_contabilizacao set deleted_at = now() where codigo = ${politica.codigo}`);
    return politica;
  }

  it('obter e histórico ignoram a política com exclusão lógica', async () => {
    const politica = await politicaComExclusaoLogica();
    await expect(service.obter(politica.codigo)).rejects.toMatchObject({ status: 404 });
    await expect(service.historico(politica.codigo)).rejects.toMatchObject({ status: 404 });
  });

  it('listar, total e exportar ignoram a política com exclusão lógica', async () => {
    await politicaComExclusaoLogica();
    const consulta = { pagina: 1, q: '', situacao: '', competencia: '', ordenar: 'competencia', direcao: 'asc' } as const;
    const lista = await service.listar(consulta);
    expect(lista.total).toBe(0);
    expect(lista.itens).toHaveLength(0);
    expect(await service.exportarCsv(consulta)).not.toContain('Liquidação');
  });
});
