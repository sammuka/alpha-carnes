import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { eq, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { validarCnpjAlfanumerico } from '../../src/common/validators/cnpj-alfanumerico';
import { DRIZZLE } from '../../src/database/database.module';
import * as schema from '../../src/database/schema';
import { cleanupDb, createTestApp, createTestUser, joinSetCookie } from '../helpers/test-app';

const MOTIVO = 'Cadastro de enquadramento fiscal';
const UUID = '0199a1b2-c3d4-7e5f-8a6b-7c8d9e0f1a2b';

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

describe('E01-T02 enquadramentos fiscais', () => {
  let app: INestApplication;
  let adminA = '';
  let adminB = '';
  let gestor = '';
  let seq = 20;

  beforeAll(async () => {
    app = await createTestApp();
    const a = await createTestUser(app, { perfil: 'administrador' });
    const b = await createTestUser(app, { perfil: 'administrador' });
    const g = await createTestUser(app, { perfil: 'gestor' });
    adminA = joinSetCookie(await request(app.getHttpServer()).post('/auth/login').send({ email: a.adminEmail, password: a.adminPassword }));
    adminB = joinSetCookie(await request(app.getHttpServer()).post('/auth/login').send({ email: b.adminEmail, password: b.adminPassword }));
    gestor = joinSetCookie(await request(app.getHttpServer()).post('/auth/login').send({ email: g.adminEmail, password: g.adminPassword }));
  });

  afterAll(async () => {
    await cleanupDb(app);
    await app.close();
  });

  function db() {
    return app.get<{ db: NodePgDatabase<typeof schema> }>(DRIZZLE).db;
  }

  function raiz(): string {
    seq += 1;
    return `71EQ${String(seq).padStart(4, '0')}`;
  }

  function dataOp(): string {
    const dia = ((seq - 1) % 28) + 1;
    const mes = (Math.floor((seq - 1) / 28) % 12) + 1;
    return `2097-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
  }

  async function criarEmpresa(cookies: string, cnpjRaiz: string) {
    const res = await request(app.getHttpServer())
      .post('/fiscal/empresas')
      .set('Cookie', cookies)
      .send({ razaoSocial: `Empresa ${cnpjRaiz}`, cnpjRaiz, justificativa: MOTIVO });
    expect(res.status).toBe(201);
    return res.body as { id: string };
  }

  async function criarEstab(cookies: string, empresaId: string, cnpj: string, nome = 'Filial Osasco') {
    const res = await request(app.getHttpServer())
      .post('/fiscal/estabelecimentos')
      .set('Cookie', cookies)
      .send({
        empresaId,
        nome,
        cnpj,
        inscricaoEstadual: '123456789',
        inscricaoMunicipal: '98765',
        uf: 'SP',
        cnaes: [{ codigo: '6201501', descricao: 'Desenvolvimento', tipo: 'PRINCIPAL' }],
        justificativa: MOTIVO,
      });
    expect(res.status).toBe(201);
    return res.body as { id: string; versao: number };
  }

  async function aprovar(estabId: string, versao: number) {
    const submetido = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estabId}/submeter`)
      .set('Cookie', adminA)
      .send({ versao, justificativa: MOTIVO });
    expect(submetido.status).toBe(200);
    const aprovado = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estabId}/aprovar`)
      .set('Cookie', adminB)
      .send({ versao: submetido.body.versao, justificativa: MOTIVO });
    expect(aprovado.status).toBe(200);
    return aprovado.body as { id: string; versao: number; situacao: string };
  }

  async function baseAprovada(nomeProduto = 'Acém') {
    const cnpjRaiz = raiz();
    const empresa = await criarEmpresa(adminA, cnpjRaiz);
    const estab = await criarEstab(adminA, empresa.id, cnpjDe(`${cnpjRaiz}0001`));
    const aprovado = await aprovar(estab.id, estab.versao);
    const rotulo = `Compra ${cnpjRaiz}`;
    const operacao = await request(app.getHttpServer())
      .post('/operacoes/extraordinaria')
      .set('Cookie', adminA)
      .send({ data: dataOp(), rotulo });
    expect(operacao.status).toBe(201);
    const produto = await request(app.getHttpServer())
      .post('/produtos')
      .set('Cookie', adminA)
      .send({
        codigo: `P-${cnpjRaiz}`,
        nome: nomeProduto,
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
      .send({ codigo: String(5100 + (seq % 80)).padStart(4, '0'), descricao: `CFOP ${cnpjRaiz}`, justificativa: MOTIVO });
    expect(cfop.status).toBe(201);
    const ncm = await request(app.getHttpServer())
      .post('/fiscal/ncms')
      .set('Cookie', adminA)
      .send({ codigo: String(2000000 + seq).padStart(8, '0'), descricao: `NCM ${cnpjRaiz}`, justificativa: MOTIVO });
    expect(ncm.status).toBe(201);
    return {
      empresaId: empresa.id,
      estabelecimentoId: aprovado.id,
      estabelecimentoVersao: aprovado.versao as number,
      operacaoId: operacao.body.id as string,
      produtoId: produto.body.id as string,
      clienteId: cliente.body.id as string,
      cfopId: cfop.body.id as string,
      cfopCodigo: cfop.body.codigo as string,
      ncmId: ncm.body.id as string,
      rotulo,
    };
  }

  function corpo(base: Awaited<ReturnType<typeof baseAprovada>>, extra: Record<string, unknown> = {}) {
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

  async function linhasDo(estabelecimentoId: string): Promise<number> {
    const { rows } = await db().execute(sql`
      SELECT count(*)::int AS total FROM enquadramentos_fiscais WHERE estabelecimento_id = ${estabelecimentoId}
    `);
    return Number((rows[0] as { total: number }).total);
  }

  it('criar, editar, listar, inativar, reativar, remover', async () => {
    const base = await baseAprovada();
    const criado = await request(app.getHttpServer())
      .post('/fiscal/enquadramentos')
      .set('Cookie', adminA)
      .send(corpo(base));
    expect(criado.status).toBe(201);
    expect(criado.body.codigo).toMatch(/^[1-9][0-9]*$/);

    const lista = await request(app.getHttpServer())
      .get(`/fiscal/enquadramentos?estabelecimentoId=${base.estabelecimentoId}`)
      .set('Cookie', adminA);
    expect(lista.status).toBe(200);
    expect(lista.body.data).toEqual([expect.objectContaining({
      codigo: criado.body.codigo,
      operacao: base.rotulo,
    })]);
    const item = lista.body.data[0];
    expect(item.cfop).toBe(base.cfopCodigo);
    expect(item.tpNf).toBe('Saída');
    expect(item.finNfe).toBe('Operação normal');
    expect(item.estabelecimento).toBe('Filial Osasco');
    expect(JSON.stringify(item.operacao)).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/i);

    const { estabelecimentoId: _estab, ...editavel } = corpo(base);
    const editado = await request(app.getHttpServer())
      .patch(`/fiscal/enquadramentos/${criado.body.id}`)
      .set('Cookie', adminA)
      .send({ ...editavel, prioridade: 3, versao: criado.body.versao });
    expect(editado.status).toBe(200);
    expect(editado.body.prioridade).toBe(3);

    const inativo = await request(app.getHttpServer())
      .post(`/fiscal/enquadramentos/${criado.body.id}/inativar`)
      .set('Cookie', adminA)
      .send({ versao: editado.body.versao, justificativa: MOTIVO });
    expect(inativo.status).toBe(200);
    expect(inativo.body.situacao).toBe('INATIVA');

    const reativado = await request(app.getHttpServer())
      .post(`/fiscal/enquadramentos/${criado.body.id}/reativar`)
      .set('Cookie', adminA)
      .send({ versao: inativo.body.versao, justificativa: MOTIVO });
    expect(reativado.status).toBe(200);
    expect(reativado.body.situacao).toBe('ATIVA');

    const removido = await request(app.getHttpServer())
      .delete(`/fiscal/enquadramentos/${criado.body.id}`)
      .set('Cookie', adminA)
      .send({ justificativa: MOTIVO });
    expect(removido.status).toBe(200);
    const depois = await request(app.getHttpServer())
      .get(`/fiscal/enquadramentos/${criado.body.id}`)
      .set('Cookie', adminA);
    expect(depois.status).toBe(404);
  });

  it('GET detalhe após cada mutação devolve código, situação, vigência, CFOP e cliente', async () => {
    const base = await baseAprovada();
    const criado = await request(app.getHttpServer())
      .post('/fiscal/enquadramentos')
      .set('Cookie', adminA)
      .send(corpo(base));
    expect(criado.status).toBe(201);
    const detalhe = await request(app.getHttpServer())
      .get(`/fiscal/enquadramentos/${criado.body.id}`)
      .set('Cookie', adminA);
    expect(detalhe.status).toBe(200);
    expect(detalhe.body).toEqual(expect.objectContaining({
      codigo: criado.body.codigo,
      situacao: 'ATIVA',
      vigenciaInicio: '2026-01-01',
      cfopCodigo: base.cfopCodigo,
      clienteNome: 'Açougue Central',
      empresaNome: expect.stringContaining('Empresa'),
    }));
    expect(detalhe.body.ambiente).toBeUndefined();
  });

  it('duplicar grava origem e código novo', async () => {
    const base = await baseAprovada();
    const origem = await request(app.getHttpServer())
      .post('/fiscal/enquadramentos')
      .set('Cookie', adminA)
      .send(corpo(base, { vigenciaFim: '2026-06-30' }));
    expect(origem.status).toBe(201);
    const copia = await request(app.getHttpServer())
      .post(`/fiscal/enquadramentos/${origem.body.id}/duplicar`)
      .set('Cookie', adminA)
      .send({
        vigenciaInicio: '2026-07-01',
        versao: origem.body.versao,
        justificativa: MOTIVO,
      });
    expect(copia.status).toBe(201);
    expect(copia.body.codigo).not.toBe(origem.body.codigo);
    expect(copia.body.origemCodigo).toBe(origem.body.codigo);
    const origemDepois = await request(app.getHttpServer())
      .get(`/fiscal/enquadramentos/${origem.body.id}`)
      .set('Cookie', adminA);
    expect(origemDepois.body.codigo).toBe(origem.body.codigo);
    expect(origemDepois.body.vigenciaFim).toBe('2026-06-30');
    expect(origemDepois.body.versao).toBe(origem.body.versao);
  });

  it('mesma chave e vigência sobreposta, prioridade diferente → 409 ENQUADRAMENTO_SOBREPOSTO e uma linha só', async () => {
    const base = await baseAprovada();
    const primeiro = await request(app.getHttpServer())
      .post('/fiscal/enquadramentos')
      .set('Cookie', adminA)
      .send(corpo(base, { prioridade: 1 }));
    expect(primeiro.status).toBe(201);
    const segundo = await request(app.getHttpServer())
      .post('/fiscal/enquadramentos')
      .set('Cookie', adminA)
      .send(corpo(base, { prioridade: 9, vigenciaInicio: '2026-06-01', vigenciaFim: '2027-01-01' }));
    expect(segundo.status).toBe(409);
    expect(codigoDe(segundo.body)).toBe('ENQUADRAMENTO_SOBREPOSTO');
    expect(segundo.body.message.conflito).toEqual(expect.objectContaining({
      codigo: primeiro.body.codigo,
      prioridade: 1,
    }));
    expect(await linhasDo(base.estabelecimentoId)).toBe(1);
  });

  it('DRAFT e SUSPENDED → 422 ESTABELECIMENTO_NAO_APROVADO e zero linhas', async () => {
    const cnpjRaiz = raiz();
    const empresa = await criarEmpresa(adminA, cnpjRaiz);
    const rascunho = await criarEstab(adminA, empresa.id, cnpjDe(`${cnpjRaiz}0001`));
    const base = await baseAprovada();
    const draft = await request(app.getHttpServer())
      .post('/fiscal/enquadramentos')
      .set('Cookie', adminA)
      .send(corpo(base, { estabelecimentoId: rascunho.id }));
    expect(draft.status).toBe(422);
    expect(codigoDe(draft.body)).toBe('ESTABELECIMENTO_NAO_APROVADO');
    expect(await linhasDo(rascunho.id)).toBe(0);

    const suspensoBase = await baseAprovada();
    const suspenso = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${suspensoBase.estabelecimentoId}/suspender`)
      .set('Cookie', adminB)
      .send({ versao: suspensoBase.estabelecimentoVersao, justificativa: MOTIVO });
    expect(suspenso.status).toBe(200);
    const negado = await request(app.getHttpServer())
      .post('/fiscal/enquadramentos')
      .set('Cookie', adminA)
      .send(corpo(suspensoBase));
    expect(negado.status).toBe(422);
    expect(codigoDe(negado.body)).toBe('ESTABELECIMENTO_NAO_APROVADO');
    expect(await linhasDo(suspensoBase.estabelecimentoId)).toBe(0);
  });

  it('produto inativo, cliente inativo e operação removida', async () => {
    const base = await baseAprovada();
    await request(app.getHttpServer())
      .patch(`/produtos/${base.produtoId}`)
      .set('Cookie', adminA)
      .send({ status: 'inativo' });
    const produto = await request(app.getHttpServer())
      .post('/fiscal/enquadramentos')
      .set('Cookie', adminA)
      .send(corpo(base));
    expect(produto.status).toBe(422);
    expect(codigoDe(produto.body)).toBe('PRODUTO_INATIVO');

    const baseCliente = await baseAprovada();
    await request(app.getHttpServer())
      .patch(`/clientes/${baseCliente.clienteId}`)
      .set('Cookie', adminA)
      .send({ status: 'inativo' });
    const cliente = await request(app.getHttpServer())
      .post('/fiscal/enquadramentos')
      .set('Cookie', adminA)
      .send(corpo(baseCliente));
    expect(cliente.status).toBe(422);
    expect(codigoDe(cliente.body)).toBe('CLIENTE_INATIVO');

    const baseOp = await baseAprovada();
    await db().update(schema.operacoes).set({ deletedAt: new Date() }).where(eq(schema.operacoes.id, baseOp.operacaoId));
    const operacao = await request(app.getHttpServer())
      .post('/fiscal/enquadramentos')
      .set('Cookie', adminA)
      .send(corpo(baseOp));
    expect(operacao.status).toBe(422);
    expect(codigoDe(operacao.body)).toBe('OPERACAO_INDISPONIVEL');
  });

  it('cada mutação grava 1 auditoria', async () => {
    const base = await baseAprovada();
    const criado = await request(app.getHttpServer())
      .post('/fiscal/enquadramentos')
      .set('Cookie', adminA)
      .send(corpo(base));
    expect(criado.status).toBe(201);
    const contar = async () => {
      const linhas = await db().select().from(schema.auditoria).where(eq(schema.auditoria.registroId, criado.body.id));
      return linhas.filter((l) => l.modulo === 'fiscal.enquadramentos');
    };
    expect(await contar()).toHaveLength(1);
    const { estabelecimentoId: _estabAud, ...editavelAud } = corpo(base);
    const editado = await request(app.getHttpServer())
      .patch(`/fiscal/enquadramentos/${criado.body.id}`)
      .set('Cookie', adminA)
      .send({ ...editavelAud, prioridade: 2, versao: criado.body.versao });
    expect(editado.status).toBe(200);
    expect(await contar()).toHaveLength(2);
  });

  it('histórico sem nome de tabela nem uuid', async () => {
    const base = await baseAprovada();
    const criado = await request(app.getHttpServer())
      .post('/fiscal/enquadramentos')
      .set('Cookie', adminA)
      .send(corpo(base));
    const historico = await request(app.getHttpServer())
      .get(`/fiscal/enquadramentos/${criado.body.id}/historico`)
      .set('Cookie', adminA);
    expect(historico.status).toBe(200);
    const texto = JSON.stringify(historico.body);
    expect(texto).not.toMatch(/enquadramentos_fiscais|cfops|ncms/);
    expect(texto).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    expect(historico.body[0]).toEqual(expect.objectContaining({
      operacao: 'INSERT',
      usuarioNome: 'Test administrador',
      justificativa: MOTIVO,
    }));
  });

  it('POST não altera produtos.atributos_json, operacoes nem estabelecimentos', async () => {
    const base = await baseAprovada();
    const produtoAntes = await db().select().from(schema.produtos).where(eq(schema.produtos.id, base.produtoId));
    const opAntes = await db().select().from(schema.operacoes).where(eq(schema.operacoes.id, base.operacaoId));
    const estabAntes = await db().select().from(schema.estabelecimentos).where(eq(schema.estabelecimentos.id, base.estabelecimentoId));
    const criado = await request(app.getHttpServer())
      .post('/fiscal/enquadramentos')
      .set('Cookie', adminA)
      .send(corpo(base));
    expect(criado.status).toBe(201);
    const produtoDepois = await db().select().from(schema.produtos).where(eq(schema.produtos.id, base.produtoId));
    const opDepois = await db().select().from(schema.operacoes).where(eq(schema.operacoes.id, base.operacaoId));
    const estabDepois = await db().select().from(schema.estabelecimentos).where(eq(schema.estabelecimentos.id, base.estabelecimentoId));
    expect(produtoDepois[0]!.atributosJson).toEqual(produtoAntes[0]!.atributosJson);
    expect(opDepois[0]).toEqual(opAntes[0]);
    expect(estabDepois[0]!.situacao).toBe('APPROVED');
    expect(estabDepois[0]!.versao).toBe(estabAntes[0]!.versao);
  });

  it('gestor sem FISCAL_ENQUADRAMENTOS_* → 403 em toda rota', async () => {
    const rotas: Array<[string, string]> = [
      ['get', '/fiscal/enquadramentos'],
      ['get', '/fiscal/enquadramentos/contagens'],
      ['get', '/fiscal/enquadramentos/exportacao'],
      ['post', '/fiscal/enquadramentos'],
      ['get', `/fiscal/enquadramentos/${UUID}`],
      ['patch', `/fiscal/enquadramentos/${UUID}`],
      ['post', `/fiscal/enquadramentos/${UUID}/duplicar`],
      ['post', `/fiscal/enquadramentos/${UUID}/inativar`],
      ['post', `/fiscal/enquadramentos/${UUID}/reativar`],
      ['delete', `/fiscal/enquadramentos/${UUID}`],
      ['get', `/fiscal/enquadramentos/${UUID}/historico`],
      ['get', `/fiscal/enquadramentos/${UUID}/pre-condicoes`],
    ];
    for (const [metodo, rota] of rotas) {
      const res = await request(app.getHttpServer())[metodo as 'get'](rota).set('Cookie', gestor).send({ justificativa: MOTIVO });
      expect(res.status).toBe(403);
    }
  });

  it('não existe rota aprovar', async () => {
    const res = await request(app.getHttpServer())
      .post(`/fiscal/enquadramentos/${UUID}/aprovar`)
      .set('Cookie', adminA)
      .send({ versao: 1, justificativa: MOTIVO });
    expect(res.status).toBe(404);
  });

  it('inativar é a reversão e a consulta deixa de localizar', async () => {
    const base = await baseAprovada();
    const criado = await request(app.getHttpServer())
      .post('/fiscal/enquadramentos')
      .set('Cookie', adminA)
      .send(corpo(base));
    expect(criado.status).toBe(201);
    const criterio = {
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
    };
    const localizado = await request(app.getHttpServer())
      .post('/fiscal/enquadramentos/consulta')
      .set('Cookie', adminA)
      .send(criterio);
    expect(localizado.status).toBe(422);
    expect(codigoDe(localizado.body)).toBe('REGRA_APROVADA_AUSENTE');
    expect(localizado.body.message.enquadramentoLocalizado.codigo).toBe(criado.body.codigo);

    const inativo = await request(app.getHttpServer())
      .post(`/fiscal/enquadramentos/${criado.body.id}/inativar`)
      .set('Cookie', adminA)
      .send({ versao: criado.body.versao, justificativa: MOTIVO });
    expect(inativo.status).toBe(200);

    const depois = await request(app.getHttpServer())
      .post('/fiscal/enquadramentos/consulta')
      .set('Cookie', adminA)
      .send(criterio);
    expect(depois.status).toBe(422);
    expect(codigoDe(depois.body)).toBe('REGRA_APROVADA_AUSENTE');
    expect(depois.body.message.enquadramentoLocalizado).toBeNull();
  });

  it('exportação CSV com rótulos do plano, BOM e sem id', async () => {
    const base = await baseAprovada();
    const criado = await request(app.getHttpServer())
      .post('/fiscal/enquadramentos')
      .set('Cookie', adminA)
      .send(corpo(base));
    expect(criado.status).toBe(201);
    const res = await request(app.getHttpServer())
      .get(`/fiscal/enquadramentos/exportacao?estabelecimentoId=${base.estabelecimentoId}`)
      .set('Cookie', adminA);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.text.charCodeAt(0)).toBe(0xfeff);
    const cabecalho = [
      'Código',
      'Operação',
      'Operação fiscal (CFOP)',
      'Início de vigência',
      'Fim de vigência',
      'Estabelecimento',
      'Tipo da nota',
      'Finalidade',
      'Situação',
      'Responsável',
      'Produto',
      'Cliente',
      'Classificação fiscal (NCM)',
      'Substituição tributária (CEST)',
      'Prioridade',
      'Abrangência da operação',
      'Origem do produto',
    ].join(';');
    expect(res.text).toContain(cabecalho);
    expect(res.text).toContain(criado.body.codigo);
    expect(res.text).toContain(base.rotulo);
    expect(res.text).toContain(base.cfopCodigo);
    expect(res.text).toContain('2026-01-01');
    expect(res.text).toContain('2026-12-31');
    expect(res.text).toContain('Filial Osasco');
    expect(res.text).toContain('Saída');
    expect(res.text).toContain('Operação normal');
    expect(res.text).toContain('Ativa');
    expect(res.text).toContain('Test administrador');
    expect(res.text).toContain('Acém');
    expect(res.text).toContain('Açougue Central');
    expect(res.text).toContain('1708700');
    expect(res.text).toContain('Dentro do estado');
    expect(res.text).toContain('Revenda');
    expect(res.text).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/i);
    expect(res.text).not.toMatch(/Marca/);
  });

  it('DUPLA_APROVACAO provisoria=true e atendida=false', async () => {
    const base = await baseAprovada();
    const criado = await request(app.getHttpServer())
      .post('/fiscal/enquadramentos')
      .set('Cookie', adminA)
      .send(corpo(base));
    expect(criado.status).toBe(201);
    const res = await request(app.getHttpServer())
      .get(`/fiscal/enquadramentos/${criado.body.id}/pre-condicoes`)
      .set('Cookie', adminA);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.arrayContaining([
      { codigo: 'ESTABELECIMENTO_APROVADO', atendida: true, provisoria: false },
      { codigo: 'VIGENCIA_INFORMADA', atendida: true, provisoria: false },
      { codigo: 'CHAVE_COMPLETA', atendida: true, provisoria: false },
      { codigo: 'PRIORIDADE_SEMANTICA', atendida: false, provisoria: true },
      { codigo: 'DESEMPATE_DEFINIDO', atendida: false, provisoria: true },
      { codigo: 'TABELA_OFICIAL_CFOP_NCM', atendida: false, provisoria: true },
      { codigo: 'CEST_VINCULADO_AO_NCM', atendida: false, provisoria: true },
      { codigo: 'DATAS_COMERCIAL_FISCAL_EFETIVA', atendida: false, provisoria: true },
      { codigo: 'DUPLA_APROVACAO', atendida: false, provisoria: true },
    ]));
    const dupla = res.body.find((item: { codigo: string }) => item.codigo === 'DUPLA_APROVACAO');
    expect(dupla).toEqual({ codigo: 'DUPLA_APROVACAO', atendida: false, provisoria: true });
  });

  it('sem vigenciaInicio → 400', async () => {
    const base = await baseAprovada();
    const corpoSem = corpo(base);
    delete (corpoSem as { vigenciaInicio?: string }).vigenciaInicio;
    const res = await request(app.getHttpServer())
      .post('/fiscal/enquadramentos')
      .set('Cookie', adminA)
      .send(corpoSem);
    expect(res.status).toBe(400);
  });

  it.each(['0000-01-01', '1899-12-31'])('vigenciaInicio %s → 400 e nenhuma linha', async (data) => {
    const base = await baseAprovada();
    const res = await request(app.getHttpServer())
      .post('/fiscal/enquadramentos')
      .set('Cookie', adminA)
      .send(corpo(base, { vigenciaInicio: data, vigenciaFim: undefined }));
    expect(res.status).toBe(400);
    const fim = await request(app.getHttpServer())
      .post('/fiscal/enquadramentos')
      .set('Cookie', adminA)
      .send(corpo(base, { vigenciaFim: data }));
    expect(fim.status).toBe(400);
    expect(await linhasDo(base.estabelecimentoId)).toBe(0);
  });

  it('justificativa com NUL → 400', async () => {
    const base = await baseAprovada();
    const res = await request(app.getHttpServer())
      .post('/fiscal/enquadramentos')
      .set('Cookie', adminA)
      .send(corpo(base, { justificativa: 'motivo\u0000x' }));
    expect(res.status).toBe(400);
  });

  it.each(['=1+1', '+1', '-1', '@SOMA(A1)'])('exportação CSV neutraliza fórmula %s no nome do produto', async (nome) => {
    const base = await baseAprovada(nome);
    const criado = await request(app.getHttpServer())
      .post('/fiscal/enquadramentos')
      .set('Cookie', adminA)
      .send(corpo(base));
    expect(criado.status).toBe(201);
    const res = await request(app.getHttpServer())
      .get(`/fiscal/enquadramentos/exportacao?estabelecimentoId=${base.estabelecimentoId}`)
      .set('Cookie', adminA);
    expect(res.status).toBe(200);
    expect(res.text).toContain(`;'${nome};`);
    expect(res.text).not.toContain(`;${nome};`);
  });
});
