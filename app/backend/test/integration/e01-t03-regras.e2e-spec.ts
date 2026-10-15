import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { and, eq, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { validarCnpjAlfanumerico } from '../../src/common/validators/cnpj-alfanumerico';
import { DRIZZLE } from '../../src/database/database.module';
import * as schema from '../../src/database/schema';
import { cleanupDb, createTestApp, createTestUser, joinSetCookie } from '../helpers/test-app';

const MOTIVO = 'Regra inicial da vigência de 2026.';
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-/i;

function codigoDe(body: { codigo?: string; message?: { codigo?: string } | string }): string | undefined {
  if (typeof body.codigo === 'string') return body.codigo;
  return typeof body.message === 'object' ? body.message.codigo : undefined;
}

function cnpjDe(base12: string): string {
  for (let i = 0; i < 100; i += 1) {
    const candidato = `${base12}${String(i).padStart(2, '0')}`;
    if (validarCnpjAlfanumerico(candidato)) return candidato;
  }
  throw new Error(`CNPJ sem DV para ${base12}`);
}

function cnpjNumerico(base12: string): string {
  const digitos = base12.split('').map(Number);
  const calcular = (qtd: number): void => {
    let soma = 0;
    let peso = 2;
    for (let i = qtd - 1; i >= 0; i -= 1) {
      soma += (digitos[i] ?? 0) * peso;
      peso = peso === 9 ? 2 : peso + 1;
    }
    const resto = soma % 11;
    digitos.push(resto < 2 ? 0 : 11 - resto);
  };
  calcular(12);
  calcular(13);
  return digitos.join('');
}

describe('E01-T03 regras tributárias', () => {
  let app: INestApplication;
  let adminA = '';
  let adminB = '';
  let gestor = '';
  let seq = 40;
  let fetchSpy: jest.SpiedFunction<typeof fetch>;

  beforeAll(async () => {
    app = await createTestApp();
    const a = await createTestUser(app, { perfil: 'administrador' });
    const g = await createTestUser(app, { perfil: 'gestor' });
    adminA = joinSetCookie(await request(app.getHttpServer()).post('/auth/login').send({ email: a.adminEmail, password: a.adminPassword }));
    gestor = joinSetCookie(await request(app.getHttpServer()).post('/auth/login').send({ email: g.adminEmail, password: g.adminPassword }));
    const emailB = `admin-b-${Date.now()}@test.local`;
    const senhaB = 'TestPass@123456';
    const criado = await request(app.getHttpServer())
      .post('/usuarios')
      .set('Cookie', adminA)
      .send({ nome: 'Admin B', email: emailB, password: senhaB, perfis: ['administrador'] });
    expect(criado.status).toBe(201);
    adminB = joinSetCookie(await request(app.getHttpServer()).post('/auth/login').send({ email: emailB, password: senhaB }));
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterAll(async () => {
    fetchSpy.mockRestore();
    await cleanupDb(app);
    await app.close();
  });

  function db() {
    return app.get<{ db: NodePgDatabase<typeof schema> }>(DRIZZLE).db;
  }

  function raiz(): string {
    seq += 1;
    return `71RG${String(seq).padStart(4, '0')}`;
  }

  function dataOp(): string {
    const dia = ((seq - 1) % 28) + 1;
    const mes = (Math.floor((seq - 1) / 28) % 12) + 1;
    return `2096-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
  }

  async function cenario() {
    const cnpjRaiz = raiz();
    const empresa = await request(app.getHttpServer())
      .post('/fiscal/empresas')
      .set('Cookie', adminA)
      .send({ razaoSocial: `Empresa ${cnpjRaiz}`, cnpjRaiz, justificativa: MOTIVO });
    expect(empresa.status).toBe(201);
    const estab = await request(app.getHttpServer())
      .post('/fiscal/estabelecimentos')
      .set('Cookie', adminA)
      .send({
        empresaId: empresa.body.id,
        nome: 'Filial Osasco',
        cnpj: cnpjDe(`${cnpjRaiz}0001`),
        inscricaoEstadual: '123456789',
        inscricaoMunicipal: '98765',
        uf: 'SP',
        cnaes: [{ codigo: '6201501', descricao: 'Desenvolvimento', tipo: 'PRINCIPAL' }],
        justificativa: MOTIVO,
      });
    expect(estab.status).toBe(201);
    const submetido = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.body.id}/submeter`)
      .set('Cookie', adminA)
      .send({ versao: estab.body.versao, justificativa: MOTIVO });
    expect(submetido.status).toBe(200);
    const aprovado = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.body.id}/aprovar`)
      .set('Cookie', adminB)
      .send({ versao: submetido.body.versao, justificativa: MOTIVO });
    expect(aprovado.status).toBe(200);
    const operacao = await request(app.getHttpServer())
      .post('/operacoes/extraordinaria')
      .set('Cookie', adminA)
      .send({ data: dataOp(), rotulo: `Compra ${cnpjRaiz}` });
    expect(operacao.status).toBe(201);
    const produto = await request(app.getHttpServer())
      .post('/produtos')
      .set('Cookie', adminA)
      .send({ codigo: `P-${cnpjRaiz}`, nome: 'Acém', unidadePedido: 'kg', atributosJson: { fiscal: { ncm: '99999999', cfop: '9999' } } });
    expect(produto.status).toBe(201);
    const cliente = await request(app.getHttpServer())
      .post('/clientes')
      .set('Cookie', adminA)
      .send({
        codigo: `C-${cnpjRaiz}`,
        razaoSocial: 'Açougue Central LTDA',
        nomeFantasia: 'Açougue Central',
        documentoFiscal: cnpjNumerico(`8${String(seq).padStart(11, '0')}`),
        faixaPreco: 'A',
      });
    expect(cliente.status).toBe(201);
    const cfop = await request(app.getHttpServer())
      .post('/fiscal/cfops')
      .set('Cookie', adminA)
      .send({ codigo: String(5200 + (seq % 70)).padStart(4, '0'), descricao: `CFOP ${cnpjRaiz}`, justificativa: MOTIVO });
    expect(cfop.status).toBe(201);
    const ncm = await request(app.getHttpServer())
      .post('/fiscal/ncms')
      .set('Cookie', adminA)
      .send({ codigo: String(3000000 + seq).padStart(8, '0'), descricao: `NCM ${cnpjRaiz}`, justificativa: MOTIVO });
    expect(ncm.status).toBe(201);
    const enquadramento = await request(app.getHttpServer())
      .post('/fiscal/enquadramentos')
      .set('Cookie', adminA)
      .send({
        estabelecimentoId: aprovado.body.id,
        operacaoId: operacao.body.id,
        tpNf: '1',
        finNfe: '1',
        cfopId: cfop.body.id,
        abrangencia: 'INTERNA',
        tipoProduto: 'REVENDA',
        produtoId: produto.body.id,
        ncmId: ncm.body.id,
        cest: '1708700',
        clienteId: cliente.body.id,
        vigenciaInicio: '2026-01-01',
        vigenciaFim: '2026-12-31',
        prioridade: 1,
        justificativa: MOTIVO,
      });
    expect(enquadramento.status).toBe(201);
    const beneficio = await request(app.getHttpServer())
      .post('/fiscal/beneficios-fiscais')
      .set('Cookie', adminA)
      .send({ codigo: `SP${String(200000 + seq).padStart(6, '0')}`, descricao: `Benefício ${cnpjRaiz}`, justificativa: MOTIVO });
    expect(beneficio.status).toBe(201);
    const classificacao = await request(app.getHttpServer())
      .post('/fiscal/classificacoes-ibs-cbs')
      .set('Cookie', adminA)
      .send({ codigo: String(seq).padStart(6, '0'), descricao: `Classificação ${cnpjRaiz}`, justificativa: MOTIVO });
    expect(classificacao.status).toBe(201);
    return {
      enquadramentoId: enquadramento.body.id as string,
      operacaoId: operacao.body.id as string,
      cfopId: cfop.body.id as string,
      beneficioFiscalId: beneficio.body.id as string,
      classificacaoIbsCbsId: classificacao.body.id as string,
    };
  }

  function corpoRegra(base: Awaited<ReturnType<typeof cenario>>, extra: Record<string, unknown> = {}) {
    return {
      enquadramentoId: base.enquadramentoId,
      operacaoId: base.operacaoId,
      cfopId: base.cfopId,
      icmsCst: '20',
      pRedBc: '41,67',
      pIcms: '12,00',
      beneficioFiscalId: base.beneficioFiscalId,
      ipiCst: '53',
      pisCst: '06',
      ibsCst: '000',
      classificacaoIbsCbsId: base.classificacaoIbsCbsId,
      vigenciaInicio: '2026-01-01',
      vigenciaFim: '2026-12-31',
      justificativa: MOTIVO,
      ...extra,
    };
  }

  async function criarComo(cookies: string, extra: Record<string, unknown> = {}) {
    const base = extra.enquadramentoId
      ? extra as Awaited<ReturnType<typeof cenario>>
      : await cenario();
    const corpo = corpoRegra(
      {
        enquadramentoId: String(extra.enquadramentoId ?? base.enquadramentoId),
        operacaoId: String(extra.operacaoId ?? base.operacaoId),
        cfopId: String(extra.cfopId ?? base.cfopId),
        beneficioFiscalId: String(extra.beneficioFiscalId ?? base.beneficioFiscalId),
        classificacaoIbsCbsId: String(extra.classificacaoIbsCbsId ?? base.classificacaoIbsCbsId),
      },
      extra,
    );
    const res = await request(app.getHttpServer()).post('/fiscal/regras').set('Cookie', cookies).send(corpo);
    return { res, corpo };
  }

  function detalharComo(cookies: string, id: string) {
    return request(app.getHttpServer()).get(`/fiscal/regras/${id}`).set('Cookie', cookies);
  }

  function submeterComo(cookies: string, id: string, versao: number) {
    return request(app.getHttpServer()).post(`/fiscal/regras/${id}/submeter`).set('Cookie', cookies).send({ versao, justificativa: MOTIVO });
  }

  function aprovarComo(cookies: string, id: string, versao: number) {
    return request(app.getHttpServer()).post(`/fiscal/regras/${id}/aprovar`).set('Cookie', cookies).send({ versao, justificativa: MOTIVO });
  }

  async function aprovarFluxo(extra: Record<string, unknown> = {}) {
    const criada = await criarComo(adminA, extra);
    expect(criada.res.status).toBe(201);
    const submetida = await submeterComo(adminA, criada.res.body.id, criada.res.body.versao);
    expect(submetida.status).toBe(200);
    const aprovada = await aprovarComo(adminB, criada.res.body.id, submetida.body.versao);
    expect(aprovada.status).toBe(200);
    return { id: criada.res.body.id as string, corpo: criada.corpo, aprovada: aprovada.body };
  }

  it('autor com APROVAR não aprova a si mesmo', async () => {
    const criada = await criarComo(adminA);
    expect(criada.res.status).toBe(201);
    const submetida = await submeterComo(adminA, criada.res.body.id, criada.res.body.versao);
    expect(submetida.status).toBe(200);
    const res = await aprovarComo(adminA, criada.res.body.id, submetida.body.versao);
    expect(res.status).toBe(422);
    expect(codigoDe(res.body)).toBe('SEGREGACAO_FUNCAO');
    const detalhe = await detalharComo(adminA, criada.res.body.id);
    expect(detalhe.body.situacao).toBe('Submetida');
  });

  it('versão aprovada e aposentada recusam PATCH', async () => {
    const fluxo = await aprovarFluxo();
    const patch = await request(app.getHttpServer())
      .patch(`/fiscal/regras/${fluxo.id}`)
      .set('Cookie', adminB)
      .send({ ...fluxo.corpo, pIcms: '8,00', versao: fluxo.aprovada.versao });
    expect(patch.status).toBe(409);
    expect(codigoDe(patch.body)).toBe('VERSAO_IMUTAVEL');
    expect(codigoDe(patch.body)).not.toMatch(/NOTA/);
    const lida = await detalharComo(adminA, fluxo.id);
    expect(lida.body.pIcms).toBe('0.1200');
    const aposentada = await request(app.getHttpServer())
      .post(`/fiscal/regras/${fluxo.id}/aposentar`)
      .set('Cookie', adminB)
      .send({ versao: fluxo.aprovada.versao, justificativa: MOTIVO });
    expect(aposentada.status).toBe(200);
    const patchAposentada = await request(app.getHttpServer())
      .patch(`/fiscal/regras/${fluxo.id}`)
      .set('Cookie', adminB)
      .send({ ...fluxo.corpo, pIcms: '8,00', versao: aposentada.body.versao });
    expect(patchAposentada.status).toBe(409);
    expect(codigoDe(patchAposentada.body)).toBe('VERSAO_IMUTAVEL');
  });

  it('vigências aprovadas sobrepostas no mesmo enquadramento', async () => {
    const primeira = await aprovarFluxo({ vigenciaInicio: '2026-01-01', vigenciaFim: '2026-12-31' });
    const segunda = await criarComo(adminA, { ...primeira.corpo, vigenciaInicio: '2026-06-01', vigenciaFim: null });
    expect(segunda.res.status).toBe(201);
    const submetida = await submeterComo(adminA, segunda.res.body.id, segunda.res.body.versao);
    expect(submetida.status).toBe(200);
    const res = await aprovarComo(adminB, segunda.res.body.id, submetida.body.versao);
    expect(res.status).toBe(422);
    expect(codigoDe(res.body)).toBe('VIGENCIA_AMBIGUA');
    const detalhe = await detalharComo(adminA, segunda.res.body.id);
    expect(detalhe.body.situacao).toBe('Submetida');
  });

  it('criar rascunho, editar, submeter, aprovar e aposentar', async () => {
    const criada = await criarComo(adminA);
    expect(criada.res.status).toBe(201);
    expect(JSON.stringify(criada.res.body)).not.toMatch(/NT/);
    expect(criada.res.body.situacao).toBe('Rascunho');
    expect(criada.res.body.tratamentoIcms).toBe('Redução de base');
    expect(criada.res.body.pIcms).toBe('0.1200');
    const gravado = await db().execute(sql`SELECT p_icms::text AS p_icms FROM regras_tributarias WHERE id = ${criada.res.body.id}`);
    expect(gravado.rows[0]).toMatchObject({ p_icms: '0.1200' });
    const aposCriar = await db().select().from(schema.auditoria).where(eq(schema.auditoria.registroId, criada.res.body.id));
    expect(aposCriar).toHaveLength(1);

    const editada = await request(app.getHttpServer())
      .patch(`/fiscal/regras/${criada.res.body.id}`)
      .set('Cookie', adminA)
      .send({ ...criada.corpo, versao: criada.res.body.versao });
    expect(editada.status).toBe(200);
    const aposEditar = await db().select().from(schema.auditoria).where(eq(schema.auditoria.registroId, criada.res.body.id));
    expect(aposEditar).toHaveLength(2);

    const submetida = await submeterComo(adminA, criada.res.body.id, editada.body.versao);
    expect(submetida.status).toBe(200);
    fetchSpy.mockClear();
    const aprovada = await aprovarComo(adminB, criada.res.body.id, submetida.body.versao);
    expect(aprovada.status).toBe(200);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(aprovada.body.situacao).toBe('Aprovada');
    expect(aprovada.body.tratamentoIcms).toBe('Redução de base');
    expect(aprovada.body.pIcms).toBe('0.1200');

    const aposentada = await request(app.getHttpServer())
      .post(`/fiscal/regras/${criada.res.body.id}/aposentar`)
      .set('Cookie', adminB)
      .send({ versao: aprovada.body.versao, justificativa: MOTIVO });
    expect(aposentada.status).toBe(200);
    const ainda = await db().execute(sql`SELECT COUNT(*)::int AS n FROM regras_tributarias WHERE id = ${criada.res.body.id} AND deleted_at IS NULL`);
    expect(ainda.rows[0]).toMatchObject({ n: 1 });
    const historico = await request(app.getHttpServer()).get(`/fiscal/regras/${criada.res.body.id}/historico`).set('Cookie', adminA);
    expect(historico.status).toBe(200);
    const texto = JSON.stringify(historico.body);
    expect(texto).not.toMatch(/regras_tributarias/);
    expect(texto).not.toMatch(UUID);
    const aposCiclo = await db().select().from(schema.auditoria).where(eq(schema.auditoria.registroId, criada.res.body.id));
    expect(aposCiclo).toHaveLength(5);
  });

  it('adicionar versão grava o mesmo código e numero_versao 2', async () => {
    const fluxo = await aprovarFluxo();
    const nova = await request(app.getHttpServer())
      .post(`/fiscal/regras/${fluxo.id}/versoes`)
      .set('Cookie', adminA)
      .send({ ...fluxo.corpo, pIcms: '7,00', vigenciaInicio: '2027-01-01', vigenciaFim: null, versao: fluxo.aprovada.versao });
    expect(nova.status).toBe(201);
    expect(nova.body.codigo).toBe(fluxo.aprovada.codigo);
    expect(nova.body.numeroVersao).toBe(2);
    expect(nova.body.situacao).toBe('Rascunho');
  });

  it('beneficio removido → 422 BENEFICIO_NAO_ELEGIVEL e zero regras', async () => {
    await db().execute(sql`DELETE FROM regras_tributarias`);
    const base = await cenario();
    await db().update(schema.beneficiosFiscais).set({ deletedAt: new Date() }).where(eq(schema.beneficiosFiscais.id, base.beneficioFiscalId));
    const res = await request(app.getHttpServer()).post('/fiscal/regras').set('Cookie', adminA).send(corpoRegra(base));
    expect(res.status).toBe(422);
    expect(codigoDe(res.body)).toBe('BENEFICIO_NAO_ELEGIVEL');
    const contagem = await db().execute(sql`SELECT COUNT(*)::int AS n FROM regras_tributarias`);
    expect(contagem.rows[0]).toMatchObject({ n: 0 });
  });

  it('gestor sem FISCAL_REGRAS_* → 403 em toda rota', async () => {
    const id = '0199e1a0-0000-7000-8000-000000000099';
    const rotas = [
      request(app.getHttpServer()).get('/fiscal/regras').set('Cookie', gestor),
      request(app.getHttpServer()).get(`/fiscal/regras/${id}`).set('Cookie', gestor),
      request(app.getHttpServer()).get(`/fiscal/regras/${id}/historico`).set('Cookie', gestor),
      request(app.getHttpServer()).post('/fiscal/regras').set('Cookie', gestor).send({}),
      request(app.getHttpServer()).patch(`/fiscal/regras/${id}`).set('Cookie', gestor).send({}),
      request(app.getHttpServer()).post(`/fiscal/regras/${id}/versoes`).set('Cookie', gestor).send({}),
      request(app.getHttpServer()).post(`/fiscal/regras/${id}/submeter`).set('Cookie', gestor).send({}),
      request(app.getHttpServer()).post(`/fiscal/regras/${id}/aprovar`).set('Cookie', gestor).send({}),
      request(app.getHttpServer()).post(`/fiscal/regras/${id}/aposentar`).set('Cookie', gestor).send({}),
    ];
    for (const rota of rotas) {
      expect((await rota).status).toBe(403);
    }
  });

  it('GERENCIAR sem APROVAR → 403 em aprovar', async () => {
    const criada = await criarComo(adminA);
    const submetida = await submeterComo(adminA, criada.res.body.id, criada.res.body.versao);
    expect(submetida.status).toBe(200);
    const perfil = await db().select({ id: schema.perfis.id }).from(schema.perfis).where(eq(schema.perfis.slug, 'gestor'));
    const permissao = await db().select({ id: schema.permissoes.id }).from(schema.permissoes).where(eq(schema.permissoes.codigo, 'FISCAL_REGRAS_GERENCIAR'));
    await db().insert(schema.perfisPermissoes).values({ perfilId: perfil[0]!.id, permissaoId: permissao[0]!.id }).onConflictDoNothing();
    const limitado = await createTestUser(app, { perfil: 'gestor' });
    const cookies = joinSetCookie(await request(app.getHttpServer()).post('/auth/login').send({
      email: limitado.adminEmail,
      password: limitado.adminPassword,
    }));
    const res = await aprovarComo(cookies, criada.res.body.id, submetida.body.versao);
    expect(res.status).toBe(403);
    await db().delete(schema.perfisPermissoes).where(and(
      eq(schema.perfisPermissoes.perfilId, perfil[0]!.id),
      eq(schema.perfisPermissoes.permissaoId, permissao[0]!.id),
    ));
  });

  it('POST não altera enquadramentos_fiscais, cfops, ncms nem notas_fiscais', async () => {
    const base = await cenario();
    const antes = await db().execute(sql`
      SELECT
        (SELECT COUNT(*)::int FROM enquadramentos_fiscais) AS enquadramentos,
        (SELECT COUNT(*)::int FROM cfops) AS cfops,
        (SELECT COUNT(*)::int FROM ncms) AS ncms,
        (SELECT COUNT(*)::int FROM notas_fiscais) AS notas,
        (SELECT MAX(updated_at) FROM enquadramentos_fiscais) AS enquadramento_em,
        (SELECT MAX(updated_at) FROM cfops) AS cfop_em,
        (SELECT MAX(updated_at) FROM ncms) AS ncm_em,
        (SELECT MAX(updated_at) FROM notas_fiscais) AS nota_em
    `);
    const criada = await request(app.getHttpServer()).post('/fiscal/regras').set('Cookie', adminA).send(corpoRegra(base));
    expect(criada.status).toBe(201);
    const depois = await db().execute(sql`
      SELECT
        (SELECT COUNT(*)::int FROM enquadramentos_fiscais) AS enquadramentos,
        (SELECT COUNT(*)::int FROM cfops) AS cfops,
        (SELECT COUNT(*)::int FROM ncms) AS ncms,
        (SELECT COUNT(*)::int FROM notas_fiscais) AS notas,
        (SELECT MAX(updated_at) FROM enquadramentos_fiscais) AS enquadramento_em,
        (SELECT MAX(updated_at) FROM cfops) AS cfop_em,
        (SELECT MAX(updated_at) FROM ncms) AS ncm_em,
        (SELECT MAX(updated_at) FROM notas_fiscais) AS nota_em
    `);
    expect(depois.rows[0]).toEqual(antes.rows[0]);
  });
});
