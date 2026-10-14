import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { eq, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { validarCnpjAlfanumerico } from '../../src/common/validators/cnpj-alfanumerico';
import { DRIZZLE } from '../../src/database/database.module';
import * as schema from '../../src/database/schema';
import { cleanupDb, createTestApp, createTestUser, joinSetCookie } from '../helpers/test-app';

const MOTIVO = 'Cadastro de enquadramento fiscal';
const CODIGO_EMPATE = '900000000000000099';

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

function codigoDe(body: { message?: { codigo?: string } | string }): string | undefined {
  return typeof body.message === 'object' ? body.message.codigo : undefined;
}

describe('E01-T02 consulta de enquadramento', () => {
  let app: INestApplication;
  let adminA = '';
  let adminB = '';
  let seq = 80;
  let fetchSpy: jest.SpiedFunction<typeof fetch>;

  beforeAll(async () => {
    app = await createTestApp();
    const a = await createTestUser(app, { perfil: 'administrador' });
    const b = await createTestUser(app, { perfil: 'administrador' });
    adminA = joinSetCookie(await request(app.getHttpServer()).post('/auth/login').send({ email: a.adminEmail, password: a.adminPassword }));
    adminB = joinSetCookie(await request(app.getHttpServer()).post('/auth/login').send({ email: b.adminEmail, password: b.adminPassword }));
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockClear();
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
    return `71CS${String(seq).padStart(4, '0')}`;
  }

  function dataOp(): string {
    const dia = ((seq - 1) % 28) + 1;
    const mes = (Math.floor((seq - 1) / 28) % 12) + 1;
    return `2098-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
  }

  async function baseAprovada() {
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
      .send({
        codigo: `P-${cnpjRaiz}`,
        nome: 'Acém',
        unidadePedido: 'kg',
        atributosJson: { fiscal: { ncm: '99999999', cfop: '9999' } },
      });
    expect(produto.status).toBe(201);
    const cliente = await request(app.getHttpServer())
      .post('/clientes')
      .set('Cookie', adminA)
      .send({
        codigo: `C-${cnpjRaiz}`,
        razaoSocial: 'Açougue Central LTDA',
        nomeFantasia: 'Açougue Central',
        documentoFiscal: cnpjNumerico(`9${String(seq).padStart(11, '0')}`),
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
    return {
      estabelecimentoId: aprovado.body.id as string,
      operacaoId: operacao.body.id as string,
      produtoId: produto.body.id as string,
      clienteId: cliente.body.id as string,
      cfopId: cfop.body.id as string,
      ncmId: ncm.body.id as string,
      cnpjRaiz,
    };
  }

  function gravar(base: Awaited<ReturnType<typeof baseAprovada>>, extra: Record<string, unknown> = {}) {
    return {
      estabelecimentoId: base.estabelecimentoId,
      operacaoId: base.operacaoId,
      tpNf: '1',
      finNfe: '1',
      cfopId: base.cfopId,
      abrangencia: 'INTERNA',
      tipoProduto: 'REVENDA',
      produtoId: base.produtoId,
      ncmId: base.ncmId,
      cest: '1708700',
      clienteId: base.clienteId,
      vigenciaInicio: '2026-01-01',
      vigenciaFim: '2026-12-31',
      prioridade: 1,
      justificativa: MOTIVO,
      ...extra,
    };
  }

  function criterio(base: Awaited<ReturnType<typeof baseAprovada>>, extra: Record<string, unknown> = {}) {
    return {
      estabelecimentoId: base.estabelecimentoId,
      data: '2026-06-15',
      operacaoId: base.operacaoId,
      tpNf: '1',
      finNfe: '1',
      cfopId: base.cfopId,
      abrangencia: 'INTERNA',
      tipoProduto: 'REVENDA',
      produtoId: base.produtoId,
      ncmId: base.ncmId,
      cest: '1708700',
      clienteId: base.clienteId,
      ...extra,
    };
  }

  async function criar(base: Awaited<ReturnType<typeof baseAprovada>>, extra: Record<string, unknown> = {}) {
    const res = await request(app.getHttpServer())
      .post('/fiscal/enquadramentos')
      .set('Cookie', adminA)
      .send(gravar(base, extra));
    expect(res.status).toBe(201);
    return res.body as { id: string; codigo: string; versao: number };
  }

  function consultar(cookies: string, body: Record<string, unknown>) {
    return request(app.getHttpServer())
      .post('/fiscal/enquadramentos/consulta')
      .set('Cookie', cookies)
      .send(body);
  }

  async function auditoriaDo(registroId: string): Promise<number> {
    const linhas = await db().select().from(schema.auditoria).where(eq(schema.auditoria.registroId, registroId));
    return linhas.length;
  }

  it('corpo { cfopId } → 400 e nenhuma linha lida como escolhida', async () => {
    const base = await baseAprovada();
    const antes = await db().execute(sql`SELECT count(*)::int AS total FROM enquadramentos_fiscais`);
    const soCfop = await consultar(adminA, { cfopId: base.cfopId });
    const soCodigo = await consultar(adminA, { cfopCodigo: '5102' });
    const depois = await db().execute(sql`SELECT count(*)::int AS total FROM enquadramentos_fiscais`);
    expect(soCfop.status).toBe(400);
    expect(soCodigo.status).toBe(400);
    expect(soCfop.body.vencedor).toBeUndefined();
    expect(soCfop.body.message?.enquadramentoLocalizado).toBeUndefined();
    expect(soCodigo.body.message?.enquadramentoLocalizado).toBeUndefined();
    expect(antes.rows[0]).toEqual(depois.rows[0]);
  });

  it('0 linhas → 422 REGRA_APROVADA_AUSENTE', async () => {
    const base = await baseAprovada();
    const res = await consultar(adminA, criterio(base));
    expect(res.status).toBe(422);
    expect(codigoDe(res.body)).toBe('REGRA_APROVADA_AUSENTE');
    expect(res.body.message.message).toBe(
      'Nenhum enquadramento vigente cobre o critério e não há regra tributária aprovada.',
    );
    expect(res.body.message.enquadramentoLocalizado).toBeNull();
    expect(res.body.vencedor).toBeUndefined();
  });

  it('data anterior ao início → REGRA_APROVADA_AUSENTE com enquadramentoLocalizado null', async () => {
    const base = await baseAprovada();
    await criar(base);
    const res = await consultar(adminA, criterio(base, { data: '2025-12-31' }));
    expect(res.status).toBe(422);
    expect(codigoDe(res.body)).toBe('REGRA_APROVADA_AUSENTE');
    expect(res.body.message.enquadramentoLocalizado).toBeNull();
  });

  it('1 linha → 422 REGRA_APROVADA_AUSENTE com enquadramentoLocalizado.codigo e sem cst/aliquota/ibs/cbs', async () => {
    const base = await baseAprovada();
    const criado = await criar(base);
    const antesAuditoria = await auditoriaDo(criado.id);
    const res = await consultar(adminA, criterio(base));
    expect(res.status).toBe(422);
    expect(codigoDe(res.body)).toBe('REGRA_APROVADA_AUSENTE');
    expect(res.body.message.message).toBe(
      'O enquadramento foi localizado, mas o tributo não é resolvido nesta tela.',
    );
    expect(res.body.message.enquadramentoLocalizado).toEqual({
      codigo: criado.codigo,
      vigenciaInicio: '2026-01-01',
      vigenciaFim: '2026-12-31',
    });
    expect(JSON.stringify(res.body)).not.toMatch(/cst|aliquota|icms|ipi|pis|cofins|ibs|cbs|cBenef|cClassTrib/i);
    expect(res.body.vencedor).toBeUndefined();
    expect(res.body.message.vencedor).toBeUndefined();
    expect(await auditoriaDo(criado.id)).toBe(antesAuditoria);
  });

  it('consulta não abre socket HTTP', async () => {
    const base = await baseAprovada();
    await criar(base);
    fetchSpy.mockClear();
    const res = await consultar(adminA, criterio(base));
    expect(res.status).toBe(422);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('dois perfis com o mesmo CFOP e produtos diferentes: a consulta da chave de A localiza só o código de A', async () => {
    const base = await baseAprovada();
    const perfilA = await criar(base);
    const produtoB = await request(app.getHttpServer())
      .post('/produtos')
      .set('Cookie', adminA)
      .send({
        codigo: `PB-${base.cnpjRaiz}`,
        nome: 'Patinho',
        unidadePedido: 'kg',
        atributosJson: { fiscal: { ncm: '99999999', cfop: '9999' } },
      });
    expect(produtoB.status).toBe(201);
    const perfilB = await criar(base, { produtoId: produtoB.body.id, prioridade: 4 });
    const res = await consultar(adminA, criterio(base));
    expect(res.status).toBe(422);
    expect(res.body.message.enquadramentoLocalizado.codigo).toBe(perfilA.codigo);
    expect(res.body.message.enquadramentoLocalizado.codigo).not.toBe(perfilB.codigo);
  });

  it('duas linhas sobrepostas inseridas → 422 EMPATE_ENQUADRAMENTO sem vencedor', async () => {
    const base = await baseAprovada();
    const criado = await criar(base, { prioridade: 1 });
    await db().execute(sql`
      INSERT INTO enquadramentos_fiscais (
        codigo, empresa_id, estabelecimento_id, operacao_id, tp_nf, fin_nfe, cfop_id,
        abrangencia, tipo_produto, produto_id, ncm_id, cest, cliente_id,
        vigencia_inicio, vigencia_fim, prioridade, situacao, criado_por_id, atualizado_por_id
      )
      SELECT
        ${CODIGO_EMPATE}, empresa_id, estabelecimento_id, operacao_id, tp_nf, fin_nfe, cfop_id,
        abrangencia, tipo_produto, produto_id, ncm_id, cest, cliente_id,
        vigencia_inicio, vigencia_fim, 99, situacao, criado_por_id, atualizado_por_id
      FROM enquadramentos_fiscais
      WHERE id = ${criado.id}
    `);
    const antesAuditoria = await auditoriaDo(criado.id);
    const res = await consultar(adminA, criterio(base));
    expect(res.status).toBe(422);
    expect(codigoDe(res.body)).toBe('EMPATE_ENQUADRAMENTO');
    expect(res.body.message.message).toBe(
      'Há mais de um enquadramento vigente para este critério. Nenhum foi escolhido.',
    );
    expect(res.body.message.candidatos.map((c: { codigo: string }) => c.codigo)).toEqual(
      [criado.codigo, CODIGO_EMPATE].sort(),
    );
    expect(res.body.message.candidatos).toEqual(expect.arrayContaining([
      { codigo: criado.codigo, prioridade: 1 },
      { codigo: CODIGO_EMPATE, prioridade: 99 },
    ]));
    expect(res.body.vencedor).toBeUndefined();
    expect(res.body.message.vencedor).toBeUndefined();
    expect(res.body.message.escolhido).toBeUndefined();
    expect(res.body.message.tributo).toBeUndefined();
    expect(res.body.message.enquadramentoLocalizado).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toMatch(/cst|aliquota|icms|ipi|pis|cofins|ibs|cbs|cBenef|cClassTrib/i);
    expect(await auditoriaDo(criado.id)).toBe(antesAuditoria);
  });

  it('inativar é a reversão e a consulta deixa de localizar', async () => {
    const base = await baseAprovada();
    const criado = await criar(base);
    const inativo = await request(app.getHttpServer())
      .post(`/fiscal/enquadramentos/${criado.id}/inativar`)
      .set('Cookie', adminA)
      .send({ versao: criado.versao, justificativa: MOTIVO });
    expect(inativo.status).toBe(200);
    const res = await consultar(adminA, criterio(base));
    expect(res.status).toBe(422);
    expect(codigoDe(res.body)).toBe('REGRA_APROVADA_AUSENTE');
    expect(res.body.message.enquadramentoLocalizado).toBeNull();
  });
});
