import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { validarCnpjAlfanumerico } from '../../src/common/validators/cnpj-alfanumerico';
import { DRIZZLE } from '../../src/database/database.module';
import * as schema from '../../src/database/schema';
import { EstabelecimentosService } from '../../src/modules/erp/fiscal/empresas/estabelecimentos.service';
import { cleanupDb, createTestApp, createTestUser, joinSetCookie } from '../helpers/test-app';

const MOTIVO = 'Ajuste de cadastro fiscal';
const CNAE_ORIGINAL = [{ codigo: '6201501', descricao: 'Desenvolvimento', tipo: 'PRINCIPAL' }];

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

function proposta(versao: number, extra: Record<string, unknown> = {}) {
  return {
    nome: 'Filial Barueri',
    inscricaoEstadual: '555444333',
    inscricaoMunicipal: '111222333',
    uf: 'RJ',
    cnaes: [
      { codigo: '6202300', descricao: 'Outros', tipo: 'PRINCIPAL' },
      { codigo: '6201501', descricao: 'Desenvolvimento', tipo: 'SECUNDARIA' },
    ],
    versao,
    justificativa: MOTIVO,
    ...extra,
  };
}

describe('E01-T01 alterações pendentes', () => {
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

  async function aprovarEstabelecimento(raiz: string) {
    const cnpj = cnpjDe(`${raiz}0001`);
    const empresa = await request(app.getHttpServer())
      .post('/fiscal/empresas')
      .set('Cookie', adminA)
      .send({ razaoSocial: 'Alpha Carnes LTDA', cnpjRaiz: raiz, justificativa: MOTIVO });
    expect(empresa.status).toBe(201);
    const estab = await request(app.getHttpServer())
      .post('/fiscal/estabelecimentos')
      .set('Cookie', adminA)
      .send({
        empresaId: empresa.body.id,
        nome: 'Filial Osasco',
        cnpj,
        inscricaoEstadual: '123456789',
        inscricaoMunicipal: '98765',
        uf: 'SP',
        cnaes: CNAE_ORIGINAL,
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
    expect(aprovado.body.situacao).toBe('APPROVED');
    return aprovado.body as {
      id: string;
      versao: number;
      nome: string;
      inscricaoEstadual: string;
      inscricaoMunicipal: string;
      uf: string;
      cnaes: { codigo: string; descricao: string; tipo: string }[];
    };
  }

  async function ficha(id: string) {
    const res = await request(app.getHttpServer()).get(`/fiscal/estabelecimentos/${id}`).set('Cookie', adminA);
    expect(res.status).toBe(200);
    return res.body as {
      nome: string;
      inscricaoEstadual: string;
      inscricaoMunicipal: string;
      uf: string;
      situacao: string;
      versao: number;
      cnaes: { codigo: string; descricao: string; tipo: string }[];
      alteracaoAberta: { id: string; nome: string; situacao: string; versao: number } | null;
    };
  }

  it('PATCH em APPROVED → 409 ALTERACAO_EXIGIDA', async () => {
    const estab = await aprovarEstabelecimento('31ABC001');
    const editado = await request(app.getHttpServer())
      .patch(`/fiscal/estabelecimentos/${estab.id}`)
      .set('Cookie', adminA)
      .send({ nome: 'Nome direto', versao: estab.versao, justificativa: MOTIVO });
    expect(editado.status).toBe(409);
    expect(codigoDe(editado.body)).toBe('ALTERACAO_EXIGIDA');
  });

  it('criar alteração mantém o aprovado e a leitura fiscal durante a revisão', async () => {
    const estab = await aprovarEstabelecimento('31ABC002');
    const { db } = app.get<{ db: NodePgDatabase<typeof schema> }>(DRIZZLE);
    const [linha] = await db.select().from(schema.estabelecimentos).where(eq(schema.estabelecimentos.id, estab.id));
    await db.insert(schema.regimesTributarios).values({
      estabelecimentoId: estab.id,
      empresaId: linha!.empresaId,
      crt: '3',
      vigenciaInicio: '2020-01-01',
      situacao: 'APPROVED',
      justificativa: MOTIVO,
      decididoPorId: linha!.decididoPorId!,
      decididoEm: new Date(),
      criadoPorId: linha!.criadoPorId,
      atualizadoPorId: linha!.atualizadoPorId,
    });
    const criada = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.id}/alteracoes`)
      .set('Cookie', adminA)
      .send(proposta(estab.versao));
    expect(criada.status).toBe(201);
    expect(criada.body.situacao).toBe('DRAFT');
    const antes = await ficha(estab.id);
    expect(antes.situacao).toBe('APPROVED');
    expect(antes.nome).toBe('Filial Osasco');
    expect(antes.inscricaoEstadual).toBe('123456789');
    expect(antes.uf).toBe('SP');
    expect(antes.alteracaoAberta?.nome).toBe('Filial Barueri');
    const submetida = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.id}/alteracoes/${criada.body.id}/submeter`)
      .set('Cookie', adminA)
      .send({ versao: criada.body.versao, justificativa: MOTIVO });
    expect(submetida.status).toBe(200);
    expect(submetida.body.situacao).toBe('REVIEW');
    const durante = await ficha(estab.id);
    expect(durante.nome).toBe('Filial Osasco');
    expect(durante.alteracaoAberta?.situacao).toBe('REVIEW');
    const leitura = await app.get(EstabelecimentosService).dadosFiscaisVigentes(db, estab.id, '2026-10-13');
    expect(leitura).toEqual({
      cnpj: linha!.cnpj,
      inscricaoEstadual: '123456789',
      uf: 'SP',
      crt: '3',
      cnaePrincipal: '6201501',
    });
  });

  it('aprovar aplica nome, inscrições, UF, CNAEs e incrementa versão', async () => {
    const estab = await aprovarEstabelecimento('31ABC003');
    const criada = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.id}/alteracoes`)
      .set('Cookie', adminA)
      .send(proposta(estab.versao));
    const submetida = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.id}/alteracoes/${criada.body.id}/submeter`)
      .set('Cookie', adminA)
      .send({ versao: criada.body.versao, justificativa: MOTIVO });
    const aprovada = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.id}/alteracoes/${criada.body.id}/aprovar`)
      .set('Cookie', adminB)
      .send({ versao: submetida.body.versao, justificativa: MOTIVO });
    expect(aprovada.status).toBe(200);
    expect(aprovada.body.situacao).toBe('APPROVED');
    const depois = await ficha(estab.id);
    expect(depois.nome).toBe('Filial Barueri');
    expect(depois.inscricaoEstadual).toBe('555444333');
    expect(depois.inscricaoMunicipal).toBe('111222333');
    expect(depois.uf).toBe('RJ');
    expect(depois.versao).toBe(estab.versao + 1);
    expect(depois.alteracaoAberta).toBeNull();
    expect(depois.cnaes).toEqual(expect.arrayContaining([
      expect.objectContaining({ codigo: '6202300', tipo: 'PRINCIPAL' }),
      expect.objectContaining({ codigo: '6201501', tipo: 'SECUNDARIA' }),
    ]));
    expect(depois.cnaes).toHaveLength(2);
  });

  it('rejeitar mantém linha e CNAEs aprovados idênticos', async () => {
    const estab = await aprovarEstabelecimento('31ABC004');
    const antes = await ficha(estab.id);
    const criada = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.id}/alteracoes`)
      .set('Cookie', adminA)
      .send(proposta(estab.versao));
    const submetida = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.id}/alteracoes/${criada.body.id}/submeter`)
      .set('Cookie', adminA)
      .send({ versao: criada.body.versao, justificativa: MOTIVO });
    const rejeitada = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.id}/alteracoes/${criada.body.id}/rejeitar`)
      .set('Cookie', adminB)
      .send({ versao: submetida.body.versao, justificativa: MOTIVO });
    expect(rejeitada.status).toBe(200);
    expect(rejeitada.body.situacao).toBe('REJECTED');
    const depois = await ficha(estab.id);
    expect(depois.nome).toBe(antes.nome);
    expect(depois.inscricaoEstadual).toBe(antes.inscricaoEstadual);
    expect(depois.inscricaoMunicipal).toBe(antes.inscricaoMunicipal);
    expect(depois.uf).toBe(antes.uf);
    expect(depois.versao).toBe(antes.versao);
    expect(depois.cnaes).toEqual(antes.cnaes);
    expect(depois.alteracaoAberta).toBeNull();
  });

  it('segunda alteração aberta → 409 ALTERACAO_EM_ABERTO', async () => {
    const estab = await aprovarEstabelecimento('31ABC005');
    const primeira = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.id}/alteracoes`)
      .set('Cookie', adminA)
      .send(proposta(estab.versao));
    expect(primeira.status).toBe(201);
    const segunda = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.id}/alteracoes`)
      .set('Cookie', adminA)
      .send(proposta(estab.versao, { nome: 'Outra proposta' }));
    expect(segunda.status).toBe(409);
    expect(codigoDe(segunda.body)).toBe('ALTERACAO_EM_ABERTO');
  });

  it('versão base desatualizada → 409 ALTERACAO_DESATUALIZADA', async () => {
    const estab = await aprovarEstabelecimento('31ABC006');
    const criada = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.id}/alteracoes`)
      .set('Cookie', adminA)
      .send(proposta(estab.versao));
    const submetida = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.id}/alteracoes/${criada.body.id}/submeter`)
      .set('Cookie', adminA)
      .send({ versao: criada.body.versao, justificativa: MOTIVO });
    const suspenso = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.id}/suspender`)
      .set('Cookie', adminB)
      .send({ versao: estab.versao, justificativa: MOTIVO });
    expect(suspenso.status).toBe(200);
    const aprovada = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.id}/alteracoes/${criada.body.id}/aprovar`)
      .set('Cookie', adminB)
      .send({ versao: submetida.body.versao, justificativa: MOTIVO });
    expect(aprovada.status).toBe(409);
    expect(codigoDe(aprovada.body)).toBe('ALTERACAO_DESATUALIZADA');
  });

  it('mesmo usuário aprova a alteração → 422 SEGREGACAO_FUNCAO', async () => {
    const estab = await aprovarEstabelecimento('31ABC007');
    const criada = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.id}/alteracoes`)
      .set('Cookie', adminA)
      .send(proposta(estab.versao));
    const submetida = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.id}/alteracoes/${criada.body.id}/submeter`)
      .set('Cookie', adminA)
      .send({ versao: criada.body.versao, justificativa: MOTIVO });
    const aprovada = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.id}/alteracoes/${criada.body.id}/aprovar`)
      .set('Cookie', adminA)
      .send({ versao: submetida.body.versao, justificativa: MOTIVO });
    expect(aprovada.status).toBe(422);
    expect(codigoDe(aprovada.body)).toBe('SEGREGACAO_FUNCAO');
  });

  it('gestor → 403', async () => {
    const estab = await aprovarEstabelecimento('31ABC008');
    const negado = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.id}/alteracoes`)
      .set('Cookie', gestor)
      .send(proposta(estab.versao));
    expect(negado.status).toBe(403);
  });

  it('remover estabelecimento rejeitado apaga a alteração aberta e os CNAEs propostos', async () => {
    const estab = await aprovarEstabelecimento('31ABC009');
    const criada = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.id}/alteracoes`)
      .set('Cookie', adminA)
      .send(proposta(estab.versao));
    expect(criada.status).toBe(201);
    const submetida = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.id}/alteracoes/${criada.body.id}/submeter`)
      .set('Cookie', adminA)
      .send({ versao: criada.body.versao, justificativa: MOTIVO });
    expect(submetida.status).toBe(200);
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
    expect(rejeitado.body.situacao).toBe('REJECTED');

    const { db } = app.get<{ db: NodePgDatabase<typeof schema> }>(DRIZZLE);
    const propostos = await db
      .select({ id: schema.estabelecimentoAlteracaoCnaes.id })
      .from(schema.estabelecimentoAlteracaoCnaes)
      .where(eq(schema.estabelecimentoAlteracaoCnaes.alteracaoId, criada.body.id));
    const ids = [criada.body.id, ...propostos.map((linha) => linha.id)];

    const removido = await request(app.getHttpServer())
      .delete(`/fiscal/estabelecimentos/${estab.id}`)
      .set('Cookie', adminA)
      .send({ justificativa: MOTIVO });
    expect(removido.status).toBe(200);

    const alteracao = await db
      .select()
      .from(schema.estabelecimentoAlteracoes)
      .where(eq(schema.estabelecimentoAlteracoes.id, criada.body.id));
    expect(alteracao[0]?.deletedAt).toBeTruthy();
    const cnaesRestantes = await db
      .select()
      .from(schema.estabelecimentoAlteracaoCnaes)
      .where(eq(schema.estabelecimentoAlteracaoCnaes.alteracaoId, criada.body.id));
    expect(cnaesRestantes.every((linha) => linha.deletedAt)).toBe(true);
    const abertas = await db
      .select()
      .from(schema.estabelecimentoAlteracoes)
      .where(and(
        eq(schema.estabelecimentoAlteracoes.estabelecimentoId, estab.id),
        isNull(schema.estabelecimentoAlteracoes.deletedAt),
        inArray(schema.estabelecimentoAlteracoes.situacao, ['DRAFT', 'REVIEW']),
      ));
    expect(abertas).toHaveLength(0);
    const deletes = await db
      .select()
      .from(schema.auditoria)
      .where(and(
        eq(schema.auditoria.operacao, 'DELETE'),
        inArray(schema.auditoria.registroId, ids),
      ));
    expect(deletes).toHaveLength(ids.length);
  });
});
