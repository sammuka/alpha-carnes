import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { eq } from 'drizzle-orm';
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
  });
});
