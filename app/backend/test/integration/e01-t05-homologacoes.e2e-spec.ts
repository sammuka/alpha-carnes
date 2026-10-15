import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { INestApplication } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
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
  let gerenciar = '';
  let seq = 110;
  let eventos: jest.SpiedFunction<EventEmitter2['emit']>;

  beforeAll(async () => {
    app = await createTestApp();
    const a = await createTestUser(app, { perfil: 'administrador' });
    const g = await createTestUser(app, { perfil: 'gestor' });
    const l = await createTestUser(app, { perfil: 'diretoria' });
    const soGerenciar = await createTestUser(app, { perfil: 'comercial' });
    eventos = jest.spyOn(app.get(EventEmitter2), 'emit');
    await app.get<{ db: NodePgDatabase<typeof schema> }>(DRIZZLE).db.execute(sql`
      INSERT INTO perfis_permissoes (perfil_id, permissao_id)
      SELECT p.id, perm.id
      FROM perfis p
      JOIN permissoes perm ON perm.codigo = 'FISCAL_HOMOLOGACOES_LER'
      WHERE p.slug = 'diretoria'
      ON CONFLICT ON CONSTRAINT uq_perfil_permissao DO NOTHING
    `);
    await app.get<{ db: NodePgDatabase<typeof schema> }>(DRIZZLE).db.execute(sql`
      INSERT INTO perfis_permissoes (perfil_id, permissao_id)
      SELECT p.id, perm.id
      FROM perfis p
      JOIN permissoes perm ON perm.codigo = 'FISCAL_HOMOLOGACOES_GERENCIAR'
      WHERE p.slug = 'comercial'
      ON CONFLICT ON CONSTRAINT uq_perfil_permissao DO NOTHING
    `);
    admin = joinSetCookie(await request(app.getHttpServer()).post('/auth/login').send({ email: a.adminEmail, password: a.adminPassword }));
    gestor = joinSetCookie(await request(app.getHttpServer()).post('/auth/login').send({ email: g.adminEmail, password: g.adminPassword }));
    leitor = joinSetCookie(await request(app.getHttpServer()).post('/auth/login').send({ email: l.adminEmail, password: l.adminPassword }));
    gerenciar = joinSetCookie(await request(app.getHttpServer()).post('/auth/login').send({ email: soGerenciar.adminEmail, password: soGerenciar.adminPassword }));
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
    eventos.mockRestore();
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
      estabelecimentoId: aprovado.body.id as string,
      operacaoId: operacao.body.id as string,
      clienteId: cliente.body.id as string,
      produtoId: produto.body.id as string,
      ncmId: ncm.body.id as string,
      enquadramentoId: enquadramento.body.id as string,
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

  function decidir(acao: 'aprovar' | 'rejeitar', cookies: string, id: string, versao: number, justificativa: string) {
    return request(app.getHttpServer())
      .post(`/fiscal/homologacoes/${id}/${acao}`)
      .set('Cookie', cookies)
      .send({ versao, justificativa });
  }

  async function lerRegra(id: string): Promise<{ situacao: string; updatedAt: string }> {
    const n = await db().execute(sql`
      SELECT situacao, updated_at AS "updatedAt" FROM regras_tributarias WHERE id = ${id}::uuid
    `);
    const linha = n.rows[0] as { situacao: string; updatedAt: Date | string };
    return { situacao: linha.situacao, updatedAt: new Date(linha.updatedAt).toISOString() };
  }

  function contarEventos(): number {
    return eventos.mock.calls.filter((chamada) => chamada[0] === 'homologacao_regra_alterada').length;
  }

  it('autor da regra não homologa', async () => {
    const { regraId } = await regraAprovada();
    const aberta = await abrir(admin, regraId);
    expect(aberta.status).toBe(201);
    const antes = await lerRegra(regraId);
    eventos.mockClear();
    const res = await decidir('aprovar', admin, aberta.body.id as string, 1, 'Decisão do autor da submissão.');
    expect(res.status).toBe(422);
    expect(codigoDe(res.body)).toBe('SEGREGACAO_FUNCAO');
    expect(mensagemDe(res.body)).toBe('A aprovação deve ser feita por usuário diferente de quem submeteu.');
    expect(await lerRegra(regraId)).toEqual(antes);
    expect(contarEventos()).toBe(0);
  });

  it('segundo administrador aprova sem terceira pessoa', async () => {
    const { regraId } = await regraAprovada();
    const aberta = await abrir(admin, regraId);
    expect(aberta.status).toBe(201);
    const antes = await lerRegra(regraId);
    const res = await decidir('aprovar', adminB, aberta.body.id as string, 1, 'Homologação conferida por outro usuário.');
    expect(res.status).toBe(200);
    expect(res.body.situacao).toBe('Aprovada');
    const regra = await lerRegra(regraId);
    expect(regra.situacao).toBe('APROVADA');
    expect(regra.updatedAt).toBe(antes.updatedAt);
  });

  it('rejeitar grava Rejeitada e deixa o aprovador vazio', async () => {
    const { regraId } = await regraAprovada();
    const aberta = await abrir(admin, regraId);
    expect(aberta.status).toBe(201);
    const res = await decidir('rejeitar', adminB, aberta.body.id as string, 1, 'Rejeição da revisão desta versão.');
    expect(res.status).toBe(200);
    expect(res.body.situacao).toBe('Rejeitada');
    expect(res.body.aprovador).toBe('');
    const coluna = await db().execute(sql`
      SELECT aprovado_por_id FROM homologacoes_regras WHERE id = ${aberta.body.id}::uuid
    `);
    expect((coluna.rows[0] as { aprovado_por_id: string | null }).aprovado_por_id).toBeNull();
  });

  it('aprovar de novo é transição inválida', async () => {
    const { regraId } = await regraAprovada();
    const aberta = await abrir(admin, regraId);
    const aprovada = await decidir('aprovar', adminB, aberta.body.id as string, 1, 'Homologação conferida por outro usuário.');
    expect(aprovada.status).toBe(200);
    const res = await decidir('aprovar', adminB, aberta.body.id as string, aprovada.body.versao as number, 'Segunda decisão da mesma revisão.');
    expect(res.status).toBe(409);
    expect(codigoDe(res.body)).toBe('TRANSICAO_INVALIDA');
    expect(mensagemDe(res.body)).toBe('Ação não permitida na situação atual.');
  });

  it('versão divergente é conflito concorrente', async () => {
    const { regraId } = await regraAprovada();
    const aberta = await abrir(admin, regraId);
    const res = await decidir('aprovar', adminB, aberta.body.id as string, 9, 'Decisão com versão desatualizada.');
    expect(res.status).toBe(409);
    expect(codigoDe(res.body)).toBe('CONFLITO_CONCORRENTE');
    expect(mensagemDe(res.body)).toBe('O registro foi alterado por outro usuário. Recarregue para continuar.');
  });

  it('quem só tem gestão não aprova', async () => {
    const { regraId } = await regraAprovada();
    const aberta = await abrir(admin, regraId);
    const res = await decidir('aprovar', gerenciar, aberta.body.id as string, 1, 'Tentativa sem a permissão de aprovar.');
    expect(res.status).toBe(403);
  });

  async function homologacaoAprovada() {
    const aprovada = await regraAprovada();
    const aberta = await abrir(admin, aprovada.regraId);
    expect(aberta.status).toBe(201);
    const decidida = await decidir('aprovar', adminB, aberta.body.id as string, 1, 'Homologação conferida por outro usuário.');
    expect(decidida.status).toBe(200);
    return { id: aberta.body.id as string, regraId: aprovada.regraId, base: aprovada.base, versao: decidida.body.versao as number };
  }

  async function simular(base: Awaited<ReturnType<typeof baseFiscal>>) {
    const res = await request(app.getHttpServer()).post('/fiscal/simulacoes').set('Cookie', admin).send({
      estabelecimentoId: base.estabelecimentoId,
      operacaoId: base.operacaoId,
      clienteId: base.clienteId,
      produtoId: base.produtoId,
      ncmId: base.ncmId,
      quantidade: '10,000',
      pesoNf: '982,000',
      valor: '1.000,00',
      desconto: '0,00',
      competencia: '2026-10',
      enquadramentoId: base.enquadramentoId,
      justificativa: 'Motivo da alteração desta simulação.',
    });
    expect(res.status).toBe(201);
    return res.body.id as string;
  }

  function vincular(cookies: string, id: string, simulacaoId: string, versao: number, justificativa: string) {
    return request(app.getHttpServer())
      .post(`/fiscal/homologacoes/${id}/cenarios`)
      .set('Cookie', cookies)
      .send({ simulacaoId, versao, justificativa });
  }

  function publicar(cookies: string, id: string, versao: number, justificativa: string) {
    return request(app.getHttpServer())
      .post(`/fiscal/homologacoes/${id}/publicar`)
      .set('Cookie', cookies)
      .send({ versao, justificativa });
  }

  async function contarNotas() {
    const notas = await db().execute(sql`SELECT COUNT(*)::int AS n FROM notas_fiscais`);
    const fornecedor = await db().execute(sql`SELECT COUNT(*)::int AS n FROM notas_fiscais_fornecedor`);
    return {
      notas: Number((notas.rows[0] as { n: number }).n),
      fornecedor: Number((fornecedor.rows[0] as { n: number }).n),
    };
  }

  it('publicar sem cenário não publica', async () => {
    const { id } = await homologacaoAprovada();
    eventos.mockClear();
    const res = await publicar(adminB, id, 2, 'Publicação sem memória de regressão.');
    expect(res.status).toBe(422);
    expect(codigoDe(res.body)).toBe('CENARIO_REGRESSAO_AUSENTE');
    expect(mensagemDe(res.body)).toBe('A publicação exige ao menos um cenário de regressão.');
    const detalhe = await request(app.getHttpServer()).get(`/fiscal/homologacoes/${id}`).set('Cookie', adminB);
    expect(detalhe.body.situacao).toBe('Aprovada');
    expect(contarEventos()).toBe(0);
  });

  it('cenário de outra regra não vincula', async () => {
    await db().execute(sql`DELETE FROM cenarios_regressao`);
    const { id, versao } = await homologacaoAprovada();
    const outra = await regraAprovada();
    const memoriaDeOutraVersao = await simular(outra.base);
    const res = await vincular(adminB, id, memoriaDeOutraVersao, versao, 'Memória de outra versão.');
    expect(res.status).toBe(422);
    expect(codigoDe(res.body)).toBe('CENARIO_REGRA_DIVERGENTE');
    const n = await db().execute(sql`SELECT COUNT(*)::int AS n FROM cenarios_regressao`);
    expect(n.rows[0]).toMatchObject({ n: 0 });
  });

  it('publicar não muda a regra nem grava nota', async () => {
    const { id, regraId, base, versao } = await homologacaoAprovada();
    const simulacaoId = await simular(base);
    const vinculado = await vincular(adminB, id, simulacaoId, versao, 'Vínculo da memória desta versão.');
    expect(vinculado.status).toBe(201);
    const antesNotas = await contarNotas();
    const antesRegra = await lerRegra(regraId);
    const antesAuditoria = await contarAuditoria(id);
    const res = await publicar(adminB, id, vinculado.body.versao as number, 'Publicação com a memória desta versão.');
    expect(res.status).toBe(200);
    expect(res.body.situacao).toBe('Publicada');
    expect(await contarNotas()).toEqual(antesNotas);
    const regra = await lerRegra(regraId);
    expect(regra.situacao).toBe(antesRegra.situacao);
    expect(regra.updatedAt).toBe(antesRegra.updatedAt);
    expect(JSON.stringify(res.body)).not.toMatch(/xml|protocolo|danfe|"chave"/i);
    expect(await contarAuditoria(id)).toBe(antesAuditoria + 1);
    const historico = await request(app.getHttpServer()).get(`/fiscal/homologacoes/${id}/historico`).set('Cookie', adminB);
    expect(historico.status).toBe(200);
    const texto = JSON.stringify(historico.body);
    expect(texto).toContain('Alteração publicada');
    expect(texto).not.toContain('homologacoes_regras');
    expect(texto).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/i);
    const deNovo = await publicar(adminB, id, res.body.versao as number, 'Segunda publicação da mesma revisão.');
    expect(deNovo.status).toBe(409);
    expect(codigoDe(deNovo.body)).toBe('TRANSICAO_INVALIDA');
  });

  it('o serviço não chama global.fetch', () => {
    const fonte = readFileSync(join('src/modules/erp/fiscal/homologacoes/homologacoes.service.ts'), 'utf8');
    expect(fonte).not.toMatch(/global\.fetch/);
    expect(fonte).not.toMatch(/\bfetch\(/);
  });

  it('duas aprovações simultâneas: uma 200 e uma 409', async () => {
    const { regraId } = await regraAprovada();
    const aberta = await abrir(admin, regraId);
    expect(aberta.status).toBe(201);
    const antes = contarEventos();
    const respostas = await Promise.all([
      decidir('aprovar', adminB, aberta.body.id as string, 1, 'Decisão simultânea da revisão.'),
      decidir('aprovar', adminB, aberta.body.id as string, 1, 'Decisão simultânea da revisão.'),
    ]);
    expect(respostas.map((resposta) => resposta.status).sort()).toEqual([200, 409]);
    const conflito = respostas.find((resposta) => resposta.status === 409);
    expect(codigoDe(conflito?.body ?? {})).toBe('CONFLITO_CONCORRENTE');
    expect(contarEventos()).toBe(antes + 1);
    const emitidos = eventos.mock.calls.filter((chamada) => chamada[0] === 'homologacao_regra_alterada');
    const payload = emitidos.at(-1)?.[1] as Record<string, unknown>;
    expect(payload.acao).toBe('aprovada');
    expect(JSON.stringify(payload)).not.toMatch(/p_icms|xml/);
  });

  it('422 e 409 não emitem', async () => {
    const { regraId } = await regraAprovada();
    const aberta = await abrir(admin, regraId);
    expect(aberta.status).toBe(201);
    const antes = contarEventos();
    const segregacao = await decidir('aprovar', admin, aberta.body.id as string, 1, 'Autor não decide a própria submissão.');
    expect(segregacao.status).toBe(422);
    const versao = await decidir('aprovar', adminB, aberta.body.id as string, 9, 'Versão que outro usuário já alterou.');
    expect(versao.status).toBe(409);
    expect(contarEventos()).toBe(antes);
  });

  it('pré-condições provisórias e cenário só depois do vínculo', async () => {
    const { id, base, versao } = await homologacaoAprovada();
    const antes = await request(app.getHttpServer()).get(`/fiscal/homologacoes/${id}/pre-condicoes`).set('Cookie', adminB);
    expect(antes.status).toBe(200);
    const porCodigo = (codigo: string) => (antes.body as Array<{ codigo: string; atendida: boolean; provisoria: boolean; texto?: string }>)
      .find((item) => item.codigo === codigo);
    expect(porCodigo('DUPLA_APROVACAO')).toMatchObject({
      atendida: false,
      provisoria: true,
      texto: 'Um aprovador diferente de quem submeteu a regra registra a decisão. O quórum numérico permanece provisório.',
    });
    expect(porCodigo('DATAS_COMERCIAL_FISCAL_EFETIVA')).toMatchObject({ atendida: false, provisoria: true });
    expect(porCodigo('CENARIO_REGRESSAO')?.atendida).toBe(false);
    const simulacaoId = await simular(base);
    const vinculado = await vincular(adminB, id, simulacaoId, versao, 'Vínculo para a pré-condição de regressão.');
    expect(vinculado.status).toBe(201);
    const depois = await request(app.getHttpServer()).get(`/fiscal/homologacoes/${id}/pre-condicoes`).set('Cookie', adminB);
    const cenario = (depois.body as Array<{ codigo: string; atendida: boolean }>).find((item) => item.codigo === 'CENARIO_REGRESSAO');
    expect(cenario?.atendida).toBe(true);
  });

  it('lista, contagens e exportação respeitam filtros, ordem e escape do CSV', async () => {
    const { regraId } = await regraAprovada();
    const aberta = await request(app.getHttpServer())
      .post('/fiscal/homologacoes')
      .set('Cookie', admin)
      .send({ regraId, descricao: 'Revisão; com "aspas" para exportar', justificativa: JUSTIFICATIVA });
    expect(aberta.status).toBe(201);
    const busca = { search: 'com "aspas" para exportar', situacao: 'EM_REVISAO' };
    const contagens = await request(app.getHttpServer()).get('/fiscal/homologacoes/contagens').query(busca).set('Cookie', admin);
    expect(contagens.status).toBe(200);
    expect(contagens.body).toMatchObject({ total: 1, emRevisao: 1, aprovadas: 0, rejeitadas: 0, publicadas: 0 });
    for (const sort of ['enquadramento', 'vigenciaInicio', 'usuario', 'aprovador', 'descricao']) {
      const lista = await request(app.getHttpServer())
        .get('/fiscal/homologacoes')
        .query({ ...busca, sort, dir: 'desc' })
        .set('Cookie', admin);
      expect(lista.status).toBe(200);
      expect(lista.body.data[0]).toMatchObject({ situacao: 'Em revisão', aprovador: '' });
    }
    const csv = await request(app.getHttpServer()).get('/fiscal/homologacoes/exportacao').query(busca).set('Cookie', admin);
    expect(csv.status).toBe(200);
    expect(csv.headers['content-type']).toContain('text/csv');
    expect(csv.text).toContain('Enquadramento fiscal;Início de vigência;');
    expect(csv.text).toContain('"Revisão; com ""aspas"" para exportar"');
  });

  it('id inexistente devolve 404 em todas as rotas por id e a regra sem fim de vigência abre', async () => {
    const inexistente = '01a14089-0000-7000-8000-000000000000';
    const corpo = { versao: 1, justificativa: 'Decisão de usuário diferente de quem submeteu.' };
    for (const rota of ['', '/historico', '/diff', '/pre-condicoes']) {
      const res = await request(app.getHttpServer()).get(`/fiscal/homologacoes/${inexistente}${rota}`).set('Cookie', admin);
      expect(res.status).toBe(404);
    }
    for (const rota of ['aprovar', 'rejeitar', 'publicar']) {
      const res = await request(app.getHttpServer()).post(`/fiscal/homologacoes/${inexistente}/${rota}`).set('Cookie', adminB).send(corpo);
      expect(res.status).toBe(404);
    }
    const cenario = await request(app.getHttpServer())
      .post(`/fiscal/homologacoes/${inexistente}/cenarios`)
      .set('Cookie', adminB)
      .send({ ...corpo, simulacaoId: inexistente });
    expect(cenario.status).toBe(404);
    const aberta404 = await request(app.getHttpServer())
      .post('/fiscal/homologacoes')
      .set('Cookie', admin)
      .send({ regraId: inexistente, descricao: DESCRICAO, justificativa: JUSTIFICATIVA });
    expect(aberta404.status).toBe(404);

    const { regraId } = await regraAprovada({ vigenciaFim: null });
    const aberta = await abrir(admin, regraId);
    expect(aberta.status).toBe(201);
    const diff = await request(app.getHttpServer()).get(`/fiscal/homologacoes/${aberta.body.id}/diff`).set('Cookie', admin);
    expect(diff.status).toBe(200);
    expect(JSON.stringify(diff.body)).toContain('Sem fim de vigência');
    const aprovada = await decidir('aprovar', adminB, aberta.body.id as string, 1, 'Homologação conferida por outro usuário.');
    expect(aprovada.status).toBe(200);
    const lista = await request(app.getHttpServer())
      .get('/fiscal/homologacoes')
      .query({ search: DESCRICAO, situacao: 'APROVADA' })
      .set('Cookie', admin);
    expect(lista.status).toBe(200);
    expect(lista.body.data.some((linha: { aprovador: string }) => linha.aprovador !== '')).toBe(true);
    const csv = await request(app.getHttpServer()).get('/fiscal/homologacoes/exportacao').query({ situacao: 'APROVADA' }).set('Cookie', admin);
    expect(csv.text).toContain('Aprovada;');
  });

  it('quem só tem leitura não abre revisão', async () => {
    const { regraId } = await regraAprovada();
    const res = await abrir(leitor, regraId);
    expect(res.status).toBe(403);
  });

  async function aposentarRegra(regraId: string, versao: number) {
    const res = await request(app.getHttpServer())
      .post(`/fiscal/regras/${regraId}/aposentar`)
      .set('Cookie', adminB)
      .send({ versao, justificativa: 'Versão aposentada depois da abertura.' });
    expect(res.status).toBe(200);
  }

  it('regra aposentada depois da abertura não aprova, não vincula e não publica, mas permite rejeitar', async () => {
    const aprovada = await regraAprovada();
    const aberta = await abrir(admin, aprovada.regraId);
    expect(aberta.status).toBe(201);
    await aposentarRegra(aprovada.regraId, aprovada.versao);
    const aprovacao = await decidir('aprovar', adminB, aberta.body.id as string, 1, 'Decisão sobre regra aposentada.');
    expect(aprovacao.status).toBe(422);
    expect(codigoDe(aprovacao.body)).toBe('REGRA_NAO_APROVADA');
    // AD-28: rejeitar continua permitido para encerrar a homologação sem regra vigente.
    const rejeicao = await decidir('rejeitar', adminB, aberta.body.id as string, 1, 'Encerrada: a regra foi aposentada.');
    expect(rejeicao.status).toBe(200);
    expect(rejeicao.body.situacao).toBe('Rejeitada');
    expect(await contarAuditoria(aberta.body.id as string)).toBe(2);
    const outra = await homologacaoAprovada();
    const simulacaoId = await simular(outra.base);
    const vinculado = await vincular(adminB, outra.id, simulacaoId, outra.versao, 'Vínculo antes de aposentar.');
    expect(vinculado.status).toBe(201);
    const regra = await db().execute(sql`SELECT versao FROM regras_tributarias WHERE id = ${outra.regraId}::uuid`);
    await aposentarRegra(outra.regraId, Number((regra.rows[0] as { versao: number }).versao));
    const publicada = await publicar(adminB, outra.id, vinculado.body.versao as number, 'Publicação de regra aposentada.');
    expect(publicada.status).toBe(422);
    expect(codigoDe(publicada.body)).toBe('REGRA_NAO_APROVADA');
    const outraSim = await vincular(adminB, outra.id, simulacaoId, vinculado.body.versao as number, 'Novo vínculo em regra aposentada.');
    expect(outraSim.status).toBe(422);
    expect(codigoDe(outraSim.body)).toBe('REGRA_NAO_APROVADA');
  });

  it('vincular o mesmo cenário duas vezes devolve 409', async () => {
    const { id, base, versao } = await homologacaoAprovada();
    const simulacaoId = await simular(base);
    const primeira = await vincular(adminB, id, simulacaoId, versao, 'Primeiro vínculo da memória.');
    expect(primeira.status).toBe(201);
    const segunda = await vincular(adminB, id, simulacaoId, primeira.body.versao as number, 'Segundo vínculo da mesma memória.');
    expect(segunda.status).toBe(409);
    expect(codigoDe(segunda.body)).toBe('CENARIO_JA_VINCULADO');
    expect(mensagemDe(segunda.body)).toBe('Este cenário já está vinculado a esta homologação.');
  });

  it('exportação neutraliza fórmula na descrição', async () => {
    const { regraId } = await regraAprovada();
    const perigosa = "=cmd|' /C calc'!A0";
    const aberta = await request(app.getHttpServer())
      .post('/fiscal/homologacoes')
      .set('Cookie', admin)
      .send({ regraId, descricao: perigosa, justificativa: JUSTIFICATIVA });
    expect(aberta.status).toBe(201);
    const csv = await request(app.getHttpServer()).get('/fiscal/homologacoes/exportacao').query({ search: 'calc' }).set('Cookie', admin);
    expect(csv.status).toBe(200);
    expect(csv.text).toContain(`;'${perigosa}`);
    expect(csv.text).not.toMatch(/(^|[\r\n;])=cmd/);
  });

  it('abertura espera a baixa concorrente da regra e então recusa', async () => {
    const { regraId } = await regraAprovada();
    let terminouAntes = false;
    let pendente: Promise<{ status: number; body: Parameters<typeof codigoDe>[0] }> | undefined;
    await db().transaction(async (tx) => {
      await tx.execute(sql`UPDATE regras_tributarias SET deleted_at = now() WHERE id = ${regraId}::uuid`);
      pendente = abrir(admin, regraId).then((r) => r);
      pendente.then(() => { terminouAntes = true; }, () => { terminouAntes = true; });
      await new Promise((resolve) => setTimeout(resolve, 600));
    });
    expect(terminouAntes).toBe(false);
    const res = await pendente!;
    expect(res.status).toBe(422);
    expect(codigoDe(res.body)).toBe('REGRA_NAO_APROVADA');
  });
});
