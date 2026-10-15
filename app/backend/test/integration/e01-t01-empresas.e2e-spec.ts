import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { eq, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { validarCnpjAlfanumerico } from '../../src/common/validators/cnpj-alfanumerico';
import { DRIZZLE } from '../../src/database/database.module';
import * as schema from '../../src/database/schema';
import { EmpresasService } from '../../src/modules/erp/fiscal/empresas/empresas.service';
import { EstabelecimentosService } from '../../src/modules/erp/fiscal/empresas/estabelecimentos.service';
import { cleanupDb, createTestApp, createTestUser, joinSetCookie } from '../helpers/test-app';

const MOTIVO = 'Ajuste de cadastro fiscal';

function cnpjDe(base12: string): string {
  for (let i = 0; i < 100; i += 1) {
    const candidato = `${base12}${String(i).padStart(2, '0')}`;
    if (validarCnpjAlfanumerico(candidato)) return candidato;
  }
  throw new Error(`CNPJ sem DV para ${base12}`);
}

function codigoDe(body: { message?: { codigo?: string } | string }): string | undefined {
  return typeof body.message === 'object' ? body.message.codigo : undefined;
}

describe('E01-T01 empresas e estabelecimentos', () => {
  let app: INestApplication;
  let adminA = '';
  let adminB = '';
  let gestor = '';

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

  async function criarEmpresa(cookies: string, raiz: string, razao = 'Alpha Carnes LTDA') {
    const res = await request(app.getHttpServer())
      .post('/fiscal/empresas')
      .set('Cookie', cookies)
      .send({ razaoSocial: razao, cnpjRaiz: raiz, justificativa: MOTIVO });
    return res;
  }

  async function criarEstab(cookies: string, empresaId: string, cnpj: string, cnaes?: unknown[]) {
    return request(app.getHttpServer())
      .post('/fiscal/estabelecimentos')
      .set('Cookie', cookies)
      .send({
        empresaId,
        nome: 'Filial Osasco',
        cnpj,
        inscricaoEstadual: '123456789',
        inscricaoMunicipal: '98765',
        uf: 'SP',
        cnaes,
        justificativa: MOTIVO,
      });
  }

  it('empresa: criar, editar, listar, remover', async () => {
    const criada = await criarEmpresa(adminA, '12ABC345');
    expect(criada.status).toBe(201);
    expect(criada.body.cnpjRaiz).toBe('12ABC345');
    const editada = await request(app.getHttpServer())
      .patch(`/fiscal/empresas/${criada.body.id}`)
      .set('Cookie', adminA)
      .send({ razaoSocial: 'Alpha Carnes Filial', versao: criada.body.versao, justificativa: MOTIVO });
    expect(editada.status).toBe(200);
    expect(editada.body.razaoSocial).toBe('Alpha Carnes Filial');
    const lista = await request(app.getHttpServer()).get('/fiscal/empresas?search=Alpha').set('Cookie', adminA);
    expect(lista.status).toBe(200);
    expect(lista.body.data.some((linha: { id: string }) => linha.id === criada.body.id)).toBe(true);
    const removida = await request(app.getHttpServer())
      .delete(`/fiscal/empresas/${criada.body.id}`)
      .set('Cookie', adminA)
      .send({ justificativa: MOTIVO });
    expect(removida.status).toBe(200);
  });

  it('raiz duplicada → 409', async () => {
    const primeira = await criarEmpresa(adminA, '99887766');
    expect(primeira.status).toBe(201);
    const segunda = await criarEmpresa(adminA, '99887766', 'Outra Razao');
    expect(segunda.status).toBe(409);
    expect(codigoDe(segunda.body)).toBe('CNPJ_RAIZ_DUPLICADO');
  });

  it('estabelecimento DRAFT→REVIEW→APPROVED→SUSPENDED→REVIEW', async () => {
    const cnpj = cnpjDe('12ABC3450001');
    const empresa = await criarEmpresa(adminA, '12ABC345');
    if (empresa.status === 409) {
      const lista = await request(app.getHttpServer()).get('/fiscal/empresas?search=12ABC345').set('Cookie', adminA);
      empresa.body.id = lista.body.data[0].id;
    }
    const estab = await criarEstab(adminA, empresa.body.id, cnpj, [
      { codigo: '6201501', descricao: 'Desenvolvimento', tipo: 'PRINCIPAL' },
    ]);
    expect(estab.status).toBe(201);
    expect(estab.body.situacao).toBe('DRAFT');
    expect(estab.body.municipioIbgeCodigo).toBeNull();
    const submetido = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.body.id}/submeter`)
      .set('Cookie', adminA)
      .send({ versao: estab.body.versao, justificativa: MOTIVO });
    expect(submetido.status).toBe(200);
    expect(submetido.body.situacao).toBe('REVIEW');
    const mesmo = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.body.id}/aprovar`)
      .set('Cookie', adminA)
      .send({ versao: submetido.body.versao, justificativa: MOTIVO });
    expect(mesmo.status).toBe(422);
    expect(codigoDe(mesmo.body)).toBe('SEGREGACAO_FUNCAO');
    const aprovado = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.body.id}/aprovar`)
      .set('Cookie', adminB)
      .send({ versao: submetido.body.versao, justificativa: MOTIVO });
    expect(aprovado.status).toBe(200);
    expect(aprovado.body.situacao).toBe('APPROVED');
    expect(aprovado.body.municipioIbgeCodigo).toBeNull();
    const suspenso = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.body.id}/suspender`)
      .set('Cookie', adminB)
      .send({ versao: aprovado.body.versao, justificativa: MOTIVO });
    expect(suspenso.status).toBe(200);
    expect(suspenso.body.situacao).toBe('SUSPENDED');
    const reativado = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.body.id}/reativar`)
      .set('Cookie', adminA)
      .send({ versao: suspenso.body.versao, justificativa: MOTIVO });
    expect(reativado.status).toBe(200);
    expect(reativado.body.situacao).toBe('REVIEW');
  });

  it('mesmo usuário aprova → 422 SEGREGACAO_FUNCAO', async () => {
    const cnpj = cnpjDe('12ABC3460001');
    const empresa = await criarEmpresa(adminA, '12ABC346');
    const estab = await criarEstab(adminA, empresa.body.id, cnpj, [
      { codigo: '6201501', descricao: 'Desenvolvimento', tipo: 'PRINCIPAL' },
    ]);
    const submetido = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.body.id}/submeter`)
      .set('Cookie', adminA)
      .send({ versao: estab.body.versao, justificativa: MOTIVO });
    const aprovado = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.body.id}/aprovar`)
      .set('Cookie', adminA)
      .send({ versao: submetido.body.versao, justificativa: MOTIVO });
    expect(aprovado.status).toBe(422);
    expect(codigoDe(aprovado.body)).toBe('SEGREGACAO_FUNCAO');
  });

  it('segundo administrador → 200', async () => {
    const cnpj = cnpjDe('12ABC3470001');
    const empresa = await criarEmpresa(adminA, '12ABC347');
    const estab = await criarEstab(adminA, empresa.body.id, cnpj, [
      { codigo: '6201501', descricao: 'Desenvolvimento', tipo: 'PRINCIPAL' },
    ]);
    const submetido = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.body.id}/submeter`)
      .set('Cookie', adminA)
      .send({ versao: estab.body.versao, justificativa: MOTIVO });
    const aprovado = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.body.id}/aprovar`)
      .set('Cookie', adminB)
      .send({ versao: submetido.body.versao, justificativa: MOTIVO });
    expect(aprovado.status).toBe(200);
  });

  it('rejeitar e editar volta a DRAFT', async () => {
    const cnpj = cnpjDe('12ABC3480001');
    const empresa = await criarEmpresa(adminA, '12ABC348');
    const estab = await criarEstab(adminA, empresa.body.id, cnpj, [
      { codigo: '6201501', descricao: 'Desenvolvimento', tipo: 'PRINCIPAL' },
    ]);
    const submetido = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.body.id}/submeter`)
      .set('Cookie', adminA)
      .send({ versao: estab.body.versao, justificativa: MOTIVO });
    const rejeitado = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.body.id}/rejeitar`)
      .set('Cookie', adminB)
      .send({ versao: submetido.body.versao, justificativa: MOTIVO });
    expect(rejeitado.status).toBe(200);
    expect(rejeitado.body.situacao).toBe('REJECTED');
    const editado = await request(app.getHttpServer())
      .patch(`/fiscal/estabelecimentos/${estab.body.id}`)
      .set('Cookie', adminA)
      .send({ nome: 'Filial revista', versao: rejeitado.body.versao, justificativa: MOTIVO });
    expect(editado.status).toBe(200);
    expect(editado.body.situacao).toBe('DRAFT');
    expect(editado.body.nome).toBe('Filial revista');
  });

  it('raiz divergente → 422', async () => {
    const empresa = await criarEmpresa(adminA, '12ABC349');
    const res = await criarEstab(adminA, empresa.body.id, cnpjDe('99ZZZ9990001'));
    expect(res.status).toBe(422);
    expect(codigoDe(res.body)).toBe('CNPJ_RAIZ_DIVERGENTE');
  });

  it('CNPJ duplicado → 409', async () => {
    const cnpj = cnpjDe('12ABC3500001');
    const empresa = await criarEmpresa(adminA, '12ABC350');
    const primeiro = await criarEstab(adminA, empresa.body.id, cnpj);
    expect(primeiro.status).toBe(201);
    const segundo = await criarEstab(adminA, empresa.body.id, cnpj);
    expect(segundo.status).toBe(409);
    expect(codigoDe(segundo.body)).toBe('CNPJ_DUPLICADO');
  });

  it('aprova com municipio_ibge_codigo nulo', async () => {
    const cnpj = cnpjDe('12ABC3510001');
    const empresa = await criarEmpresa(adminA, '12ABC351');
    const estab = await criarEstab(adminA, empresa.body.id, cnpj, [
      { codigo: '6201501', descricao: 'Desenvolvimento', tipo: 'PRINCIPAL' },
    ]);
    const submetido = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.body.id}/submeter`)
      .set('Cookie', adminA)
      .send({ versao: estab.body.versao, justificativa: MOTIVO });
    const aprovado = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.body.id}/aprovar`)
      .set('Cookie', adminB)
      .send({ versao: submetido.body.versao, justificativa: MOTIVO });
    expect(aprovado.status).toBe(200);
    expect(aprovado.body.municipioIbgeCodigo).toBeNull();
  });

  it('pré-condições MUNICIPIO_INFORMADO/CERTIFICADO_VINCULADO provisoria=true', async () => {
    const cnpj = cnpjDe('12ABC3520001');
    const empresa = await criarEmpresa(adminA, '12ABC352');
    const estab = await criarEstab(adminA, empresa.body.id, cnpj, [
      { codigo: '6201501', descricao: 'Desenvolvimento', tipo: 'PRINCIPAL' },
    ]);
    const res = await request(app.getHttpServer())
      .get(`/fiscal/estabelecimentos/${estab.body.id}/pre-condicoes`)
      .set('Cookie', adminA);
    expect(res.status).toBe(200);
    const municipio = res.body.find((item: { codigo: string }) => item.codigo === 'MUNICIPIO_INFORMADO');
    const certificado = res.body.find((item: { codigo: string }) => item.codigo === 'CERTIFICADO_VINCULADO');
    expect(municipio).toEqual(expect.objectContaining({ provisoria: true }));
    expect(certificado).toEqual(expect.objectContaining({ provisoria: true, atendida: false }));
  });

  it('GET detalhe após cada transição devolve situação, responsável, CNAEs e regime persistidos', async () => {
    const cnpj = cnpjDe('12ABC3530001');
    const empresa = await criarEmpresa(adminA, '12ABC353');
    const estab = await criarEstab(adminA, empresa.body.id, cnpj, [
      { codigo: '6201501', descricao: 'Desenvolvimento', tipo: 'PRINCIPAL' },
    ]);
    const detalhe = await request(app.getHttpServer())
      .get(`/fiscal/estabelecimentos/${estab.body.id}`)
      .set('Cookie', adminA);
    expect(detalhe.status).toBe(200);
    expect(detalhe.body.situacao).toBe('DRAFT');
    expect(detalhe.body.cnaes).toEqual([
      expect.objectContaining({ codigo: '6201501', tipo: 'PRINCIPAL' }),
    ]);
    expect(detalhe.body.regimes).toEqual([]);
    expect(detalhe.body.responsavel.nome).toBeTruthy();
  });

  it('gestor sem FISCAL_* → 403 em toda rota', async () => {
    const rotas: Array<[string, string]> = [
      ['get', '/fiscal/empresas'],
      ['post', '/fiscal/empresas'],
      ['get', '/fiscal/estabelecimentos'],
      ['get', '/fiscal/estabelecimentos/contagens'],
    ];
    for (const [metodo, rota] of rotas) {
      const res = await request(app.getHttpServer())[metodo as 'get'](rota).set('Cookie', gestor).send({ justificativa: MOTIVO });
      expect(res.status).toBe(403);
    }
  });

  it('cada mutação grava 1 auditoria', async () => {
    const db = app.get<{ db: NodePgDatabase<typeof schema> }>(DRIZZLE).db;
    const antes = await db.select({ id: schema.auditoria.id }).from(schema.auditoria).where(eq(schema.auditoria.modulo, 'fiscal.empresas'));
    const criada = await criarEmpresa(adminA, '12ABC354');
    expect(criada.status).toBe(201);
    const depois = await db.select({ id: schema.auditoria.id }).from(schema.auditoria).where(eq(schema.auditoria.modulo, 'fiscal.empresas'));
    expect(depois.length - antes.length).toBe(1);
  });

  it('histórico sem nome de tabela nem id', async () => {
    const cnpj = cnpjDe('12ABC3550001');
    const empresa = await criarEmpresa(adminA, '12ABC355');
    const estab = await criarEstab(adminA, empresa.body.id, cnpj);
    const res = await request(app.getHttpServer())
      .get(`/fiscal/estabelecimentos/${estab.body.id}/historico`)
      .set('Cookie', adminA);
    expect(res.status).toBe(200);
    const texto = JSON.stringify(res.body);
    expect(texto).not.toMatch(/estabelecimentos|estabelecimento_cnaes|regimes_tributarios|auditoria/);
    expect(texto).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/i);
    expect(res.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ objeto: 'estabelecimento', usuarioNome: expect.any(String) }),
    ]));
  });

  it('aprovado não removível → 409; suspender é a reversão', async () => {
    const cnpj = cnpjDe('12ABC3560001');
    const empresa = await criarEmpresa(adminA, '12ABC356');
    const estab = await criarEstab(adminA, empresa.body.id, cnpj, [
      { codigo: '6201501', descricao: 'Desenvolvimento', tipo: 'PRINCIPAL' },
    ]);
    const submetido = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.body.id}/submeter`)
      .set('Cookie', adminA)
      .send({ versao: estab.body.versao, justificativa: MOTIVO });
    const aprovado = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.body.id}/aprovar`)
      .set('Cookie', adminB)
      .send({ versao: submetido.body.versao, justificativa: MOTIVO });
    const removido = await request(app.getHttpServer())
      .delete(`/fiscal/estabelecimentos/${estab.body.id}`)
      .set('Cookie', adminA)
      .send({ justificativa: MOTIVO });
    expect(removido.status).toBe(409);
    const suspenso = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.body.id}/suspender`)
      .set('Cookie', adminB)
      .send({ versao: aprovado.body.versao, justificativa: MOTIVO });
    expect(suspenso.status).toBe(200);
    expect(suspenso.body.situacao).toBe('SUSPENDED');
  });

  it('quem submeteu pode suspender estabelecimento aprovado por outro (sem segregação)', async () => {
    const empresa = await criarEmpresa(adminA, '12ABC399');
    const estab = await criarEstab(adminA, empresa.body.id, cnpjDe('12ABC3990001'), [
      { codigo: '6201501', descricao: 'Desenvolvimento', tipo: 'PRINCIPAL' },
    ]);
    const submetido = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.body.id}/submeter`)
      .set('Cookie', adminA)
      .send({ versao: estab.body.versao, justificativa: MOTIVO });
    const aprovado = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.body.id}/aprovar`)
      .set('Cookie', adminB)
      .send({ versao: submetido.body.versao, justificativa: MOTIVO });
    const suspenso = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.body.id}/suspender`)
      .set('Cookie', adminA)
      .send({ versao: aprovado.body.versao, justificativa: MOTIVO });
    expect(suspenso.status).toBe(200);
    expect(suspenso.body.situacao).toBe('SUSPENDED');
  });

  it('filtro de outra empresa → 422', async () => {
    const a = await criarEmpresa(adminA, '12ABC357');
    const b = await criarEmpresa(adminA, '12ABC358');
    const estab = await criarEstab(adminA, a.body.id, cnpjDe('12ABC3570001'));
    const res = await request(app.getHttpServer())
      .get(`/fiscal/estabelecimentos?empresaId=${b.body.id}&estabelecimentoId=${estab.body.id}`)
      .set('Cookie', adminA);
    expect(res.status).toBe(422);
    expect(codigoDe(res.body)).toBe('ESTABELECIMENTO_DE_OUTRA_EMPRESA');
  });

  it('PATCH com id/empresaId/cnpj/cnpjRaiz → 400; linha inalterada', async () => {
    const empresa = await criarEmpresa(adminA, '12ABC359');
    const estab = await criarEstab(adminA, empresa.body.id, cnpjDe('12ABC3590001'));
    const empresaPatch = await request(app.getHttpServer())
      .patch(`/fiscal/empresas/${empresa.body.id}`)
      .set('Cookie', adminA)
      .send({ razaoSocial: 'Nova', versao: 1, justificativa: MOTIVO, cnpjRaiz: '00000000' });
    expect(empresaPatch.status).toBe(400);
    const estabPatch = await request(app.getHttpServer())
      .patch(`/fiscal/estabelecimentos/${estab.body.id}`)
      .set('Cookie', adminA)
      .send({ nome: 'Outro', versao: 1, justificativa: MOTIVO, cnpj: cnpjDe('12ABC3590002'), empresaId: empresa.body.id });
    expect(estabPatch.status).toBe(400);
    const detalhe = await request(app.getHttpServer()).get(`/fiscal/estabelecimentos/${estab.body.id}`).set('Cookie', adminA);
    expect(detalhe.body.nome).toBe('Filial Osasco');
    expect(detalhe.body.versao).toBe(1);
  });

  it('empresaAtiva/listarEmpresasAtivasIds', async () => {
    const empresas = app.get(EmpresasService);
    const db = app.get<{ db: NodePgDatabase<typeof schema> }>(DRIZZLE).db;
    const empresa = await criarEmpresa(adminA, '12ABC360');
    expect(await empresas.empresaAtiva(db, empresa.body.id)).toBe(false);
    const estab = await criarEstab(adminA, empresa.body.id, cnpjDe('12ABC3600001'), [
      { codigo: '6201501', descricao: 'Desenvolvimento', tipo: 'PRINCIPAL' },
    ]);
    const submetido = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.body.id}/submeter`)
      .set('Cookie', adminA)
      .send({ versao: estab.body.versao, justificativa: MOTIVO });
    await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.body.id}/aprovar`)
      .set('Cookie', adminB)
      .send({ versao: submetido.body.versao, justificativa: MOTIVO });
    expect(await empresas.empresaAtiva(db, empresa.body.id)).toBe(true);
    expect(await empresas.listarEmpresasAtivasIds(db)).toContain(empresa.body.id);
  });

  it('dadosFiscaisVigentes null sem aprovação; valor com cnaePrincipal', async () => {
    const servico = app.get(EstabelecimentosService);
    const db = app.get<{ db: NodePgDatabase<typeof schema> }>(DRIZZLE).db;
    const empresa = await criarEmpresa(adminA, '12ABC361');
    const estab = await criarEstab(adminA, empresa.body.id, cnpjDe('12ABC3610001'), [
      { codigo: '6201501', descricao: 'Desenvolvimento', tipo: 'PRINCIPAL' },
    ]);
    const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    expect(await servico.dadosFiscaisVigentes(db, estab.body.id, hoje)).toBeNull();
    const submetido = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.body.id}/submeter`)
      .set('Cookie', adminA)
      .send({ versao: estab.body.versao, justificativa: MOTIVO });
    const aprovado = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.body.id}/aprovar`)
      .set('Cookie', adminB)
      .send({ versao: submetido.body.versao, justificativa: MOTIVO });
    expect(aprovado.status).toBe(200);
    const regime = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.body.id}/regimes`)
      .set('Cookie', adminA)
      .send({ crt: '3', vigenciaInicio: '2020-01-01', justificativa: MOTIVO });
    const regimeSubmetido = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.body.id}/regimes/${regime.body.id}/submeter`)
      .set('Cookie', adminA)
      .send({ versao: regime.body.versao, justificativa: MOTIVO });
    const regimeAprovado = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.body.id}/regimes/${regime.body.id}/aprovar`)
      .set('Cookie', adminB)
      .send({ versao: regimeSubmetido.body.versao, justificativa: MOTIVO });
    expect(regimeAprovado.status).toBe(200);
    expect(await servico.dadosFiscaisVigentes(db, estab.body.id, hoje)).toEqual({
      cnpj: estab.body.cnpj,
      inscricaoEstadual: '123456789',
      uf: 'SP',
      crt: '3',
      cnaePrincipal: '6201501',
    });
  });

  it('exportação CSV com rótulos, separador e sem id', async () => {
    const cnpj = cnpjDe('12ABC3620001');
    const empresa = await criarEmpresa(adminA, '12ABC362', 'Alpha Exportacao Fiscal');
    await criarEstab(adminA, empresa.body.id, cnpj);
    const res = await request(app.getHttpServer())
      .get(`/fiscal/estabelecimentos/exportacao?search=${cnpj}`)
      .set('Cookie', adminA);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text.charCodeAt(0)).toBe(0xfeff);
    expect(res.text).toContain('Estabelecimento;CNPJ;Regime tributário;Estado;Situação;Empresa');
    expect(res.text).toContain(cnpj);
    expect(res.text).toContain('Alpha Exportacao Fiscal');
    expect(res.text).toContain('Rascunho');
    expect(res.text).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/i);
  });

  it('lista empresas sem filtro e trata total nulo da contagem como zero', async () => {
    const criada = await criarEmpresa(adminA, '71ABC001', 'Alpha Sem Filtro');
    expect(criada.status).toBe(201);
    const semFiltro = await request(app.getHttpServer()).get('/fiscal/empresas').set('Cookie', adminA);
    expect(semFiltro.status).toBe(200);
    expect(semFiltro.body.data.some((linha: { id: string }) => linha.id === criada.body.id)).toBe(true);
    const emBranco = await request(app.getHttpServer()).get('/fiscal/empresas?search=%20%20').set('Cookie', adminA);
    expect(emBranco.status).toBe(200);

    const { db } = app.get<{ db: NodePgDatabase<typeof schema> }>(DRIZZLE);
    const original = db.select.bind(db);
    const spy = jest.spyOn(db, 'select');
    spy.mockImplementationOnce(((...args: never[]) => {
      const builder = original(...args);
      const fromOriginal = builder.from.bind(builder);
      builder.from = ((...fromArgs: never[]) => {
        const selecionado = fromOriginal(...fromArgs);
        selecionado.where = (() => Promise.resolve([{ total: null }])) as typeof selecionado.where;
        return selecionado;
      }) as typeof builder.from;
      return builder;
    }) as typeof db.select);
    try {
      const service = app.get(EmpresasService);
      const pagina = await service.listar({ page: 1, pageSize: 20 });
      expect(pagina.total).toBe(0);
    } finally {
      spy.mockRestore();
    }
  });

  it('versão divergente, empresa inexistente e empresa com estabelecimento', async () => {
    const criada = await criarEmpresa(adminA, '71ABC002');
    expect(criada.status).toBe(201);
    const versao = await request(app.getHttpServer())
      .patch(`/fiscal/empresas/${criada.body.id}`)
      .set('Cookie', adminA)
      .send({ razaoSocial: 'Alpha Versao', versao: criada.body.versao + 4, justificativa: MOTIVO });
    expect(versao.status).toBe(409);
    expect(codigoDe(versao.body)).toBe('CONFLITO_CONCORRENTE');
    const ausente = await request(app.getHttpServer())
      .patch('/fiscal/empresas/00000000-0000-4000-8000-000000000099')
      .set('Cookie', adminA)
      .send({ razaoSocial: 'Ninguem', versao: 1, justificativa: MOTIVO });
    expect(ausente.status).toBe(404);
    const estab = await criarEstab(adminA, criada.body.id, cnpjDe('71ABC0020001'));
    expect(estab.status).toBe(201);
    const removida = await request(app.getHttpServer())
      .delete(`/fiscal/empresas/${criada.body.id}`)
      .set('Cookie', adminA)
      .send({ justificativa: MOTIVO });
    expect(removida.status).toBe(409);
    expect(codigoDe(removida.body)).toBe('EMPRESA_COM_ESTABELECIMENTOS');
  });

  it('criar com usuário inexistente relança erro que não é a raiz duplicada', async () => {
    const service = app.get(EmpresasService);
    await expect(service.criar(
      { razaoSocial: 'Sem Usuario Fiscal', cnpjRaiz: '71ABC003', justificativa: MOTIVO },
      '00000000-0000-4000-8000-000000000099',
    )).rejects.toThrow();
  });

  it('returning vazio em gravar, atualizar e remover empresa', async () => {
    const { db } = app.get<{ db: NodePgDatabase<typeof schema> }>(DRIZZLE);
    await db.execute(sql.raw(`
      CREATE OR REPLACE FUNCTION e01_cov_pular_empresa()
      RETURNS trigger LANGUAGE plpgsql AS $fn$
      BEGIN
        IF TG_OP = 'INSERT' AND NEW.razao_social = 'FALHA GRAVAR' THEN
          RETURN NULL;
        END IF;
        IF TG_OP = 'UPDATE' AND NEW.razao_social = 'FALHA ATUALIZAR' THEN
          RETURN NULL;
        END IF;
        IF TG_OP = 'UPDATE' AND NEW.deleted_at IS NOT NULL AND OLD.razao_social = 'FALHA REMOVER' THEN
          RETURN NULL;
        END IF;
        RETURN NEW;
      END;
      $fn$
    `));
    await db.execute(sql.raw('DROP TRIGGER IF EXISTS e01_cov_pular_empresa ON empresas'));
    await db.execute(sql.raw(`
      CREATE TRIGGER e01_cov_pular_empresa
      BEFORE INSERT OR UPDATE ON empresas
      FOR EACH ROW EXECUTE FUNCTION e01_cov_pular_empresa()
    `));
    try {
      const gravar = await criarEmpresa(adminA, '71ABC004', 'FALHA GRAVAR');
      expect(gravar.status).toBe(500);
      const criada = await criarEmpresa(adminA, '71ABC005', 'Alpha Atualizavel');
      expect(criada.status).toBe(201);
      const atualizar = await request(app.getHttpServer())
        .patch(`/fiscal/empresas/${criada.body.id}`)
        .set('Cookie', adminA)
        .send({ razaoSocial: 'FALHA ATUALIZAR', versao: criada.body.versao, justificativa: MOTIVO });
      expect(atualizar.status).toBe(409);
      expect(codigoDe(atualizar.body)).toBe('CONFLITO_CONCORRENTE');
      const removivel = await criarEmpresa(adminA, '71ABC006', 'FALHA REMOVER');
      expect(removivel.status).toBe(201);
      const remover = await request(app.getHttpServer())
        .delete(`/fiscal/empresas/${removivel.body.id}`)
        .set('Cookie', adminA)
        .send({ justificativa: MOTIVO });
      expect(remover.status).toBe(500);
    } finally {
      await db.execute(sql.raw('DROP TRIGGER IF EXISTS e01_cov_pular_empresa ON empresas'));
      await db.execute(sql.raw('DROP FUNCTION IF EXISTS e01_cov_pular_empresa()'));
    }
  });

  async function aprovarEstab(raiz: string) {
    const empresa = await criarEmpresa(adminA, raiz);
    expect(empresa.status).toBe(201);
    const estab = await criarEstab(adminA, empresa.body.id, cnpjDe(`${raiz}0001`), [
      { codigo: '6201501', descricao: 'Desenvolvimento', tipo: 'PRINCIPAL' },
    ]);
    expect(estab.status).toBe(201);
    const submetido = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.body.id}/submeter`)
      .set('Cookie', adminA)
      .send({ versao: estab.body.versao, justificativa: MOTIVO });
    const aprovado = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.body.id}/aprovar`)
      .set('Cookie', adminB)
      .send({ versao: submetido.body.versao, justificativa: MOTIVO });
    expect(aprovado.status).toBe(200);
    return { empresaId: empresa.body.id as string, estab: aprovado.body as { id: string; versao: number; cnpj: string } };
  }

  it('lista e contagens de estabelecimentos com e sem filtro', async () => {
    const semRegime = await criarEmpresa(adminA, '71ABC010', 'Alpha Lista Fiscal');
    const rascunho = await criarEstab(adminA, semRegime.body.id, cnpjDe('71ABC0100001'));
    expect(rascunho.status).toBe(201);
    const { empresaId, estab } = await aprovarEstab('71ABC011');
    const regime = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.id}/regimes`)
      .set('Cookie', adminA)
      .send({ crt: '3', vigenciaInicio: '2020-01-01', justificativa: MOTIVO });
    expect(regime.status).toBe(201);
    const regimeSubmetido = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.id}/regimes/${regime.body.id}/submeter`)
      .set('Cookie', adminA)
      .send({ versao: regime.body.versao, justificativa: MOTIVO });
    const regimeAprovado = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.id}/regimes/${regime.body.id}/aprovar`)
      .set('Cookie', adminB)
      .send({ versao: regimeSubmetido.body.versao, justificativa: MOTIVO });
    expect(regimeAprovado.status).toBe(200);

    const asc = await request(app.getHttpServer())
      .get('/fiscal/estabelecimentos?dir=asc&sort=estabelecimento')
      .set('Cookie', adminA);
    expect(asc.status).toBe(200);
    expect(asc.body.data.some((linha: { regime: unknown }) => linha.regime === null)).toBe(true);
    expect(asc.body.data.some((linha: { regime: { crt?: string } | null }) => linha.regime?.crt === '3')).toBe(true);

    const desc = await request(app.getHttpServer())
      .get(`/fiscal/estabelecimentos?empresaId=${empresaId}&estabelecimentoId=${estab.id}&situacao=APPROVED&search=%25Filial%5F&dir=desc&sort=uf`)
      .set('Cookie', adminA);
    expect(desc.status).toBe(200);
    expect(desc.body.data).toEqual([expect.objectContaining({ id: estab.id, situacao: 'APPROVED' })]);

    const contagens = await request(app.getHttpServer())
      .get(`/fiscal/estabelecimentos/contagens?empresaId=${semRegime.body.id}&situacao=DRAFT`)
      .set('Cookie', adminA);
    expect(contagens.status).toBe(200);
    expect(contagens.body.total).toBeGreaterThanOrEqual(1);
    expect(contagens.body).toEqual(expect.objectContaining({
      emRevisao: expect.any(Number),
      suspensos: expect.any(Number),
    }));

    const alheio = await request(app.getHttpServer())
      .get(`/fiscal/estabelecimentos?empresaId=${empresaId}&estabelecimentoId=00000000-0000-4000-8000-000000000099`)
      .set('Cookie', adminA);
    expect(alheio.status).toBe(404);
  });

  it('edição omite nome, bloqueia revisão e empresa ausente', async () => {
    const empresa = await criarEmpresa(adminA, '71ABC012');
    const estab = await criarEstab(adminA, empresa.body.id, cnpjDe('71ABC0120001'), [
      { codigo: '6201501', descricao: 'Desenvolvimento', tipo: 'PRINCIPAL' },
    ]);
    const omitido = await request(app.getHttpServer())
      .patch(`/fiscal/estabelecimentos/${estab.body.id}`)
      .set('Cookie', adminA)
      .send({ versao: estab.body.versao, justificativa: MOTIVO });
    expect(omitido.status).toBe(200);
    expect(omitido.body.nome).toBe('Filial Osasco');
    const submetido = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.body.id}/submeter`)
      .set('Cookie', adminA)
      .send({ versao: omitido.body.versao, justificativa: MOTIVO });
    const bloqueado = await request(app.getHttpServer())
      .patch(`/fiscal/estabelecimentos/${estab.body.id}`)
      .set('Cookie', adminA)
      .send({ nome: 'Durante revisao', versao: submetido.body.versao, justificativa: MOTIVO });
    expect(bloqueado.status).toBe(409);
    expect(codigoDe(bloqueado.body)).toBe('TRANSICAO_INVALIDA');
    const fantasma = await request(app.getHttpServer())
      .post('/fiscal/estabelecimentos')
      .set('Cookie', adminA)
      .send({
        empresaId: '00000000-0000-4000-8000-000000000099',
        nome: 'Filial Osasco',
        cnpj: cnpjDe('71ABC0130001'),
        inscricaoEstadual: '123456789',
        inscricaoMunicipal: '98765',
        uf: 'SP',
        justificativa: MOTIVO,
      });
    expect(fantasma.status).toBe(404);
    const ausente = await request(app.getHttpServer())
      .get('/fiscal/estabelecimentos/00000000-0000-4000-8000-000000000098')
      .set('Cookie', adminA);
    expect(ausente.status).toBe(404);
  });

  it('histórico cobre alteração, CNAE proposto, regime e auditoria sem usuário', async () => {
    const { estab } = await aprovarEstab('71ABC014');
    const alteracao = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.id}/alteracoes`)
      .set('Cookie', adminA)
      .send({
        nome: 'Filial Barueri',
        inscricaoEstadual: '555444333',
        inscricaoMunicipal: '111222333',
        uf: 'RJ',
        cnaes: [
          { codigo: '6202300', descricao: 'Outros', tipo: 'PRINCIPAL' },
          { codigo: '6201501', descricao: 'Desenvolvimento', tipo: 'SECUNDARIA' },
        ],
        versao: estab.versao,
        justificativa: MOTIVO,
      });
    expect(alteracao.status).toBe(201);
    const regime = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.id}/regimes`)
      .set('Cookie', adminA)
      .send({ crt: '1', vigenciaInicio: '2026-01-01', vigenciaFim: '2026-12-31', justificativa: MOTIVO });
    expect(regime.status).toBe(201);
    const { db } = app.get<{ db: NodePgDatabase<typeof schema> }>(DRIZZLE);
    await db.insert(schema.auditoria).values({
      tabela: 'estabelecimentos',
      registroId: estab.id,
      operacao: 'UPDATE',
      usuarioId: null,
      justificativa: MOTIVO,
    });
    const historico = await request(app.getHttpServer())
      .get(`/fiscal/estabelecimentos/${estab.id}/historico`)
      .set('Cookie', adminA);
    expect(historico.status).toBe(200);
    expect(historico.body.some((linha: { objeto: string }) => linha.objeto === 'alteracao')).toBe(true);
    expect(historico.body.some((linha: { objeto: string }) => linha.objeto === 'regime')).toBe(true);
    expect(historico.body.some((linha: { usuarioNome: string }) => linha.usuarioNome === '')).toBe(true);
  });

  it('pré-condições avaliam regime aprovado, futuro, encerrado e rascunho', async () => {
    const empresa = await criarEmpresa(adminA, '71ABC015');
    const estab = await criarEstab(adminA, empresa.body.id, cnpjDe('71ABC0150001'), [
      { codigo: '6201501', descricao: 'Desenvolvimento', tipo: 'PRINCIPAL' },
    ]);
    const { db } = app.get<{ db: NodePgDatabase<typeof schema> }>(DRIZZLE);
    const [linha] = await db.select().from(schema.estabelecimentos).where(eq(schema.estabelecimentos.id, estab.body.id));
    const cenarios = [
      { situacao: 'DRAFT' as const, vigenciaInicio: '2020-01-01', vigenciaFim: null, decidido: false },
      { situacao: 'APPROVED' as const, vigenciaInicio: '2999-01-01', vigenciaFim: null, decidido: true },
      { situacao: 'APPROVED' as const, vigenciaInicio: '2000-01-01', vigenciaFim: '2000-12-31', decidido: true },
      { situacao: 'APPROVED' as const, vigenciaInicio: '2020-01-01', vigenciaFim: null, decidido: true },
      { situacao: 'APPROVED' as const, vigenciaInicio: '2020-01-01', vigenciaFim: '2999-12-31', decidido: true },
    ];
    for (const cenario of cenarios) {
      await db.update(schema.regimesTributarios)
        .set({ deletedAt: new Date() })
        .where(eq(schema.regimesTributarios.estabelecimentoId, estab.body.id));
      await db.insert(schema.regimesTributarios).values({
        estabelecimentoId: estab.body.id,
        empresaId: linha!.empresaId,
        crt: '3',
        vigenciaInicio: cenario.vigenciaInicio,
        vigenciaFim: cenario.vigenciaFim,
        situacao: cenario.situacao,
        justificativa: MOTIVO,
        decididoPorId: cenario.decidido ? linha!.criadoPorId : null,
        decididoEm: cenario.decidido ? new Date() : null,
        criadoPorId: linha!.criadoPorId,
        atualizadoPorId: linha!.atualizadoPorId,
      });
      const res = await request(app.getHttpServer())
        .get(`/fiscal/estabelecimentos/${estab.body.id}/pre-condicoes`)
        .set('Cookie', adminA);
      expect(res.status).toBe(200);
      expect(res.body.find((item: { codigo: string }) => item.codigo === 'REGIME_VIGENTE_APROVADO')).toEqual(
        expect.objectContaining({ atendida: cenario.situacao === 'APPROVED' && cenario.vigenciaInicio === '2020-01-01' }),
      );
    }
  });

  it('dados fiscais nulos sem regime vigente e sem CNAE principal', async () => {
    const { estab } = await aprovarEstab('71ABC016');
    const servico = app.get(EstabelecimentosService);
    const { db } = app.get<{ db: NodePgDatabase<typeof schema> }>(DRIZZLE);
    const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    expect(await servico.dadosFiscaisVigentes(db, estab.id, hoje)).toBeNull();
    const [linha] = await db.select().from(schema.estabelecimentos).where(eq(schema.estabelecimentos.id, estab.id));
    await db.insert(schema.regimesTributarios).values({
      estabelecimentoId: estab.id,
      empresaId: linha!.empresaId,
      crt: '3',
      vigenciaInicio: '2020-01-01',
      situacao: 'APPROVED',
      justificativa: MOTIVO,
      decididoPorId: linha!.criadoPorId,
      decididoEm: new Date(),
      criadoPorId: linha!.criadoPorId,
      atualizadoPorId: linha!.atualizadoPorId,
    });
    await db.update(schema.estabelecimentoCnaes)
      .set({ deletedAt: new Date() })
      .where(eq(schema.estabelecimentoCnaes.estabelecimentoId, estab.id));
    expect(await servico.dadosFiscaisVigentes(db, estab.id, hoje)).toBeNull();
  });

  it('remoção bloqueia regime em revisão ou aprovado e apaga regime rascunho', async () => {
    const empresa = await criarEmpresa(adminA, '71ABC017');
    const rascunho = await criarEstab(adminA, empresa.body.id, cnpjDe('71ABC0170001'));
    const regimeRascunho = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${rascunho.body.id}/regimes`)
      .set('Cookie', adminA)
      .send({ crt: '3', vigenciaInicio: '2026-01-01', vigenciaFim: '2026-06-30', justificativa: MOTIVO });
    expect(regimeRascunho.status).toBe(201);
    const removido = await request(app.getHttpServer())
      .delete(`/fiscal/estabelecimentos/${rascunho.body.id}`)
      .set('Cookie', adminA)
      .send({ justificativa: MOTIVO });
    expect(removido.status).toBe(200);

    const empresaRevisao = await criarEmpresa(adminA, '71ABC018');
    const emRevisao = await criarEstab(adminA, empresaRevisao.body.id, cnpjDe('71ABC0180001'));
    const regimeRevisao = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${emRevisao.body.id}/regimes`)
      .set('Cookie', adminA)
      .send({ crt: '3', vigenciaInicio: '2026-01-01', justificativa: MOTIVO });
    const submetido = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${emRevisao.body.id}/regimes/${regimeRevisao.body.id}/submeter`)
      .set('Cookie', adminA)
      .send({ versao: regimeRevisao.body.versao, justificativa: MOTIVO });
    expect(submetido.status).toBe(200);
    const bloqueado = await request(app.getHttpServer())
      .delete(`/fiscal/estabelecimentos/${emRevisao.body.id}`)
      .set('Cookie', adminA)
      .send({ justificativa: MOTIVO });
    expect(bloqueado.status).toBe(409);
    expect(codigoDe(bloqueado.body)).toBe('ESTABELECIMENTO_COM_REGIME_ATIVO');

    const { estab } = await aprovarEstab('71ABC019');
    const regime = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.id}/regimes`)
      .set('Cookie', adminA)
      .send({ crt: '3', vigenciaInicio: '2020-01-01', justificativa: MOTIVO });
    const regimeSubmetido = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.id}/regimes/${regime.body.id}/submeter`)
      .set('Cookie', adminA)
      .send({ versao: regime.body.versao, justificativa: MOTIVO });
    await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.id}/regimes/${regime.body.id}/aprovar`)
      .set('Cookie', adminB)
      .send({ versao: regimeSubmetido.body.versao, justificativa: MOTIVO });
    const suspenso = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.id}/suspender`)
      .set('Cookie', adminB)
      .send({ versao: estab.versao, justificativa: MOTIVO });
    const reativado = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.id}/reativar`)
      .set('Cookie', adminA)
      .send({ versao: suspenso.body.versao, justificativa: MOTIVO });
    const rejeitado = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.id}/rejeitar`)
      .set('Cookie', adminB)
      .send({ versao: reativado.body.versao, justificativa: MOTIVO });
    expect(rejeitado.status).toBe(200);
    const comAprovado = await request(app.getHttpServer())
      .delete(`/fiscal/estabelecimentos/${estab.id}`)
      .set('Cookie', adminA)
      .send({ justificativa: MOTIVO });
    expect(comAprovado.status).toBe(409);
    expect(codigoDe(comAprovado.body)).toBe('ESTABELECIMENTO_COM_REGIME_ATIVO');
  });
});
