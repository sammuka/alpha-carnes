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
    const corpoEnquadramento = {
      operacaoId: operacao.body.id as string,
      tpNf: '1',
      finNfe: '1',
      cfopId: cfop.body.id as string,
      abrangencia: 'INTERNA',
      tipoProduto: 'REVENDA',
      produtoId: produto.body.id as string,
      ncmId: ncm.body.id as string,
      cest: '1708700',
      clienteId: cliente.body.id as string,
      vigenciaInicio: '2026-01-01',
      vigenciaFim: '2026-12-31',
      prioridade: 1,
      justificativa: MOTIVO,
    };
    const enquadramento = await request(app.getHttpServer())
      .post('/fiscal/enquadramentos')
      .set('Cookie', adminA)
      .send({ estabelecimentoId: aprovado.body.id, ...corpoEnquadramento });
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
      corpoEnquadramento,
      versaoEnquadramento: enquadramento.body.versao as number,
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

  it('detalhe devolve os rótulos de negócio dos combos e dos tratamentos', async () => {
    const criada = await criarComo(adminA);
    expect(criada.res.status).toBe(201);
    const detalhe = await detalharComo(adminA, criada.res.body.id);
    expect(detalhe.status).toBe(200);
    expect(detalhe.body).toMatchObject({
      tratamentoIpi: 'Saída não tributada',
      tratamentoPis: 'Alíquota zero',
      tratamentoIbs: 'Tributação integral',
    });
    expect(detalhe.body.enquadramentoCodigo).toMatch(/^\d+$/);
    expect(detalhe.body.operacaoRotulo).toMatch(/^Compra /);
    expect(detalhe.body.cfopCodigo).toMatch(/^\d{4}$/);
    expect(detalhe.body.beneficioDescricao).toMatch(/^Benefício /);
    expect(detalhe.body.classificacaoDescricao).toMatch(/^Classificação /);
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

  it('CSV leva o rótulo Redução de base e as pré-condições provisórias', async () => {
    const criada = await criarComo(adminA);
    expect(criada.res.status).toBe(201);
    const csv = await request(app.getHttpServer()).get('/fiscal/regras/exportacao').set('Cookie', adminA);
    expect(csv.status).toBe(200);
    expect(csv.headers['content-type']).toBe('text/csv; charset=utf-8');
    const texto = csv.text;
    expect(texto.startsWith('\uFEFF')).toBe(true);
    const linhas = texto.replace(/^\uFEFF/, '').split('\r\n').filter((linha) => linha.length > 0);
    expect(linhas[0]).toBe('Enquadramento fiscal;Operação fiscal (CFOP);Benefício fiscal;Classificação IBS/CBS;Operação;Tratamento ICMS');
    const tratamentos = linhas.slice(1).map((linha) => linha.split(';')[5]);
    expect(tratamentos).toContain('Redução de base');
    expect(tratamentos).not.toContain('20');
    expect(texto).not.toMatch(/CST/);
    expect(texto).not.toMatch(UUID);

    const pre = await request(app.getHttpServer()).get(`/fiscal/regras/${criada.res.body.id}/pre-condicoes`).set('Cookie', adminA);
    expect(pre.status).toBe(200);
    expect(pre.body).toEqual([
      expect.objectContaining({ codigo: 'ENQUADRAMENTO_ATIVO', atendida: true, provisoria: false }),
      expect.objectContaining({ codigo: 'VIGENCIA_INFORMADA', atendida: true, provisoria: false }),
      expect.objectContaining({ codigo: 'CAMPOS_TRIBUTARIOS', atendida: true, provisoria: false }),
      expect.objectContaining({ codigo: 'DATAS_COMERCIAL_FISCAL_EFETIVA', atendida: false, provisoria: true }),
      expect.objectContaining({ codigo: 'DUPLA_APROVACAO', atendida: false, provisoria: true }),
      expect.objectContaining({ codigo: 'PERFIS_ALEM_ADMINISTRADOR', atendida: false, provisoria: true }),
    ]);
    const dupla = (pre.body as { codigo: string; texto?: string }[]).find((item) => item.codigo === 'DUPLA_APROVACAO');
    expect(dupla?.texto).toBe('Um aprovador diferente de quem submeteu registra a aprovação. Quantos aprovadores formam quórum ainda não foi decidido.');

    const antes = await request(app.getHttpServer()).get('/fiscal/regras/contagens').set('Cookie', adminA);
    expect(antes.status).toBe(200);
    const outra = await criarComo(adminA);
    expect(outra.res.status).toBe(201);
    const depoisContagem = await request(app.getHttpServer()).get('/fiscal/regras/contagens').set('Cookie', adminA);
    expect(depoisContagem.body.total).toBe(antes.body.total + 1);
    expect(depoisContagem.body.rascunhos).toBe(antes.body.rascunhos + 1);
  });

  it('histórico usa os resumos fechados e a versão nova inclui a origem', async () => {
    const fluxo = await aprovarFluxo();
    const nova = await request(app.getHttpServer())
      .post(`/fiscal/regras/${fluxo.id}/versoes`)
      .set('Cookie', adminA)
      .send({ ...fluxo.corpo, pIcms: '7,00', vigenciaInicio: '2027-01-01', vigenciaFim: null, versao: fluxo.aprovada.versao });
    expect(nova.status).toBe(201);
    const historico = await request(app.getHttpServer()).get(`/fiscal/regras/${nova.body.id}/historico`).set('Cookie', adminA);
    expect(historico.status).toBe(200);
    const resumos = (historico.body as { resumo: string }[]).map((item) => item.resumo);
    expect(resumos).toEqual(expect.arrayContaining([
      'Rascunho criado',
      'Versão submetida',
      'Versão aprovada',
      `Versão nova do código ${fluxo.aprovada.codigo}`,
    ]));
    const texto = JSON.stringify(historico.body);
    expect(texto).not.toMatch(/regras_tributarias/);
    expect(texto).not.toMatch(UUID);
  });

  it('lista aplica busca, ordenação natural por código, filtro de linhagem e de situação', async () => {
    const aprovada = await aprovarFluxo();
    const rascunho = await criarComo(adminA);
    expect(rascunho.res.status).toBe(201);
    const ficha = await detalharComo(adminA, aprovada.id);

    const linhagem = await request(app.getHttpServer())
      .get('/fiscal/regras').query({ codigo: ficha.body.codigo, pageSize: 100 }).set('Cookie', adminA);
    expect(linhagem.status).toBe(200);
    expect(linhagem.body.data).toHaveLength(1);
    const linha = linhagem.body.data[0];
    expect(linha).toMatchObject({ id: aprovada.id, codigo: ficha.body.codigo, numeroVersao: 1, situacao: 'Aprovada' });

    const soAprovadas = await request(app.getHttpServer())
      .get('/fiscal/regras').query({ situacao: 'APROVADA', pageSize: 100 }).set('Cookie', adminA);
    const ids = (soAprovadas.body.data as { id: string }[]).map((l) => l.id);
    expect(ids).toContain(aprovada.id);
    expect(ids).not.toContain(rascunho.res.body.id);

    const buscada = await request(app.getHttpServer())
      .get('/fiscal/regras').query({ search: linha.enquadramentoFiscal, pageSize: 100 }).set('Cookie', adminA);
    expect((buscada.body.data as { id: string }[]).map((l) => l.id)).toContain(aprovada.id);
    const semResultado = await request(app.getHttpServer())
      .get('/fiscal/regras').query({ search: 'zzz-inexistente-zzz' }).set('Cookie', adminA);
    expect(semResultado.body.total).toBe(0);
    const comNulo = await request(app.getHttpServer())
      .get('/fiscal/regras').query({ search: 'a\u0000b' }).set('Cookie', adminA);
    expect(comNulo.status).toBe(400);

    const asc = await request(app.getHttpServer())
      .get('/fiscal/regras').query({ sort: 'enquadramento', dir: 'asc', pageSize: 100 }).set('Cookie', adminA);
    const codigos = (asc.body.data as { enquadramentoFiscal: string }[]).map((l) => Number(l.enquadramentoFiscal));
    expect(codigos).toEqual([...codigos].sort((x, y) => x - y));
    const desc = await request(app.getHttpServer())
      .get('/fiscal/regras').query({ sort: 'enquadramento', dir: 'desc', pageSize: 100 }).set('Cookie', adminA);
    const decrescente = (desc.body.data as { enquadramentoFiscal: string }[]).map((l) => Number(l.enquadramentoFiscal));
    expect(decrescente).toEqual([...decrescente].sort((x, y) => y - x));

    const contagem = await request(app.getHttpServer())
      .get('/fiscal/regras/contagens').query({ search: 'zzz-inexistente-zzz' }).set('Cookie', adminA);
    expect(contagem.body.total).toBe(0);
  });

  describe('correções da revisão crítica', () => {
    type Base = Awaited<ReturnType<typeof cenario>>;

    function ids(base: Base) {
      return {
        enquadramentoId: base.enquadramentoId,
        operacaoId: base.operacaoId,
        cfopId: base.cfopId,
        beneficioFiscalId: base.beneficioFiscalId,
        classificacaoIbsCbsId: base.classificacaoIbsCbsId,
      };
    }

    it('B4: data 0000-01-01 e NUL viram 400, nunca 500', async () => {
      const base = await cenario();
      const inicio = await request(app.getHttpServer()).post('/fiscal/regras').set('Cookie', adminA)
        .send(corpoRegra(base, { vigenciaInicio: '0000-01-01', vigenciaFim: null }));
      expect(inicio.status).toBe(400);
      const fim = await request(app.getHttpServer()).post('/fiscal/regras').set('Cookie', adminA)
        .send(corpoRegra(base, { vigenciaFim: '0000-01-01' }));
      expect(fim.status).toBe(400);
      const nul = await request(app.getHttpServer()).post('/fiscal/regras').set('Cookie', adminA)
        .send(corpoRegra(base, { justificativa: 'abc\u0000def' }));
      expect(nul.status).toBe(400);
      const beneficio = await request(app.getHttpServer()).post('/fiscal/beneficios-fiscais').set('Cookie', adminA)
        .send({ codigo: 'SP999999', descricao: 'a\u0000b', justificativa: MOTIVO });
      expect(beneficio.status).toBe(400);
      const busca = await request(app.getHttpServer()).get('/fiscal/regras').query({ search: 'a\u0000b' }).set('Cookie', adminA);
      expect(busca.status).toBe(400);
    });

    it('B6: enquadramento com regra aprovada não muda, não inativa e não é removido', async () => {
      const base = await cenario();
      const fluxo = await aprovarFluxo(ids(base));
      const outroCfop = await request(app.getHttpServer()).post('/fiscal/cfops').set('Cookie', adminA)
        .send({ codigo: String(6100 + (seq % 80)).padStart(4, '0'), descricao: `CFOP alt ${seq}`, justificativa: MOTIVO });
      expect(outroCfop.status).toBe(201);
      const url = `/fiscal/enquadramentos/${base.enquadramentoId}`;
      const patch = await request(app.getHttpServer()).patch(url).set('Cookie', adminA)
        .send({ ...base.corpoEnquadramento, cfopId: outroCfop.body.id, versao: base.versaoEnquadramento });
      expect(patch.status).toBe(409);
      expect(codigoDe(patch.body)).toBe('ENQUADRAMENTO_COM_REGRA_ATIVA');
      expect((await detalharComo(adminA, fluxo.id)).body.cfopId).toBe(base.cfopId);
      const inativar = await request(app.getHttpServer()).post(`${url}/inativar`).set('Cookie', adminA)
        .send({ versao: base.versaoEnquadramento, justificativa: MOTIVO });
      expect(inativar.status).toBe(409);
      expect(codigoDe(inativar.body)).toBe('ENQUADRAMENTO_COM_REGRA_ATIVA');
      const remover = await request(app.getHttpServer()).delete(url).set('Cookie', adminA).send({ justificativa: MOTIVO });
      expect(remover.status).toBe(409);
      expect(codigoDe(remover.body)).toBe('ENQUADRAMENTO_COM_REGRA_ATIVA');
      const situacao = await db().execute(sql`SELECT situacao, deleted_at FROM enquadramentos_fiscais WHERE id = ${base.enquadramentoId}`);
      expect(situacao.rows[0]).toMatchObject({ situacao: 'ATIVA', deleted_at: null });
      // campo fora da chave continua editável
      const prioridade = await request(app.getHttpServer()).patch(url).set('Cookie', adminA)
        .send({ ...base.corpoEnquadramento, prioridade: 2, versao: base.versaoEnquadramento });
      expect(prioridade.status).toBe(200);
      // aposentada a regra, o enquadramento volta a poder inativar
      const aposentada = await request(app.getHttpServer()).post(`/fiscal/regras/${fluxo.id}/aposentar`).set('Cookie', adminB)
        .send({ versao: fluxo.aprovada.versao, justificativa: MOTIVO });
      expect(aposentada.status).toBe(200);
      const liberado = await request(app.getHttpServer()).post(`${url}/inativar`).set('Cookie', adminA)
        .send({ versao: prioridade.body.versao, justificativa: MOTIVO });
      expect(liberado.status).toBe(200);
    });

    it.each(['SUBMETIDA', 'APROVADA'])(
      'B6 (AD-33): regra %s bloqueia troca de chave, inativar e remover o enquadramento',
      async (situacao) => {
        const base = await cenario();
        const criada = await criarComo(adminA, ids(base));
        expect(criada.res.status).toBe(201);
        let versaoRegra = criada.res.body.versao as number;
        const sub = await submeterComo(adminA, criada.res.body.id, versaoRegra);
        expect(sub.status).toBe(200);
        versaoRegra = sub.body.versao;
        if (situacao === 'APROVADA') {
          const apr = await aprovarComo(adminB, criada.res.body.id, versaoRegra);
          expect(apr.status).toBe(200);
          versaoRegra = apr.body.versao;
        }
        const url = `/fiscal/enquadramentos/${base.enquadramentoId}`;
        const outroCfop = await request(app.getHttpServer()).post('/fiscal/cfops').set('Cookie', adminA)
          .send({ codigo: String(6100 + (seq % 80)).padStart(4, '0'), descricao: `CFOP ${situacao} ${seq}`, justificativa: MOTIVO });
        expect(outroCfop.status).toBe(201);
        const patch = await request(app.getHttpServer()).patch(url).set('Cookie', adminA)
          .send({ ...base.corpoEnquadramento, cfopId: outroCfop.body.id, versao: base.versaoEnquadramento });
        expect(patch.status).toBe(409);
        expect(codigoDe(patch.body)).toBe('ENQUADRAMENTO_COM_REGRA_ATIVA');
        const inativar = await request(app.getHttpServer()).post(`${url}/inativar`).set('Cookie', adminA)
          .send({ versao: base.versaoEnquadramento, justificativa: MOTIVO });
        expect(inativar.status).toBe(409);
        expect(codigoDe(inativar.body)).toBe('ENQUADRAMENTO_COM_REGRA_ATIVA');
        const remover = await request(app.getHttpServer()).delete(url).set('Cookie', adminA).send({ justificativa: MOTIVO });
        expect(remover.status).toBe(409);
        expect(codigoDe(remover.body)).toBe('ENQUADRAMENTO_COM_REGRA_ATIVA');
        const estado = await db().execute(sql`SELECT situacao, deleted_at FROM enquadramentos_fiscais WHERE id = ${base.enquadramentoId}`);
        expect(estado.rows[0]).toMatchObject({ situacao: 'ATIVA', deleted_at: null });
      },
    );

    it.each(['RASCUNHO', 'APOSENTADA'])('B6 (AD-33): regra %s não bloqueia inativar o enquadramento', async (situacao) => {
      const base = await cenario();
      if (situacao === 'RASCUNHO') {
        expect((await criarComo(adminA, ids(base))).res.status).toBe(201);
      } else {
        const fluxo = await aprovarFluxo(ids(base));
        const aposentada = await request(app.getHttpServer()).post(`/fiscal/regras/${fluxo.id}/aposentar`).set('Cookie', adminB)
          .send({ versao: fluxo.aprovada.versao, justificativa: MOTIVO });
        expect(aposentada.status).toBe(200);
      }
      const liberado = await request(app.getHttpServer()).post(`/fiscal/enquadramentos/${base.enquadramentoId}/inativar`)
        .set('Cookie', adminA).send({ versao: base.versaoEnquadramento, justificativa: MOTIVO });
      expect(liberado.status).toBe(200);
    });

    it.each(['inativar', 'remover'])('AD-33: rascunho sob enquadramento após %s não submete (422)', async (acao) => {
      const base = await cenario();
      const criada = await criarComo(adminA, ids(base));
      expect(criada.res.status).toBe(201);
      const url = `/fiscal/enquadramentos/${base.enquadramentoId}`;
      const alterado = acao === 'inativar'
        ? await request(app.getHttpServer()).post(`${url}/inativar`).set('Cookie', adminA)
          .send({ versao: base.versaoEnquadramento, justificativa: MOTIVO })
        : await request(app.getHttpServer()).delete(url).set('Cookie', adminA).send({ justificativa: MOTIVO });
      expect(alterado.status).toBe(200);
      const sub = await submeterComo(adminA, criada.res.body.id, criada.res.body.versao);
      expect(sub.status).toBe(422);
      expect(codigoDe(sub.body)).toBe('ENQUADRAMENTO_INDISPONIVEL');
      const regra = await db().execute(sql`SELECT situacao FROM regras_tributarias WHERE id = ${criada.res.body.id}`);
      expect(regra.rows[0]).toMatchObject({ situacao: 'RASCUNHO' });
    });

    it('B7: rascunho de versão 2 não troca de enquadramento; rascunho da v1 troca', async () => {
      const a = await cenario();
      const b = await cenario();
      const fluxo = await aprovarFluxo(ids(a));
      const v2 = await request(app.getHttpServer()).post(`/fiscal/regras/${fluxo.id}/versoes`).set('Cookie', adminA)
        .send({ ...fluxo.corpo, vigenciaInicio: '2027-01-01', vigenciaFim: null, versao: fluxo.aprovada.versao });
      expect(v2.status).toBe(201);
      const corpoB = corpoRegra(ids(b));
      const mover = await request(app.getHttpServer()).patch(`/fiscal/regras/${v2.body.id}`).set('Cookie', adminA)
        .send({ ...corpoB, versao: v2.body.versao });
      expect(mover.status).toBe(422);
      expect(codigoDe(mover.body)).toBe('LINHAGEM_ENQUADRAMENTO_FIXO');
      expect((await detalharComo(adminA, v2.body.id)).body.enquadramentoId).toBe(a.enquadramentoId);
      const v1 = await criarComo(adminA, ids(a));
      expect(v1.res.status).toBe(201);
      const livre = await request(app.getHttpServer()).patch(`/fiscal/regras/${v1.res.body.id}`).set('Cookie', adminA)
        .send({ ...corpoB, versao: v1.res.body.versao });
      expect(livre.status).toBe(200);
    });

    it('B8/M1: busca e ordenação da listagem', async () => {
      const base = await cenario();
      const fluxo = await aprovarFluxo(ids(base));
      const segunda = await criarComo(adminA, { ...ids(base), icmsCst: '00', pRedBc: '0,00' });
      expect(segunda.res.status).toBe(201);
      const listar = (query: Record<string, string>) =>
        request(app.getHttpServer()).get('/fiscal/regras').query({ cfopId: base.cfopId, ...query }).set('Cookie', adminA);
      const vazio = await request(app.getHttpServer()).get('/fiscal/regras').query({ search: 'zzzzznaoexiste' }).set('Cookie', adminA);
      expect(vazio.status).toBe(200);
      expect(vazio.body.total).toBe(0);
      const [beneficio] = await db().select().from(schema.beneficiosFiscais).where(eq(schema.beneficiosFiscais.id, base.beneficioFiscalId));
      expect((await listar({ search: beneficio!.descricao })).body.total).toBe(2);
      expect((await listar({ search: beneficio!.codigo.toLowerCase() })).body.total).toBe(2);
      expect((await listar({ search: 'zzzzznaoexiste' })).body.total).toBe(0);
      const contagem = await request(app.getHttpServer()).get('/fiscal/regras/contagens')
        .query({ cfopId: base.cfopId, search: 'zzzzznaoexiste' }).set('Cookie', adminA);
      expect(contagem.body.total).toBe(0);
      const csv = await request(app.getHttpServer()).get('/fiscal/regras/exportacao')
        .query({ cfopId: base.cfopId, search: 'zzzzznaoexiste' }).set('Cookie', adminA);
      expect(csv.text.split('\r\n')).toHaveLength(1);
      const asc = await listar({ sort: 'icmsCst', dir: 'asc' });
      const desc = await listar({ sort: 'icmsCst', dir: 'desc' });
      const trat = (r: { body: { data: Array<{ tratamentoIcms: string }> } }) => r.body.data.map((l) => l.tratamentoIcms);
      expect(trat(asc)).toEqual([schema.ROTULOS_ICMS_CST['00'], schema.ROTULOS_ICMS_CST['20']]);
      expect(trat(desc)).toEqual([schema.ROTULOS_ICMS_CST['20'], schema.ROTULOS_ICMS_CST['00']]);
      expect((await listar({ sort: 'inexistente' })).status).toBe(400);
      for (const sort of ['enquadramento', 'cfop', 'cBenef', 'cClassTrib', 'operacao']) {
        expect((await listar({ sort, dir: 'desc' })).status).toBe(200);
      }
      // empate na chave de ordenação: código da regra e id desempatam
      const empate = await listar({ sort: 'enquadramento' });
      expect(empate.body.data.map((l: { id: string }) => l.id)).toEqual([fluxo.id, segunda.res.body.id]);
    });

    it('M2: ordem natural por código do enquadramento', async () => {
      const lista = await request(app.getHttpServer()).get('/fiscal/regras').query({ pageSize: 100 }).set('Cookie', adminA);
      const codigos = (lista.body.data as Array<{ enquadramentoFiscal: string }>).map((l) => Number(l.enquadramentoFiscal));
      expect(codigos).toEqual([...codigos].sort((x, y) => x - y));
    });

    it('M9: versão nova da v1 com v2 aberta → 409 VERSAO_ABERTA antes de qualquer 422', async () => {
      const base = await cenario();
      const fluxo = await aprovarFluxo(ids(base));
      const v2 = await request(app.getHttpServer()).post(`/fiscal/regras/${fluxo.id}/versoes`).set('Cookie', adminA)
        .send({ ...fluxo.corpo, vigenciaInicio: '2027-01-01', vigenciaFim: null, versao: fluxo.aprovada.versao });
      expect(v2.status).toBe(201);
      await db().update(schema.beneficiosFiscais).set({ deletedAt: new Date() }).where(eq(schema.beneficiosFiscais.id, base.beneficioFiscalId));
      const v3 = await request(app.getHttpServer()).post(`/fiscal/regras/${fluxo.id}/versoes`).set('Cookie', adminA)
        .send({ ...fluxo.corpo, versao: fluxo.aprovada.versao });
      expect(v3.status).toBe(409);
      expect(codigoDe(v3.body)).toBe('VERSAO_ABERTA');
    });
  });

  describe('Portão A r1 do PR #166 — tratamento ICMS (AD-34), versão nova e auditoria', () => {
    it.each([
      ['00', '41,67', '12,00'],
      ['20', '0,00', '12,00'],
      ['40', '0,00', '12,00'],
      ['40', '41,67', '0,00'],
      ['41', '0,00', '12,00'],
      ['41', '10,00', '0,00'],
    ])('tratamento ICMS incoerente não grava: CST %s, redução %s, alíquota %s', async (icmsCst, pRedBc, pIcms) => {
      const base = await cenario();
      const { res } = await criarComo(adminA, {
        enquadramentoId: base.enquadramentoId,
        operacaoId: base.operacaoId,
        cfopId: base.cfopId,
        beneficioFiscalId: base.beneficioFiscalId,
        classificacaoIbsCbsId: base.classificacaoIbsCbsId,
        icmsCst,
        pRedBc,
        pIcms,
      });
      expect(res.status).toBe(422);
      expect(codigoDe(res.body)).toBe('TRATAMENTO_ICMS_INCOERENTE');
      expect(JSON.stringify(res.body)).not.toMatch(/\bCST\b/);
      const n = await db().execute(sql`SELECT COUNT(*)::int AS n FROM regras_tributarias WHERE enquadramento_id = ${base.enquadramentoId}::uuid`);
      expect(n.rows[0]).toMatchObject({ n: 0 });
    });

    it('tratamento ICMS incoerente não grava no PATCH, na versão nova nem na aprovação', async () => {
      const fluxo = await aprovarFluxo();
      const nova = await request(app.getHttpServer()).post(`/fiscal/regras/${fluxo.id}/versoes`).set('Cookie', adminA)
        .send({ ...fluxo.corpo, icmsCst: '40', vigenciaInicio: '2027-01-01', vigenciaFim: null, versao: fluxo.aprovada.versao });
      expect(nova.status).toBe(422);
      expect(codigoDe(nova.body)).toBe('TRATAMENTO_ICMS_INCOERENTE');

      const criada = await criarComo(adminA);
      expect(criada.res.status).toBe(201);
      const patch = await request(app.getHttpServer()).patch(`/fiscal/regras/${criada.res.body.id}`).set('Cookie', adminA)
        .send({ ...criada.corpo, icmsCst: '41', versao: criada.res.body.versao });
      expect(patch.status).toBe(422);
      expect(codigoDe(patch.body)).toBe('TRATAMENTO_ICMS_INCOERENTE');

      const submetida = await submeterComo(adminA, criada.res.body.id, criada.res.body.versao);
      expect(submetida.status).toBe(200);
      // Linha incoerente gravada antes da guarda: a aprovação também recusa.
      await db().execute(sql`UPDATE regras_tributarias SET icms_cst = '40' WHERE id = ${criada.res.body.id}::uuid`);
      const aprovada = await aprovarComo(adminB, criada.res.body.id, submetida.body.versao);
      expect(aprovada.status).toBe(422);
      expect(codigoDe(aprovada.body)).toBe('TRATAMENTO_ICMS_INCOERENTE');
    });

    it('isenção e não tributada com redução e alíquota 0 gravam e aprovam', async () => {
      const isenta = await aprovarFluxo({ icmsCst: '40', pRedBc: '0,00', pIcms: '0,00' });
      expect(isenta.aprovada.situacao).toBe('Aprovada');
      const naoTributada = await criarComo(adminA, { icmsCst: '41', pRedBc: '0,00', pIcms: '0,00' });
      expect(naoTributada.res.status).toBe(201);
    });

    it('diferimento grava rascunho e não aprova enquanto o tratamento está pendente', async () => {
      const criada = await criarComo(adminA, { icmsCst: '51' });
      expect(criada.res.status).toBe(201);
      const submetida = await submeterComo(adminA, criada.res.body.id, criada.res.body.versao);
      expect(submetida.status).toBe(200);
      const aprovada = await aprovarComo(adminB, criada.res.body.id, submetida.body.versao);
      expect(aprovada.status).toBe(422);
      expect(codigoDe(aprovada.body)).toBe('TRATAMENTO_ICMS_PENDENTE');
      const detalhe = await detalharComo(adminA, criada.res.body.id);
      expect(detalhe.body.situacao).toBe('Submetida');
    });

    it('versão nova a partir de versão antiga usa o maior número do código + 1', async () => {
      const fluxo = await aprovarFluxo();
      const v2 = await request(app.getHttpServer()).post(`/fiscal/regras/${fluxo.id}/versoes`).set('Cookie', adminA)
        .send({ ...fluxo.corpo, pIcms: '7,00', vigenciaInicio: '2027-01-01', vigenciaFim: null, versao: fluxo.aprovada.versao });
      expect(v2.status).toBe(201);
      const v2Sub = await submeterComo(adminA, v2.body.id, v2.body.versao);
      expect(v2Sub.status).toBe(200);
      const v2Apr = await aprovarComo(adminB, v2.body.id, v2Sub.body.versao);
      expect(v2Apr.status).toBe(200);
      const v3 = await request(app.getHttpServer()).post(`/fiscal/regras/${fluxo.id}/versoes`).set('Cookie', adminA)
        .send({ ...fluxo.corpo, pIcms: '8,00', vigenciaInicio: '2028-01-01', vigenciaFim: null, versao: fluxo.aprovada.versao });
      expect(v3.status).toBe(201);
      expect(v3.body.numeroVersao).toBe(3);
      expect(v3.body.codigo).toBe(fluxo.aprovada.codigo);
    });

    it('auditoria do PATCH de rascunho registra a alíquota antes e depois', async () => {
      const criada = await criarComo(adminA);
      expect(criada.res.status).toBe(201);
      const patch = await request(app.getHttpServer()).patch(`/fiscal/regras/${criada.res.body.id}`).set('Cookie', adminA)
        .send({ ...criada.corpo, pIcms: '7,00', versao: criada.res.body.versao });
      expect(patch.status).toBe(200);
      const linhas = await db().execute(sql`
        SELECT dados_anteriores, dados_novos FROM auditoria
        WHERE registro_id = ${criada.res.body.id}::uuid AND operacao = 'UPDATE'
      `);
      expect(linhas.rows).toHaveLength(1);
      const { dados_anteriores: antes, dados_novos: depois } = linhas.rows[0] as {
        dados_anteriores: Record<string, unknown>;
        dados_novos: Record<string, unknown>;
      };
      expect(antes).toMatchObject({ pIcms: '0.1200', icmsCst: '20', pRedBc: '0.4167', vigenciaInicio: '2026-01-01' });
      expect(depois).toMatchObject({ pIcms: '0.0700', icmsCst: '20', pRedBc: '0.4167', vigenciaFim: '2026-12-31' });
      expect(depois).toHaveProperty('beneficioFiscalId');
      expect(depois).toHaveProperty('classificacaoIbsCbsId');
    });
  });
});
