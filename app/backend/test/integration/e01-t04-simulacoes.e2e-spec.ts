import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { eq, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { validarCnpjAlfanumerico } from '../../src/common/validators/cnpj-alfanumerico';
import { DRIZZLE } from '../../src/database/database.module';
import * as schema from '../../src/database/schema';
import { cleanupDb, createTestApp, createTestUser, joinSetCookie } from '../helpers/test-app';

const MOTIVO = 'Regra inicial da vigência de 2026.';
const MOTIVO_SIM = 'Motivo da alteração desta simulação.';

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

describe('E01-T04 simulações fiscais', () => {
  let app: INestApplication;
  let admin = '';
  let adminB = '';
  let gestor = '';
  let gestorEmail = '';
  let gestorSenha = '';
  let seq = 80;
  let fetchSpy: jest.SpiedFunction<typeof fetch>;

  beforeAll(async () => {
    app = await createTestApp();
    await app.get<{ db: NodePgDatabase<typeof schema> }>(DRIZZLE).db.execute(sql`
      DELETE FROM perfis_permissoes
      WHERE perfil_id = (SELECT id FROM perfis WHERE slug = 'gestor')
        AND permissao_id IN (
          SELECT id FROM permissoes
          WHERE codigo IN ('FISCAL_SIMULACOES_LER', 'FISCAL_SIMULACOES_GERENCIAR')
        )
    `);
    const a = await createTestUser(app, { perfil: 'administrador' });
    const g = await createTestUser(app, { perfil: 'gestor' });
    gestorEmail = g.adminEmail;
    gestorSenha = g.adminPassword;
    admin = joinSetCookie(await request(app.getHttpServer()).post('/auth/login').send({ email: a.adminEmail, password: a.adminPassword }));
    gestor = joinSetCookie(await request(app.getHttpServer()).post('/auth/login').send({ email: gestorEmail, password: gestorSenha }));
    const emailB = `admin-b-sim-${Date.now()}@test.local`;
    const senhaB = 'TestPass@123456';
    const criado = await request(app.getHttpServer())
      .post('/usuarios')
      .set('Cookie', admin)
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
    return `71SM${String(seq).padStart(4, '0')}`;
  }

  function dataOp(): string {
    const dia = ((seq - 1) % 28) + 1;
    const mes = (Math.floor((seq - 1) / 28) % 12) + 1;
    return `2097-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
  }

  async function cenario(vigencia: { inicio?: string; fim?: string | null } = {}) {
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
        documentoFiscal: cnpjNumerico(`8${String(seq).padStart(11, '0')}`),
        faixaPreco: 'A',
      });
    expect(cliente.status).toBe(201);
    const cfop = await request(app.getHttpServer())
      .post('/fiscal/cfops')
      .set('Cookie', admin)
      .send({ codigo: String(5300 + (seq % 70)).padStart(4, '0'), descricao: `CFOP ${cnpjRaiz}`, justificativa: MOTIVO });
    expect(cfop.status).toBe(201);
    const ncm = await request(app.getHttpServer())
      .post('/fiscal/ncms')
      .set('Cookie', admin)
      .send({ codigo: String(4000000 + seq).padStart(8, '0'), descricao: `NCM ${cnpjRaiz}`, justificativa: MOTIVO });
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
        vigenciaInicio: vigencia.inicio ?? '2026-01-01',
        vigenciaFim: vigencia.fim === undefined ? '2026-12-31' : vigencia.fim,
        prioridade: 1,
        justificativa: MOTIVO,
      });
    expect(enquadramento.status).toBe(201);
    const beneficio = await request(app.getHttpServer())
      .post('/fiscal/beneficios-fiscais')
      .set('Cookie', admin)
      .send({ codigo: `SP${String(300000 + seq).padStart(6, '0')}`, descricao: `Benefício ${cnpjRaiz}`, justificativa: MOTIVO });
    expect(beneficio.status).toBe(201);
    const classificacao = await request(app.getHttpServer())
      .post('/fiscal/classificacoes-ibs-cbs')
      .set('Cookie', admin)
      .send({ codigo: String(100000 + seq).padStart(6, '0'), descricao: `Classificação ${cnpjRaiz}`, justificativa: MOTIVO });
    expect(classificacao.status).toBe(201);
    return {
      empresaId: empresa.body.id as string,
      estabelecimentoId: aprovado.body.id as string,
      operacaoId: operacao.body.id as string,
      clienteId: cliente.body.id as string,
      produtoId: produto.body.id as string,
      ncmId: ncm.body.id as string,
      cfopId: cfop.body.id as string,
      enquadramentoId: enquadramento.body.id as string,
      beneficioFiscalId: beneficio.body.id as string,
      classificacaoIbsCbsId: classificacao.body.id as string,
    };
  }

  async function aprovarRegra(base: Awaited<ReturnType<typeof cenario>>, extra: Record<string, unknown> = {}) {
    const criada = await request(app.getHttpServer())
      .post('/fiscal/regras')
      .set('Cookie', admin)
      .send({
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
      });
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
    return { regraId: criada.body.id as string, base };
  }

  function corpoDe(base: Awaited<ReturnType<typeof cenario>>, extra: Record<string, unknown> = {}) {
    return {
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
      justificativa: MOTIVO_SIM,
      ...extra,
    };
  }

  function simular(cookies: string, corpo: Record<string, unknown>) {
    return request(app.getHttpServer()).post('/fiscal/simulacoes').set('Cookie', cookies).send(corpo);
  }

  function explicar(cookies: string, id: string) {
    return request(app.getHttpServer()).get(`/fiscal/simulacoes/${id}/explicacao`).set('Cookie', cookies);
  }

  async function contarNotas() {
    const notas = await db().execute(sql`SELECT COUNT(*)::int AS n FROM notas_fiscais`);
    const fornecedor = await db().execute(sql`SELECT COUNT(*)::int AS n FROM notas_fiscais_fornecedor`);
    return {
      notas: Number((notas.rows[0] as { n: number }).n),
      fornecedor: Number((fornecedor.rows[0] as { n: number }).n),
    };
  }

  async function limparSimulacoes() {
    await db().execute(sql`DELETE FROM simulacoes_fiscais`);
  }

  it('competência fora da vigência não grava', async () => {
    const aprovada = await aprovarRegra(await cenario({ fim: '2027-12-31' }));
    await limparSimulacoes();
    const res = await simular(admin, corpoDe(aprovada.base, { competencia: '2027-01' }));
    expect(res.status).toBe(422);
    expect(codigoDe(res.body)).toBe('FALTA_REFERENCIA_LEGAL');
    const n = await db().execute(sql`SELECT COUNT(*)::int AS n FROM simulacoes_fiscais`);
    expect(n.rows[0]).toMatchObject({ n: 0 });
  });

  it('regra que começa em novembro não cobre outubro', async () => {
    const aprovada = await aprovarRegra(await cenario(), { vigenciaInicio: '2026-11-01' });
    await limparSimulacoes();
    const res = await simular(admin, corpoDe(aprovada.base, { competencia: '2026-10' }));
    expect(res.status).toBe(422);
    expect(codigoDe(res.body)).toBe('FALTA_REFERENCIA_LEGAL');
    const n = await db().execute(sql`SELECT COUNT(*)::int AS n FROM simulacoes_fiscais`);
    expect(n.rows[0]).toMatchObject({ n: 0 });
  });

  it('desconto maior que o valor não grava', async () => {
    const aprovada = await aprovarRegra(await cenario());
    await limparSimulacoes();
    const res = await simular(admin, corpoDe(aprovada.base, { valor: '1.000,00', desconto: '1.000,01' }));
    expect(res.status).toBe(422);
    expect(codigoDe(res.body)).toBe('DESCONTO_MAIOR_QUE_VALOR');
    const n = await db().execute(sql`SELECT COUNT(*)::int AS n FROM simulacoes_fiscais`);
    expect(n.rows[0]).toMatchObject({ n: 0 });
  });

  it('produto diferente do enquadramento não grava', async () => {
    const aprovada = await aprovarRegra(await cenario());
    const outro = await request(app.getHttpServer())
      .post('/produtos')
      .set('Cookie', admin)
      .send({ codigo: `P-OUTRO-${seq}`, nome: 'Patinho', unidadePedido: 'kg', atributosJson: {} });
    expect(outro.status).toBe(201);
    await limparSimulacoes();
    const res = await simular(admin, corpoDe(aprovada.base, { produtoId: outro.body.id }));
    expect(res.status).toBe(422);
    expect(codigoDe(res.body)).toBe('ENQUADRAMENTO_DIVERGENTE');
    const n = await db().execute(sql`SELECT COUNT(*)::int AS n FROM simulacoes_fiscais`);
    expect(n.rows[0]).toMatchObject({ n: 0 });
  });

  it('gestor sem FISCAL_SIMULACOES_* → 403', async () => {
    const aprovada = await aprovarRegra(await cenario());
    const res = await simular(gestor, corpoDe(aprovada.base));
    expect(res.status).toBe(403);
  });

  it('LER sem GERENCIAR → 403 no POST', async () => {
    const aprovada = await aprovarRegra(await cenario());
    const me = await request(app.getHttpServer()).get('/auth/me').set('Cookie', gestor);
    expect(me.status).toBe(200);
    const atuais = me.body.permissoes as string[];
    const comLeitura = await request(app.getHttpServer())
      .put('/perfis/gestor/permissoes')
      .set('Cookie', admin)
      .send({ permissoes: [...atuais, 'FISCAL_SIMULACOES_LER'] });
    expect(comLeitura.status).toBe(200);
    try {
      const relogado = joinSetCookie(await request(app.getHttpServer()).post('/auth/login').send({ email: gestorEmail, password: gestorSenha }));
      const res = await simular(relogado, corpoDe(aprovada.base));
      expect(res.status).toBe(403);
    } finally {
      const restaurado = await request(app.getHttpServer())
        .put('/perfis/gestor/permissoes')
        .set('Cookie', admin)
        .send({ permissoes: atuais });
      expect(restaurado.status).toBe(200);
      gestor = joinSetCookie(await request(app.getHttpServer()).post('/auth/login').send({ email: gestorEmail, password: gestorSenha }));
    }
  });

  it('base tributável diferente do valor bruto grava a memória', async () => {
    const aprovada = await aprovarRegra(await cenario());
    const corpo = corpoDe(aprovada.base, { valor: '1.000,00', desconto: '0,00', competencia: '2026-10' });
    const res = await simular(admin, corpo);
    expect(res.status).toBe(201);
    expect(res.body.situacao).toBe('Calculada');
    expect(res.body.baseTributavel).toBe('583.30');
    expect(res.body.icms).toBe('70.00');
    expect(res.body.baseDifereBruto).toBe(true);
    const explicacao = await explicar(admin, res.body.id);
    expect(explicacao.status).toBe(200);
    expect(explicacao.body.textoBase).toContain('1.000,00');
    expect(explicacao.body.textoBase).toContain('583,30');
    expect(explicacao.body.semAliquota.find((l: { rotulo: string }) => l.rotulo === 'Tratamento IPI').texto)
      .toBe('Esta regra não guarda alíquota deste tributo; nenhum valor é calculado.');
    expect(JSON.stringify(explicacao.body.semAliquota)).not.toContain('0,00');
  });

  it('simulação não grava nota nem documento', async () => {
    const aprovada = await aprovarRegra(await cenario());
    const antes = await contarNotas();
    const regrasAntes = Number((await db().execute(sql`SELECT COUNT(*)::int AS n FROM regras_tributarias`)).rows[0].n);
    const res = await simular(admin, corpoDe(aprovada.base));
    expect(res.status).toBe(201);
    expect(await contarNotas()).toEqual(antes);
    const texto = JSON.stringify(res.body);
    expect(texto).not.toMatch(/xml|protocolo|danfe|"chave"/i);
    const regras = await db().execute(sql`SELECT COUNT(*)::int AS n FROM regras_tributarias`);
    expect(regras.rows[0]).toMatchObject({ n: regrasAntes });
  });

  it('um administrador simula sozinho', async () => {
    const aprovada = await aprovarRegra(await cenario());
    const res = await simular(admin, corpoDe(aprovada.base));
    expect(res.status).toBe(201);
  });

  it('GET detalhe devolve base 583.30, ICMS 70.00 e competência 2026-10', async () => {
    const aprovada = await aprovarRegra(await cenario());
    const criada = await simular(admin, corpoDe(aprovada.base));
    expect(criada.status).toBe(201);
    const detalhe = await request(app.getHttpServer()).get(`/fiscal/simulacoes/${criada.body.id}`).set('Cookie', admin);
    expect(detalhe.status).toBe(200);
    expect(detalhe.body.situacao).toBe('Calculada');
    expect(detalhe.body.competencia).toBe('2026-10');
    expect(detalhe.body.competenciaRotulo).toBe('Outubro de 2026');
    expect(detalhe.body.baseTributavel).toBe('583.30');
    expect(detalhe.body.icms).toBe('70.00');
  });

  it('quantidade não muda a base', async () => {
    const aprovada = await aprovarRegra(await cenario());
    const pouca = await simular(admin, corpoDe(aprovada.base, { quantidade: '1,000' }));
    const muita = await simular(admin, corpoDe(aprovada.base, { quantidade: '999,000' }));
    expect(pouca.status).toBe(201);
    expect(muita.status).toBe(201);
    expect(muita.body.baseTributavel).toBe(pouca.body.baseTributavel);
    expect(muita.body.icms).toBe(pouca.body.icms);
  });

  it('simular não abre socket HTTP', async () => {
    const aprovada = await aprovarRegra(await cenario());
    fetchSpy.mockClear();
    const res = await simular(admin, corpoDe(aprovada.base));
    expect(res.status).toBe(201);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('simular grava 1 auditoria e explicar não grava outra', async () => {
    const aprovada = await aprovarRegra(await cenario());
    const res = await simular(admin, corpoDe(aprovada.base));
    expect(res.status).toBe(201);
    const antes = await db().execute(sql`SELECT COUNT(*)::int AS n FROM auditoria WHERE tabela = 'simulacoes_fiscais' AND registro_id = ${res.body.id}::uuid`);
    expect(antes.rows[0]).toMatchObject({ n: 1 });
    const explicacao = await explicar(admin, res.body.id);
    expect(explicacao.status).toBe(200);
    const depois = await db().execute(sql`SELECT COUNT(*)::int AS n FROM auditoria WHERE tabela = 'simulacoes_fiscais' AND registro_id = ${res.body.id}::uuid`);
    expect(depois.rows[0]).toMatchObject({ n: 1 });
  });

  it('histórico não tem nome de tabela nem uuid', async () => {
    const aprovada = await aprovarRegra(await cenario());
    const res = await simular(admin, corpoDe(aprovada.base));
    expect(res.status).toBe(201);
    const historico = await request(app.getHttpServer()).get(`/fiscal/simulacoes/${res.body.id}/historico`).set('Cookie', admin);
    expect(historico.status).toBe(200);
    const texto = JSON.stringify(historico.body);
    expect(texto).not.toContain('simulacoes_fiscais');
    expect(texto).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/i);
  });

  it('busca pelo uuid da linha devolve total 0', async () => {
    const aprovada = await aprovarRegra(await cenario());
    const res = await simular(admin, corpoDe(aprovada.base));
    expect(res.status).toBe(201);
    const lista = await request(app.getHttpServer()).get('/fiscal/simulacoes').query({ search: res.body.id }).set('Cookie', admin);
    expect(lista.status).toBe(200);
    expect(lista.body.total).toBe(0);
  });

  it('POST não altera updated_at das tabelas vizinhas', async () => {
    const aprovada = await aprovarRegra(await cenario());
    const antes = await marcas(aprovada);
    const res = await simular(admin, corpoDe(aprovada.base));
    expect(res.status).toBe(201);
    expect(await marcas(aprovada)).toEqual(antes);
  });

  async function marcas(aprovada: { regraId: string; base: Awaited<ReturnType<typeof cenario>> }) {
    const ler = async (tabela: string, id: string) => {
      const linha = await db().execute(sql`SELECT updated_at::text AS updated_at FROM ${sql.raw(tabela)} WHERE id = ${id}::uuid`);
      return (linha.rows[0] as { updated_at: string } | undefined)?.updated_at ?? null;
    };
    return {
      regra: await ler('regras_tributarias', aprovada.regraId),
      enquadramento: await ler('enquadramentos_fiscais', aprovada.base.enquadramentoId),
      cfop: await ler('cfops', aprovada.base.cfopId),
      ncm: await ler('ncms', aprovada.base.ncmId),
      empresa: await ler('empresas', aprovada.base.empresaId),
      notas: (await db().execute(sql`SELECT COUNT(*)::int AS n FROM notas_fiscais`)).rows[0],
    };
  }

  it('versão nova de outro enquadramento não grava', async () => {
    const aprovada = await aprovarRegra(await cenario());
    const outra = await aprovarRegra(await cenario());
    const origem = await simular(admin, corpoDe(aprovada.base));
    expect(origem.status).toBe(201);
    const res = await request(app.getHttpServer())
      .post(`/fiscal/simulacoes/${origem.body.id}/versoes`)
      .set('Cookie', admin)
      .send({ ...corpoDe(aprovada.base), enquadramentoId: outra.base.enquadramentoId, versao: origem.body.versao });
    expect(res.status).toBe(422);
    expect(codigoDe(res.body)).toBe('LINHAGEM_ENQUADRAMENTO_FIXO');
    const n = await db().execute(sql`SELECT COUNT(*)::int AS n FROM simulacoes_fiscais WHERE codigo = ${origem.body.codigo} AND numero_versao = 2`);
    expect(n.rows[0]).toMatchObject({ n: 0 });
  });

  it('competência 2027-01 na versão nova não grava a versão 2', async () => {
    const aprovada = await aprovarRegra(await cenario({ fim: '2027-12-31' }));
    const origem = await simular(admin, corpoDe(aprovada.base));
    expect(origem.status).toBe(201);
    const res = await request(app.getHttpServer())
      .post(`/fiscal/simulacoes/${origem.body.id}/versoes`)
      .set('Cookie', admin)
      .send({ ...corpoDe(aprovada.base), competencia: '2027-01', versao: origem.body.versao });
    expect(res.status).toBe(422);
    expect(codigoDe(res.body)).toBe('FALTA_REFERENCIA_LEGAL');
    const n = await db().execute(sql`SELECT COUNT(*)::int AS n FROM simulacoes_fiscais WHERE codigo = ${origem.body.codigo} AND numero_versao = 2`);
    expect(n.rows[0]).toMatchObject({ n: 0 });
  });

  it('CSV da memória traz ICMS 70,00 e a frase do IPI sem 0,00', async () => {
    const aprovada = await aprovarRegra(await cenario());
    const criada = await simular(admin, corpoDe(aprovada.base));
    expect(criada.status).toBe(201);
    const memoria = await request(app.getHttpServer()).get(`/fiscal/simulacoes/${criada.body.id}/memoria`).set('Cookie', admin);
    expect(memoria.status).toBe(200);
    expect(memoria.headers['content-type']).toContain('text/csv');
    const csv = memoria.text;
    expect(csv.startsWith('\uFEFFCampo;Valor')).toBe(true);
    expect(csv).toContain('ICMS;70,00');
    const linhaIpi = csv.split(/\r\n/).find((linha) => linha.startsWith('Tratamento IPI;'));
    expect(linhaIpi).toContain('Esta regra não guarda alíquota deste tributo; nenhum valor é calculado.');
    expect(linhaIpi).not.toContain('0,00');
  });

  it('CSV da grade usa o nome fantasia', async () => {
    await limparSimulacoes();
    const aprovada = await aprovarRegra(await cenario());
    const criada = await simular(admin, corpoDe(aprovada.base));
    expect(criada.status).toBe(201);
    const grade = await request(app.getHttpServer()).get('/fiscal/simulacoes/exportacao').set('Cookie', admin);
    expect(grade.status).toBe(200);
    expect(grade.text.startsWith('\uFEFFCliente;Produto;Valor;Valor líquido (calculado);Estabelecimento;Operação')).toBe(true);
    expect(grade.text).toContain('Açougue Central');
  });

  it('contagens separam códigos, versões e base diferente', async () => {
    await limparSimulacoes();
    const aprovada = await aprovarRegra(await cenario());
    const criada = await simular(admin, corpoDe(aprovada.base));
    expect(criada.status).toBe(201);
    const res = await request(app.getHttpServer()).get('/fiscal/simulacoes/contagens').set('Cookie', admin);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ simulacoes: 1, versoes: 1, baseDiferente: 1 });
  });

  it('pré-condições mantêm dupla aprovação, três datas e perfis como provisórios', async () => {
    const aprovada = await aprovarRegra(await cenario());
    const criada = await simular(admin, corpoDe(aprovada.base));
    expect(criada.status).toBe(201);
    const res = await request(app.getHttpServer()).get(`/fiscal/simulacoes/${criada.body.id}/pre-condicoes`).set('Cookie', admin);
    expect(res.status).toBe(200);
    const por = Object.fromEntries((res.body as Array<{ codigo: string }>).map((item) => [item.codigo, item]));
    expect(Object.keys(por)).toEqual([
      'ENQUADRAMENTO_ATIVO',
      'REGRA_APROVADA_VIGENTE',
      'MEMORIA_SEM_DOCUMENTO',
      'DATAS_COMERCIAL_FISCAL_EFETIVA',
      'DUPLA_APROVACAO',
      'PERFIS_ALEM_ADMINISTRADOR',
    ]);
    expect(por.ENQUADRAMENTO_ATIVO).toMatchObject({ atendida: true, provisoria: false });
    expect(por.REGRA_APROVADA_VIGENTE).toMatchObject({ atendida: true, provisoria: false });
    expect(por.MEMORIA_SEM_DOCUMENTO).toMatchObject({ atendida: true, provisoria: false });
    expect(por.DATAS_COMERCIAL_FISCAL_EFETIVA).toMatchObject({ atendida: false, provisoria: true });
    expect(por.DUPLA_APROVACAO).toMatchObject({
      atendida: false,
      provisoria: true,
      texto: 'Esta tela não aprova nem publica regra. O quórum numérico permanece provisório.',
    });
    expect(por.PERFIS_ALEM_ADMINISTRADOR).toMatchObject({ atendida: false, provisoria: true });
  });

  it('histórico usa os resumos da simulação e da versão nova', async () => {
    const aprovada = await aprovarRegra(await cenario());
    const origem = await simular(admin, corpoDe(aprovada.base));
    expect(origem.status).toBe(201);
    const versao = await request(app.getHttpServer())
      .post(`/fiscal/simulacoes/${origem.body.id}/versoes`)
      .set('Cookie', admin)
      .send({ ...corpoDe(aprovada.base), desconto: '100,00', versao: origem.body.versao });
    expect(versao.status).toBe(201);
    const historico = await request(app.getHttpServer()).get(`/fiscal/simulacoes/${versao.body.id}/historico`).set('Cookie', admin);
    expect(historico.status).toBe(200);
    const resumos = (historico.body as Array<{ resumo: string }>).map((item) => item.resumo);
    expect(resumos).toContain('Simulação calculada');
    expect(resumos).toContain(`Versão nova do código ${origem.body.codigo}`);
  });

  it('consulta a regra gravada', async () => {
    const aprovada = await aprovarRegra(await cenario());
    const [regra] = await db().select({ pIcms: schema.regrasTributarias.pIcms }).from(schema.regrasTributarias).where(eq(schema.regrasTributarias.id, aprovada.regraId));
    expect(regra?.pIcms).toBe('0.1200');
  });
});
