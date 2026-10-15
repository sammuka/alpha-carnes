import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { validarCnpjAlfanumerico } from '../../src/common/validators/cnpj-alfanumerico';
import { DRIZZLE } from '../../src/database/database.module';
import * as schema from '../../src/database/schema';
import { cleanupDb, createTestApp, createTestUser, joinSetCookie } from '../helpers/test-app';

const MOTIVO = 'Regra inicial da vigência de 2026.';
const DESCRICAO = 'Revisão da versão aprovada para publicação.';
const JUSTIFICATIVA = 'Abertura da revisão desta versão.';

function codigoDe(body: { codigo?: string; message?: { codigo?: string } | string }): string | undefined {
  if (typeof body.codigo === 'string') return body.codigo;
  return typeof body.message === 'object' ? body.message.codigo : undefined;
}

function mensagemDe(body: { message?: { message?: string } | string }): string | undefined {
  if (typeof body.message === 'string') return body.message;
  return body.message?.message;
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

describe('E01-T05 homologações de regras', () => {
  let app: INestApplication;
  let admin = '';
  let adminB = '';
  let gestor = '';
  let leitor = '';
  let seq = 110;

  beforeAll(async () => {
    app = await createTestApp();
    const a = await createTestUser(app, { perfil: 'administrador' });
    const g = await createTestUser(app, { perfil: 'gestor' });
    const l = await createTestUser(app, { perfil: 'diretoria' });
    await app.get<{ db: NodePgDatabase<typeof schema> }>(DRIZZLE).db.execute(sql`
      INSERT INTO perfis_permissoes (perfil_id, permissao_id)
      SELECT p.id, perm.id
      FROM perfis p
      JOIN permissoes perm ON perm.codigo = 'FISCAL_HOMOLOGACOES_LER'
      WHERE p.slug = 'diretoria'
      ON CONFLICT ON CONSTRAINT uq_perfil_permissao DO NOTHING
    `);
    admin = joinSetCookie(await request(app.getHttpServer()).post('/auth/login').send({ email: a.adminEmail, password: a.adminPassword }));
    gestor = joinSetCookie(await request(app.getHttpServer()).post('/auth/login').send({ email: g.adminEmail, password: g.adminPassword }));
    leitor = joinSetCookie(await request(app.getHttpServer()).post('/auth/login').send({ email: l.adminEmail, password: l.adminPassword }));
    const emailB = `admin-b-hom-${Date.now()}@test.local`;
    const senhaB = 'TestPass@123456';
    const criado = await request(app.getHttpServer())
      .post('/usuarios')
      .set('Cookie', admin)
      .send({ nome: 'Admin B', email: emailB, password: senhaB, perfis: ['administrador'] });
    expect(criado.status).toBe(201);
    adminB = joinSetCookie(await request(app.getHttpServer()).post('/auth/login').send({ email: emailB, password: senhaB }));
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
    return `71HM${String(seq).padStart(4, '0')}`;
  }

  function dataOp(): string {
    const dia = ((seq - 1) % 28) + 1;
    const mes = (Math.floor((seq - 1) / 28) % 12) + 1;
    return `2096-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
  }

  async function baseFiscal() {
    const cnpjRaiz = raiz();
    const empresa = await request(app.getHttpServer())
      .post('/fiscal/empresas')
      .set('Cookie', admin)
      .send({ razaoSocial: `Empresa ${cnpjRaiz}`, cnpjRaiz, justificativa: MOTIVO });
    expect(empresa.status).toBe(201);
    const estab = await request(app.getHttpServer())
      .post('/fiscal/estabelecimentos')
      .set('Cookie', admin)
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
      .set('Cookie', admin)
      .send({ versao: estab.body.versao, justificativa: MOTIVO });
    expect(submetido.status).toBe(200);
    const aprovado = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.body.id}/aprovar`)
      .set('Cookie', adminB)
      .send({ versao: submetido.body.versao, justificativa: MOTIVO });
    expect(aprovado.status).toBe(200);
    const operacao = await request(app.getHttpServer())
      .post('/operacoes/extraordinaria')
      .set('Cookie', admin)
      .send({ data: dataOp(), rotulo: `Compra ${cnpjRaiz}` });
    expect(operacao.status).toBe(201);
    const produto = await request(app.getHttpServer())
      .post('/produtos')
      .set('Cookie', admin)
      .send({ codigo: `P-${cnpjRaiz}`, nome: 'Acém', unidadePedido: 'kg', atributosJson: { fiscal: { ncm: '99999999', cfop: '9999' } } });
    expect(produto.status).toBe(201);
    const cliente = await request(app.getHttpServer())
      .post('/clientes')
      .set('Cookie', admin)
      .send({
        codigo: `C-${cnpjRaiz}`,
        razaoSocial: 'Açougue Central LTDA',
        nomeFantasia: 'Açougue Central',
        documentoFiscal: cnpjNumerico(`7${String(seq).padStart(11, '0')}`),
        faixaPreco: 'A',
      });
    expect(cliente.status).toBe(201);
    const cfop = await request(app.getHttpServer())
      .post('/fiscal/cfops')
      .set('Cookie', admin)
      .send({ codigo: String(6100 + (seq % 80)).padStart(4, '0'), descricao: `CFOP ${cnpjRaiz}`, justificativa: MOTIVO });
    expect(cfop.status).toBe(201);
    const ncm = await request(app.getHttpServer())
      .post('/fiscal/ncms')
      .set('Cookie', admin)
      .send({ codigo: String(5000000 + seq).padStart(8, '0'), descricao: `NCM ${cnpjRaiz}`, justificativa: MOTIVO });
    expect(ncm.status).toBe(201);
    const enquadramento = await request(app.getHttpServer())
      .post('/fiscal/enquadramentos')
      .set('Cookie', admin)
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
      .set('Cookie', admin)
      .send({ codigo: `SP${String(500000 + seq).padStart(6, '0')}`, descricao: `Benefício ${cnpjRaiz}`, justificativa: MOTIVO });
    expect(beneficio.status).toBe(201);
    const classificacao = await request(app.getHttpServer())
      .post('/fiscal/classificacoes-ibs-cbs')
      .set('Cookie', admin)
      .send({ codigo: String(200000 + seq).padStart(6, '0'), descricao: `Classificação ${cnpjRaiz}`, justificativa: MOTIVO });
    expect(classificacao.status).toBe(201);
    return {
      enquadramentoId: enquadramento.body.id as string,
      operacaoId: operacao.body.id as string,
      cfopId: cfop.body.id as string,
      beneficioFiscalId: beneficio.body.id as string,
      classificacaoIbsCbsId: classificacao.body.id as string,
    };
  }

  function corpoRegra(base: Awaited<ReturnType<typeof baseFiscal>>, extra: Record<string, unknown> = {}) {
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

  async function regraAprovada(extra: Record<string, unknown> = {}) {
    const base = await baseFiscal();
    const criada = await request(app.getHttpServer()).post('/fiscal/regras').set('Cookie', admin).send(corpoRegra(base, extra));
    expect(criada.status).toBe(201);
    const submetida = await request(app.getHttpServer())
      .post(`/fiscal/regras/${criada.body.id}/submeter`)
      .set('Cookie', admin)
      .send({ versao: criada.body.versao, justificativa: MOTIVO });
    expect(submetida.status).toBe(200);
    const aprovada = await request(app.getHttpServer())
      .post(`/fiscal/regras/${criada.body.id}/aprovar`)
      .set('Cookie', adminB)
      .send({ versao: submetida.body.versao, justificativa: MOTIVO });
    expect(aprovada.status).toBe(200);
    return { regraId: criada.body.id as string, versao: aprovada.body.versao as number, base };
  }

  function abrir(cookies: string, regraId: string) {
    return request(app.getHttpServer())
      .post('/fiscal/homologacoes')
      .set('Cookie', cookies)
      .send({ regraId, descricao: DESCRICAO, justificativa: JUSTIFICATIVA });
  }

  async function contarPorRegra(regraId: string): Promise<number> {
    const n = await db().execute(sql`SELECT COUNT(*)::int AS n FROM homologacoes_regras WHERE regra_id = ${regraId}::uuid`);
    return Number((n.rows[0] as { n: number }).n);
  }

  async function contarAuditoria(id: string): Promise<number> {
    const n = await db().execute(sql`
      SELECT COUNT(*)::int AS n FROM auditoria
      WHERE tabela = 'homologacoes_regras' AND registro_id = ${id}::uuid
    `);
    return Number((n.rows[0] as { n: number }).n);
  }

  it('abrir com regra aprovada grava em revisão', async () => {
    const { regraId } = await regraAprovada();
    const res = await abrir(admin, regraId);
    expect(res.status).toBe(201);
    expect(res.body.situacao).toBe('Em revisão');
    expect(res.body.descricao).toBe(DESCRICAO);
    const detalhe = await request(app.getHttpServer()).get(`/fiscal/homologacoes/${res.body.id}`).set('Cookie', admin);
    expect(detalhe.status).toBe(200);
    expect(detalhe.body.situacao).toBe('Em revisão');
    expect(detalhe.body.descricao).toBe(DESCRICAO);
    expect(detalhe.body.vigenciaInicio).toBe('2026-01-01');
  });

  it('regra submetida não abre homologação', async () => {
    const base = await baseFiscal();
    const criada = await request(app.getHttpServer()).post('/fiscal/regras').set('Cookie', admin).send(corpoRegra(base));
    expect(criada.status).toBe(201);
    const submetida = await request(app.getHttpServer())
      .post(`/fiscal/regras/${criada.body.id}/submeter`)
      .set('Cookie', admin)
      .send({ versao: criada.body.versao, justificativa: MOTIVO });
    expect(submetida.status).toBe(200);
    const res = await abrir(admin, criada.body.id as string);
    expect(res.status).toBe(422);
    expect(codigoDe(res.body)).toBe('REGRA_NAO_APROVADA');
    expect(mensagemDe(res.body)).toBe('A homologação exige uma versão de regra já aprovada.');
    expect(await contarPorRegra(criada.body.id as string)).toBe(0);
  });

  it('segunda abertura da mesma versão é conflito', async () => {
    const { regraId } = await regraAprovada();
    expect((await abrir(admin, regraId)).status).toBe(201);
    const res = await abrir(admin, regraId);
    expect(res.status).toBe(409);
    expect(codigoDe(res.body)).toBe('HOMOLOGACAO_ABERTA');
    expect(mensagemDe(res.body)).toBe('Já existe homologação em aberto ou publicada para esta versão.');
  });

  it('diff com origem devolve os rótulos de comparar e não grava auditoria', async () => {
    const aprovada = await regraAprovada({ vigenciaFim: '2026-06-30' });
    const nova = await request(app.getHttpServer())
      .post(`/fiscal/regras/${aprovada.regraId}/versoes`)
      .set('Cookie', admin)
      .send(corpoRegra(aprovada.base, {
        pIcms: '18,00',
        vigenciaInicio: '2026-07-01',
        vigenciaFim: '2026-12-31',
        versao: aprovada.versao,
      }));
    expect(nova.status).toBe(201);
    const submetida = await request(app.getHttpServer())
      .post(`/fiscal/regras/${nova.body.id}/submeter`)
      .set('Cookie', admin)
      .send({ versao: nova.body.versao, justificativa: MOTIVO });
    expect(submetida.status).toBe(200);
    const segunda = await request(app.getHttpServer())
      .post(`/fiscal/regras/${nova.body.id}/aprovar`)
      .set('Cookie', adminB)
      .send({ versao: submetida.body.versao, justificativa: MOTIVO });
    expect(segunda.status).toBe(200);
    const aberta = await abrir(admin, nova.body.id as string);
    expect(aberta.status).toBe(201);
    const antes = await contarAuditoria(aberta.body.id as string);
    const diff = await request(app.getHttpServer()).get(`/fiscal/homologacoes/${aberta.body.id}/diff`).set('Cookie', admin);
    expect(diff.status).toBe(200);
    expect(diff.body.diferencas.map((item: { campo: string }) => item.campo)).toContain('Alíquota (%)');
    expect(await contarAuditoria(aberta.body.id as string)).toBe(antes);
  });

  it('diff sem origem deixa o valor anterior vazio', async () => {
    const { regraId } = await regraAprovada();
    const aberta = await abrir(admin, regraId);
    expect(aberta.status).toBe(201);
    const diff = await request(app.getHttpServer()).get(`/fiscal/homologacoes/${aberta.body.id}/diff`).set('Cookie', admin);
    expect(diff.status).toBe(200);
    expect(diff.body.numeroVersaoAntes).toBeNull();
    expect(diff.body.diferencas.length).toBeGreaterThan(0);
    expect(diff.body.diferencas.every((item: { antes: unknown }) => item.antes === null)).toBe(true);
  });

  it('busca pelo uuid da linha devolve total zero', async () => {
    const { regraId } = await regraAprovada();
    const aberta = await abrir(admin, regraId);
    expect(aberta.status).toBe(201);
    const lista = await request(app.getHttpServer())
      .get('/fiscal/homologacoes')
      .query({ search: aberta.body.id as string })
      .set('Cookie', admin);
    expect(lista.status).toBe(200);
    expect(lista.body.total).toBe(0);
  });

  it('gestor não abre revisão', async () => {
    const { regraId } = await regraAprovada();
    const res = await abrir(gestor, regraId);
    expect(res.status).toBe(403);
  });

  it('quem só tem leitura não abre revisão', async () => {
    const { regraId } = await regraAprovada();
    const res = await abrir(leitor, regraId);
    expect(res.status).toBe(403);
  });
});
