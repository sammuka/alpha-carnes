import { INestApplication } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import request from 'supertest';
import { createTestApp, cleanupDb, createTestUser, loginCookies } from '../helpers/test-app';
import { DRIZZLE } from '../../src/database/database.module';
import * as schema from '../../src/database/schema';
import { centrosCusto, contasContabeis, contaVersoes } from '../../src/database/schema/contabilidade-plano.schema';
import { PlanoContasService } from '../../src/modules/contabilidade/plano/plano.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AuditoriaService } from '../../src/common/auditoria/auditoria.service';
import { EVENTOS } from '../../src/realtime/events/eventos';
import { ultimaVersaoDecidida } from '../../src/modules/contabilidade/plano/vigencia';
import type { CriarContaDto, EditarContaDto } from '../../src/modules/contabilidade/plano/dto/plano.dto';
import type { ContaApresentada } from '../../src/modules/contabilidade/plano/plano.service';

function dtoBase(parcial: Partial<CriarContaDto>): CriarContaDto {
  return {
    codigo: '1',
    nome: 'Caixa e bancos',
    classificacao: 'sintetica',
    natureza: 'ATIVO',
    grupo: 'Circulante',
    contaPaiCodigo: null,
    centroCodigo: 'CT1',
    vigenciaInicio: '2026-10-01',
    vigenciaFim: null,
    justificativa: 'abertura',
    ...parcial,
  };
}

describe('Plano de contas', () => {
  let app: INestApplication;
  let db: NodePgDatabase<typeof schema>;
  let adminId: string;
  let userId: string;
  let service: PlanoContasService;
  let adminCookies: string;
  let comercialCookies: string;

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get<{ db: NodePgDatabase<typeof schema> }>(DRIZZLE).db;
    const admin = await createTestUser(app, { perfil: 'administrador' });
    const comercial = await createTestUser(app, { perfil: 'comercial' });
    const [usuario] = await db.select().from(schema.usuarios).where(eq(schema.usuarios.email, admin.adminEmail));
    if (!usuario) throw new Error('admin ausente');
    adminId = usuario.id;
    userId = usuario.id;
    service = app.get(PlanoContasService);
    adminCookies = await loginCookies(app, admin.adminEmail, admin.adminPassword);
    comercialCookies = await loginCookies(app, comercial.adminEmail, comercial.adminPassword);
  });

  const srv = () => app.getHttpServer();

  beforeEach(async () => {
    await db.execute(sql`delete from conta_versoes`);
    await db.execute(sql`delete from contas_contabeis`);
    await db.execute(sql`delete from centros_custo`);
  });

  afterAll(async () => {
    await cleanupDb(app);
    await app.close();
  });

  it('recusa natureza fora do enum e vigência invertida', async () => {
    const centro = await db.insert(centrosCusto).values({ codigo: 'CT1', nome: 'Operação industrial' }).returning();
    const conta = await db.insert(contasContabeis).values({ codigo: '1' }).returning();
    const base = {
      contaId: conta[0].id,
      numero: 1,
      nome: 'Caixa',
      classificacao: 'analitica' as const,
      grupo: 'Circulante',
      centroCustoId: centro[0].id,
      situacao: 'DRAFT' as const,
      justificativa: 'teste',
      responsavelId: adminId,
    };
    await expect(db.insert(contaVersoes).values({
      ...base,
      natureza: 'OUTRA',
      vigenciaInicio: '2026-10-01',
    })).rejects.toThrow();
    await expect(db.insert(contaVersoes).values({
      ...base,
      natureza: 'ATIVO',
      vigenciaInicio: '2026-10-01',
      vigenciaFim: '2026-09-01',
    })).rejects.toThrow();
  });

  async function aprovarDireto(codigo: string) {
    await db.execute(sql`
      update conta_versoes v
         set situacao = 'APPROVED'
        from contas_contabeis c
       where v.conta_id = c.id
         and c.codigo = ${codigo}
         and v.numero = 1
    `);
  }

  it('recusa pai analítico e não grava a conta filha', async () => {
    await service.criarCentro({ codigo: 'CT1', nome: 'Operação industrial', justificativa: 'abre centro' }, userId);
    await service.criar(dtoBase({ codigo: '1', classificacao: 'sintetica', contaPaiCodigo: null }), userId);
    await aprovarDireto('1');
    await service.criar(dtoBase({ codigo: '1.1', classificacao: 'analitica', contaPaiCodigo: '1' }), userId);
    await aprovarDireto('1.1');
    await expect(service.criar(dtoBase({
      codigo: '1.1.01',
      classificacao: 'analitica',
      contaPaiCodigo: '1.1',
    }), userId)).rejects.toMatchObject({
      status: 422,
      response: { message: 'Conta pai analítica não é nível hierárquico válido' },
    });
    const lista = await service.listar({ pagina: 1, q: '1.1.01', situacao: '', ordenar: 'contaContabil', direcao: 'asc' });
    expect(lista.total).toBe(0);
  });

  it('recusa pai inexistente', async () => {
    await service.criarCentro({ codigo: 'CT9', nome: 'Administrativo', justificativa: 'abre centro' }, userId);
    await expect(service.criar(dtoBase({
      codigo: '9',
      classificacao: 'analitica',
      contaPaiCodigo: 'nao-existe',
      centroCodigo: 'CT9',
    }), userId)).rejects.toMatchObject({
      status: 422,
      response: { message: 'Conta pai não encontrada' },
    });
  });

  it('recusa pai em rascunho', async () => {
    await service.criarCentro({ codigo: 'CT1', nome: 'Operação industrial', justificativa: 'abre centro' }, userId);
    await service.criar(dtoBase({ codigo: '1', classificacao: 'sintetica', contaPaiCodigo: null }), userId);
    await expect(service.criar(dtoBase({
      codigo: '1.1',
      classificacao: 'analitica',
      contaPaiCodigo: '1',
    }), userId)).rejects.toMatchObject({
      status: 422,
      response: { message: 'Conta pai não está ativa' },
    });
  });

  it('recusa código de conta repetido', async () => {
    await service.criarCentro({ codigo: 'CT1', nome: 'Operação industrial', justificativa: 'abre centro' }, userId);
    await service.criar(dtoBase({ codigo: '1' }), userId);
    await expect(service.criar(dtoBase({ codigo: '1' }), userId)).rejects.toMatchObject({
      status: 409,
      response: { message: 'Já existe conta com este código' },
    });
  });

  it('recusa código de centro repetido', async () => {
    await service.criarCentro({ codigo: 'CT1', nome: 'Operação industrial', justificativa: 'abre centro' }, userId);
    await expect(service.criarCentro({ codigo: 'CT1', nome: 'Outro', justificativa: 'repete' }, userId)).rejects.toMatchObject({
      status: 409,
      response: { message: 'Já existe centro de custo com este código' },
    });
  });

  async function promover(codigo: string) {
    await service.revisarCompetencia(codigo, {
      numero: 1,
      vigenciaInicio: '2026-10-01',
      vigenciaFim: null,
      justificativa: 'revisa',
    }, userId);
    return service.aprovar(codigo, { numero: 1, justificativa: 'aprova' }, userId);
  }

  async function contaAprovadaSintetica() {
    await service.criarCentro({ codigo: 'CT1', nome: 'Operação industrial', justificativa: 'abre centro' }, userId);
    await service.criar(dtoBase({ codigo: '1', classificacao: 'sintetica', contaPaiCodigo: null, centroCodigo: 'CT1' }), userId);
    return promover('1');
  }

  async function contaAprovadaAnalitica() {
    const pai = await contaAprovadaSintetica();
    await service.criar(dtoBase({
      codigo: '1.1.01',
      nome: 'Caixa e bancos',
      classificacao: 'analitica',
      contaPaiCodigo: pai.codigo,
      centroCodigo: pai.centroCodigo,
    }), userId);
    return promover('1.1.01');
  }

  async function contarVersoes(codigo: string) {
    const res = await db.execute(sql`
      select count(*)::int as total
        from conta_versoes v
        join contas_contabeis c on c.id = v.conta_id
       where c.codigo = ${codigo}
         and v.deleted_at is null
    `);
    return res.rows[0].total as number;
  }

  it('não versiona conta suspensa e não nasce rascunho', async () => {
    const conta = await contaAprovadaAnalitica();
    await service.bloquear(conta.codigo, { numero: conta.numero, justificativa: 'bloqueio' }, userId);
    await expect(service.versionar(conta.codigo, {
      ...dtoBase({ codigo: conta.codigo, contaPaiCodigo: conta.contaPaiCodigo, centroCodigo: conta.centroCodigo }),
      numero: conta.numero,
      justificativa: 'tenta versionar',
    }, userId)).rejects.toMatchObject({ response: { message: 'conta desativada' }, status: 422 });
    expect(await contarVersoes(conta.codigo)).toBe(1);
  });

  it('não mapeia conta suspensa e não grava outra versão', async () => {
    const conta = await contaAprovadaAnalitica();
    await service.bloquear(conta.codigo, { numero: conta.numero, justificativa: 'bloqueio' }, userId);
    await expect(service.mapear(conta.codigo, {
      numero: conta.numero,
      centroCodigo: conta.centroCodigo,
      justificativa: 'tenta mapear',
    }, userId)).rejects.toMatchObject({ response: { message: 'conta desativada' }, status: 422 });
    expect(await contarVersoes(conta.codigo)).toBe(1);
  });

  it('não altera natureza da versão aprovada', async () => {
    const conta = await contaAprovadaAnalitica();
    await expect(service.editar(conta.codigo, { ...conta, natureza: 'PASSIVO', numero: conta.numero, justificativa: 'troca' }, userId))
      .rejects.toMatchObject({ response: { message: 'mudança de classificação após fechamento' }, status: 422 });
    expect((await service.obter(conta.codigo)).natureza).toBe('ATIVO');
  });

  it('não revisa competência sem início de vigência', async () => {
    await service.criarCentro({ codigo: 'CT1', nome: 'Operação industrial', justificativa: 'abre centro' }, userId);
    const conta = await service.criar(dtoBase({ vigenciaInicio: '2026-10-01' }), userId);
    await expect(service.revisarCompetencia(conta.codigo, {
      numero: 1,
      vigenciaInicio: '',
      vigenciaFim: null,
      justificativa: 'revisa',
    }, userId)).rejects.toMatchObject({ status: 422 });
    expect((await service.obter(conta.codigo)).situacao).toBe('DRAFT');
  });

  it('mapear conta sintética não cria tabela de lançamento', async () => {
    const conta = await contaAprovadaSintetica();
    await expect(service.mapear(conta.codigo, {
      numero: conta.numero,
      centroCodigo: conta.centroCodigo,
      justificativa: 'mapear grupo',
    }, userId)).rejects.toMatchObject({ status: 422 });
    const tabelas = await db.execute(sql`select to_regclass('public.lancamentos_contabeis') as nome`);
    expect(tabelas.rows[0].nome).toBeNull();
  });

  it('recusa ciclo na hierarquia ao versionar a conta pai', async () => {
    await service.criarCentro({ codigo: 'CT1', nome: 'Operação industrial', justificativa: 'abre centro' }, userId);
    await service.criar(dtoBase({ codigo: '1', classificacao: 'sintetica', contaPaiCodigo: null }), userId);
    await promover('1');
    await service.criar(dtoBase({ codigo: '1.1', classificacao: 'sintetica', contaPaiCodigo: '1' }), userId);
    await promover('1.1');
    const atual = await service.obter('1');
    await expect(service.versionar('1', {
      ...dtoBase({ codigo: '1', classificacao: 'sintetica', contaPaiCodigo: '1.1', centroCodigo: 'CT1' }),
      numero: atual.numero,
      justificativa: 'tenta ciclo',
    }, userId)).rejects.toMatchObject({
      status: 422,
      response: { message: 'Ciclo na hierarquia da conta' },
    });
    expect((await service.obter('1')).numero).toBe(1);
  });

  it('nega o plano a um perfil que não é administrador', async () => {
    const res = await request(srv()).get('/contabilidade/plano').set('Cookie', comercialCookies);
    expect(res.status).toBe(403);
  });

  function comoEdicao(conta: ContaApresentada, extra: Partial<EditarContaDto> = {}): EditarContaDto {
    return {
      nome: conta.nome,
      classificacao: conta.classificacao as EditarContaDto['classificacao'],
      natureza: conta.natureza as EditarContaDto['natureza'],
      grupo: conta.grupo,
      contaPaiCodigo: conta.contaPaiCodigo,
      centroCodigo: conta.centroCodigo,
      vigenciaInicio: conta.vigenciaInicio,
      vigenciaFim: conta.vigenciaFim,
      numero: conta.numero,
      justificativa: 'ajusta o rascunho',
      ...extra,
    };
  }

  it('lista centros, exporta csv e ordena a consulta', async () => {
    await service.criarCentro({ codigo: 'CT1', nome: 'Operação industrial', justificativa: 'abre centro' }, userId);
    await service.criar(dtoBase({
      codigo: '1',
      nome: 'Caixa "A";',
      vigenciaFim: '2026-12-31',
    }), userId);
    await service.criar(dtoBase({ codigo: '2', nome: 'Bancos', vigenciaFim: null }), userId);
    const centros = await service.listarCentrosAtivos();
    expect(centros.map((centro) => centro.codigo)).toEqual(['CT1']);
    const csv = await service.exportarCsv({
      pagina: 1, q: 'Caixa', situacao: 'DRAFT', ordenar: 'contaContabil', direcao: 'asc',
    });
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('"Caixa ""A"";"');
    expect(csv).toContain('2026-12-31');
    const completo = await service.exportarCsv({
      pagina: 1, q: '', situacao: '', ordenar: 'contaContabil', direcao: 'asc',
    });
    expect(completo).toContain('—');
    const consulta = { pagina: 1, q: '', situacao: '' as const, direcao: 'desc' as const };
    for (const ordenar of ['naturezaConta', 'centroCusto', 'vigenciaInicio', 'vigenciaFim'] as const) {
      const lista = await service.listar({ ...consulta, ordenar });
      expect(lista.total).toBe(2);
    }
  });

  it('executa cada ação e recusa ação desconhecida', async () => {
    await service.criarCentro({ codigo: 'CT1', nome: 'Operação industrial', justificativa: 'abre centro' }, userId);
    await service.criar(dtoBase({ codigo: '1', classificacao: 'sintetica' }), userId);
    const rascunho = await service.obter('1');
    const editada = await service.executar('editar', '1', comoEdicao(rascunho, { nome: 'Grupo editado' }), userId);
    expect(editada.nome).toBe('Grupo editado');
    await service.executar('revisar-competencia', '1', {
      numero: 1, vigenciaInicio: '2026-10-01', vigenciaFim: '2026-12-31', justificativa: 'revisa',
    }, userId);
    await service.executar('aprovar', '1', { numero: 1, justificativa: 'aprova' }, userId);
    await service.criar(dtoBase({
      codigo: '1.1', classificacao: 'analitica', contaPaiCodigo: '1',
    }), userId);
    await service.executar('revisar-competencia', '1.1', {
      numero: 1, vigenciaInicio: '2026-10-01', vigenciaFim: null, justificativa: 'revisa filha',
    }, userId);
    const filha = await service.executar('aprovar', '1.1', { numero: 1, justificativa: 'aprova filha' }, userId);
    const mapeada = await service.executar('mapear', '1.1', {
      numero: filha.numero, centroCodigo: 'CT1', justificativa: 'mapeia',
    }, userId);
    expect(mapeada.situacao).toBe('APPROVED');
    const nova = await service.executar('versionar', '1', comoEdicao(await service.obter('1'), {
      nome: 'Grupo versão 2', justificativa: 'abre versão',
    }), userId);
    expect(nova.numero).toBe(2);
    expect(nova.situacao).toBe('DRAFT');
    const bloqueada = await service.executar('bloquear', '1.1', {
      numero: filha.numero, justificativa: 'bloqueia',
    }, userId);
    expect(bloqueada.situacao).toBe('SUSPENDED');
    await expect(service.executar('inexistente' as 'editar', '1', comoEdicao(rascunho), userId))
      .rejects.toMatchObject({ status: 404 });
  });

  it('recusa edição fora do rascunho e grava a edição válida', async () => {
    const conta = await contaAprovadaAnalitica();
    await expect(service.editar(conta.codigo, comoEdicao(conta, { grupo: 'Outro grupo' }), userId))
      .rejects.toMatchObject({ status: 422 });
    await expect(service.editar(conta.codigo, comoEdicao(conta, { classificacao: 'sintetica' }), userId))
      .rejects.toMatchObject({ status: 422 });
    await service.criarCentro({ codigo: 'CT2', nome: 'Administrativo', justificativa: 'segundo centro' }, userId);
    await expect(service.editar(conta.codigo, comoEdicao(conta, { centroCodigo: 'CT2' }), userId))
      .rejects.toMatchObject({ status: 422 });
    await expect(service.editar(conta.codigo, comoEdicao(conta), userId))
      .rejects.toMatchObject({ response: { message: 'Situação não permite esta transição' }, status: 422 });
    await service.bloquear(conta.codigo, { numero: conta.numero, justificativa: 'bloqueia' }, userId);
    const suspensa = await service.obter(conta.codigo);
    await expect(service.editar(suspensa.codigo, comoEdicao(suspensa), userId))
      .rejects.toMatchObject({ response: { message: 'conta desativada' }, status: 422 });
    await service.criar(dtoBase({ codigo: '9', nome: 'Rascunho' }), userId);
    const rascunho = await service.obter('9');
    await expect(service.editar('9', comoEdicao(rascunho, { justificativa: '   ' }), userId))
      .rejects.toMatchObject({ status: 422 });
    const salva = await service.editar('9', comoEdicao(rascunho, { nome: 'Rascunho ajustado' }), userId);
    expect(salva.nome).toBe('Rascunho ajustado');
    await expect(service.editar('ausente', comoEdicao(rascunho), userId)).rejects.toMatchObject({ status: 404 });
    await expect(service.editar('9', comoEdicao(salva, { numero: 99 }), userId))
      .rejects.toMatchObject({ status: 409, response: { message: 'conflito concorrente' } });
    await db.insert(contasContabeis).values({ codigo: 'VAZIA' });
    await expect(service.editar('VAZIA', comoEdicao(rascunho, { numero: 0 }), userId))
      .rejects.toMatchObject({ status: 404 });
  });

  it('versiona conta aprovada e recusa rascunho, revisão e rejeição', async () => {
    await service.criarCentro({ codigo: 'CT1', nome: 'Operação industrial', justificativa: 'abre centro' }, userId);
    await service.criar(dtoBase({ codigo: '1', classificacao: 'sintetica' }), userId);
    await promover('1');
    await service.criar(dtoBase({ codigo: '1.1', classificacao: 'sintetica', contaPaiCodigo: '1' }), userId);
    const filha = await promover('1.1');
    const nova = await service.versionar('1.1', comoEdicao(filha, { nome: 'Filha versão 2' }), userId);
    expect(nova.numero).toBe(2);
    expect(nova.situacao).toBe('DRAFT');
    await expect(service.versionar('1.1', comoEdicao(nova), userId))
      .rejects.toMatchObject({ status: 409, response: { message: 'Versão em aberto já existe' } });
    await service.criar(dtoBase({ codigo: '3', classificacao: 'sintetica' }), userId);
    await service.revisarCompetencia('3', {
      numero: 1, vigenciaInicio: '2026-10-01', vigenciaFim: null, justificativa: 'revisa',
    }, userId);
    const emRevisao = await service.obter('3');
    await expect(service.versionar('3', comoEdicao(emRevisao), userId))
      .rejects.toMatchObject({ status: 409 });
    await db.execute(sql`
      update conta_versoes v set situacao = 'REJECTED'
        from contas_contabeis c
       where v.conta_id = c.id and c.codigo = '1' and v.deleted_at is null
    `);
    const rejeitada = await service.obter('1');
    await expect(service.versionar('1', comoEdicao(rejeitada), userId))
      .rejects.toMatchObject({ status: 422, response: { message: 'conta desativada' } });
  });

  it('recusa ciclo quando o pai aponta para um ancestral já visto', async () => {
    await service.criarCentro({ codigo: 'CT1', nome: 'Operação industrial', justificativa: 'abre centro' }, userId);
    await service.criar(dtoBase({ codigo: 'A', classificacao: 'sintetica' }), userId);
    await promover('A');
    await service.criar(dtoBase({ codigo: 'B', classificacao: 'sintetica', contaPaiCodigo: 'A' }), userId);
    await promover('B');
    await service.criar(dtoBase({ codigo: 'C', classificacao: 'sintetica', contaPaiCodigo: 'A' }), userId);
    const conta = await promover('C');
    await db.execute(sql`
      update conta_versoes v
         set conta_pai_id = (select id from contas_contabeis where codigo = 'B')
        from contas_contabeis c
       where v.conta_id = c.id and c.codigo = 'A' and v.situacao = 'APPROVED'
    `);
    await expect(service.versionar('C', comoEdicao(conta, { contaPaiCodigo: 'A' }), userId))
      .rejects.toMatchObject({ status: 422, response: { message: 'Ciclo na hierarquia da conta' } });
  });

  it('mapeia conta analítica aprovada e recusa rascunho ou centro diferente', async () => {
    const conta = await contaAprovadaAnalitica();
    const mapeada = await service.mapear(conta.codigo, {
      numero: conta.numero, centroCodigo: conta.centroCodigo, justificativa: 'mapeia',
    }, userId);
    expect(mapeada.situacao).toBe('APPROVED');
    await service.criar(dtoBase({
      codigo: '8', classificacao: 'analitica', contaPaiCodigo: '1',
    }), userId);
    const rascunho = await service.obter('8');
    await expect(service.mapear('8', {
      numero: rascunho.numero, centroCodigo: 'CT1', justificativa: 'cedo',
    }, userId)).rejects.toMatchObject({ status: 422, response: { message: 'Conta ainda não aprovada' } });
    await service.criarCentro({ codigo: 'CT2', nome: 'Administrativo', justificativa: 'segundo centro' }, userId);
    await expect(service.mapear(conta.codigo, {
      numero: conta.numero, centroCodigo: 'CT2', justificativa: 'troca centro',
    }, userId)).rejects.toMatchObject({ status: 422, response: { message: 'mudança de classificação após fechamento' } });
  });

  it('aplica lote e devolve a conta que falhou', async () => {
    await service.criarCentro({ codigo: 'CT1', nome: 'Operação industrial', justificativa: 'abre centro' }, userId);
    await service.criar(dtoBase({ codigo: '1', classificacao: 'sintetica' }), userId);
    const revisado = await service.lote({
      acao: 'revisar-competencia',
      codigos: ['1'],
      justificativa: 'revisa em lote',
      numeroPorCodigo: { '1': 1 },
    }, userId);
    expect(revisado).toHaveLength(1);
    const aprovado = await service.lote({
      acao: 'aprovar', codigos: ['1'], justificativa: 'aprova em lote', numeroPorCodigo: { '1': 1 },
    }, userId);
    expect(aprovado).toHaveLength(1);
    await service.criar(dtoBase({ codigo: '1.1', classificacao: 'analitica', contaPaiCodigo: '1' }), userId);
    await service.revisarCompetencia('1.1', {
      numero: 1, vigenciaInicio: '2026-10-01', vigenciaFim: null, justificativa: 'revisa',
    }, userId);
    await service.aprovar('1.1', { numero: 1, justificativa: 'aprova' }, userId);
    const bloqueado = await service.lote({
      acao: 'bloquear', codigos: ['1.1'], justificativa: 'bloqueia em lote', numeroPorCodigo: { '1.1': 1 },
    }, userId);
    expect(bloqueado).toHaveLength(1);
    await expect(service.lote({
      acao: 'bloquear', codigos: ['1'], justificativa: 'sem numero', numeroPorCodigo: {},
    }, userId)).rejects.toMatchObject({
      status: 422,
      response: { message: 'conflito concorrente', codigo: '1' },
    });
    await service.criar(dtoBase({ codigo: '4' }), userId);
    await expect(service.lote({
      acao: 'revisar-competencia', codigos: ['4'], justificativa: '   ', numeroPorCodigo: { '4': 1 },
    }, userId)).rejects.toMatchObject({ status: 422 });
  });

  it('valida o rascunho sem gravar e acumula as mensagens', async () => {
    await service.criarCentro({ codigo: 'CT1', nome: 'Operação industrial', justificativa: 'abre centro' }, userId);
    const ok = await service.validar(dtoBase({ codigo: '1' }), userId);
    expect(ok).toEqual({ valido: true, mensagens: [] });
    const semCentro = await service.validar(dtoBase({ codigo: '2', centroCodigo: 'NAO' }), userId);
    expect(semCentro.valido).toBe(false);
    expect(semCentro.mensagens).toContain('Centro de custo não encontrado');
    const semPai = await service.validar(dtoBase({
      codigo: '3', classificacao: 'analitica', contaPaiCodigo: null,
    }), userId);
    expect(semPai.mensagens).toContain('Conta pai não encontrada');
    await service.criar(dtoBase({ codigo: '1' }), userId);
    const repetida = await service.validar(dtoBase({ codigo: '1' }), userId);
    expect(repetida.mensagens).toContain('Já existe conta com este código');
  });

  it('consulta o histórico e os bloqueios de transição', async () => {
    await expect(service.historico('ausente')).rejects.toMatchObject({ status: 404 });
    await db.insert(contasContabeis).values({ codigo: 'SEM' });
    expect(await service.historico('SEM')).toEqual([]);
    await service.criarCentro({ codigo: 'CT1', nome: 'Operação industrial', justificativa: 'abre centro' }, userId);
    const criada = await service.criar(dtoBase({ codigo: '1' }), userId);
    const [versao] = await db.select({ id: contaVersoes.id }).from(contaVersoes)
      .innerJoin(contasContabeis, eq(contasContabeis.id, contaVersoes.contaId))
      .where(eq(contasContabeis.codigo, '1'));
    if (!versao) throw new Error('versão ausente');
    await db.insert(schema.auditoria).values({
      tabela: 'conta_versoes',
      registroId: versao.id,
      operacao: 'ACAO_MANUAL',
      usuarioId: null,
      justificativa: null,
    });
    const linhas = await service.historico('1');
    expect(linhas.some((linha) => linha.quem === '' && linha.justificativa === '')).toBe(true);
    expect(linhas.some((linha) => linha.quem !== '')).toBe(true);
    await expect(service.revisarCompetencia('1', {
      numero: criada.numero, vigenciaInicio: '2026-10-01', vigenciaFim: null, justificativa: '   ',
    }, userId)).rejects.toMatchObject({ status: 422 });
    await service.revisarCompetencia('1', {
      numero: 1, vigenciaInicio: '2026-10-01', vigenciaFim: null, justificativa: 'revisa',
    }, userId);
    await expect(service.aprovar('1', { numero: 1, justificativa: '   ' }, userId))
      .rejects.toMatchObject({ status: 422 });
    await expect(service.aprovar('1', { numero: 1, justificativa: 'aprova' }, userId)).resolves.toMatchObject({
      situacao: 'APPROVED',
    });
    await expect(service.aprovar('1', { numero: 1, justificativa: 'de novo' }, userId))
      .rejects.toMatchObject({ status: 422 });
    await expect(service.bloquear('1', { numero: 1, justificativa: '   ' }, userId))
      .rejects.toMatchObject({ status: 422 });
    await service.bloquear('1', { numero: 1, justificativa: 'bloqueia' }, userId);
    await expect(service.bloquear('1', { numero: 1, justificativa: 'outra vez' }, userId))
      .rejects.toMatchObject({ status: 409, response: { message: 'conta desativada' } });
    await expect(service.revisarCompetencia('1', {
      numero: 1, vigenciaInicio: '2026-10-01', vigenciaFim: null, justificativa: 'revisa suspensa',
    }, userId)).rejects.toMatchObject({ status: 422, response: { message: 'conta desativada' } });
    await service.criar(dtoBase({ codigo: '5' }), userId);
    await db.execute(sql`
      update conta_versoes v set situacao = 'REJECTED'
        from contas_contabeis c
       where v.conta_id = c.id and c.codigo = '5'
    `);
    await expect(service.revisarCompetencia('5', {
      numero: 1, vigenciaInicio: '2026-10-01', vigenciaFim: null, justificativa: 'reabre',
    }, userId)).resolves.toMatchObject({ situacao: 'REVIEW' });
    await service.criar(dtoBase({ codigo: '6' }), userId);
    await db.execute(sql`
      update conta_versoes v set situacao = 'APPROVED'
        from contas_contabeis c
       where v.conta_id = c.id and c.codigo = '6'
    `);
    await expect(service.revisarCompetencia('6', {
      numero: 1, vigenciaInicio: '2026-10-01', vigenciaFim: null, justificativa: 'tarde',
    }, userId)).rejects.toMatchObject({ status: 422, response: { message: 'Situação não permite esta transição' } });
    await expect(service.bloquear('5', { numero: 1, justificativa: 'nao aprovada' }, userId))
      .rejects.toMatchObject({ status: 422 });
    await expect(service.obter('ausente')).rejects.toMatchObject({ status: 404 });
  });

  it('não devolve uuid na listagem', async () => {
    const res = await request(srv()).get('/contabilidade/plano').set('Cookie', adminCookies);
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
  });

  describe('entrada HTTP inválida', () => {
    const post = (url: string, corpo: unknown) =>
      request(srv()).post(url).set('Cookie', adminCookies).send(corpo as object);
    const contasGravadas = async () =>
      Number((await db.execute(sql`select count(*)::int as total from contas_contabeis`)).rows[0].total);
    const valida = {
      codigo: '1', nome: 'Caixa', classificacao: 'sintetica', natureza: 'ATIVO', grupo: 'Circulante',
      contaPaiCodigo: null, centroCodigo: 'CT1', vigenciaInicio: '2026-10-01', vigenciaFim: null, justificativa: 'abertura',
    };

    it.each([
      ['numero não numérico', '/contabilidade/plano/1/aprovar', { numero: 'x', justificativa: 'ok' }],
      ['justificativa só de espaços', '/contabilidade/plano/1/aprovar', { numero: 1, justificativa: '   ' }],
      ['corpo vazio', '/contabilidade/plano/1/bloquear', {}],
      ['início inexistente', '/contabilidade/plano/1/revisar-competencia',
        { numero: 1, vigenciaInicio: '2026-02-31', vigenciaFim: null, justificativa: 'ok' }],
      ['mês 13', '/contabilidade/plano/1/revisar-competencia',
        { numero: 1, vigenciaInicio: '2026-13-01', vigenciaFim: null, justificativa: 'ok' }],
      ['fim inexistente', '/contabilidade/plano/1/revisar-competencia',
        { numero: 1, vigenciaInicio: '2026-10-01', vigenciaFim: '2026-04-31', justificativa: 'ok' }],
      ['criar com início inexistente', '/contabilidade/plano', { ...valida, vigenciaInicio: '2026-02-31' }],
      ['criar com mês 13', '/contabilidade/plano', { ...valida, vigenciaInicio: '2026-13-01' }],
      ['validar com fim inexistente', '/contabilidade/plano/validar', { ...valida, vigenciaFim: '2026-02-30' }],
    ])('%s responde 400 e não grava', async (_nome, url, corpo) => {
      const res = await post(url, corpo);
      expect(res.status).toBe(400);
      expect(await contasGravadas()).toBe(0);
    });

    it.each(['constructor', 'toString', '__proto__', 'hasOwnProperty'])('ação herdada %s responde 404', async (acao) => {
      expect((await post(`/contabilidade/plano/1/${acao}`, {})).status).toBe(404);
    });

    it('lote com código herdado do protótipo responde 422 conflito', async () => {
      const res = await post('/contabilidade/plano/lote', {
        acao: 'bloquear', codigos: ['constructor'], justificativa: 'ok', numeroPorCodigo: {},
      });
      expect(res.status).toBe(422);
      expect(res.body.message.message).toBe('conflito concorrente');
    });
  });

  async function contaComV2Suspensa() {
    await service.criarCentro({ codigo: 'CT1', nome: 'Operação industrial', justificativa: 'abre centro' }, userId);
    await service.criar(dtoBase({ codigo: '1', classificacao: 'sintetica' }), userId);
    const v1 = await promover('1');
    await service.versionar('1', comoEdicao(v1, { justificativa: 'abre v2' }), userId);
    await service.revisarCompetencia('1', { numero: 2, vigenciaInicio: '2026-10-01', vigenciaFim: null, justificativa: 'revisa v2' }, userId);
    await service.aprovar('1', { numero: 2, justificativa: 'aprova v2' }, userId);
    await service.bloquear('1', { numero: 2, justificativa: 'bloqueia v2' }, userId);
  }

  it('conta com v1 aprovada e v2 suspensa não é pai válido', async () => {
    await contaComV2Suspensa();
    const [conta] = await db.select().from(contasContabeis).where(eq(contasContabeis.codigo, '1'));
    expect(await ultimaVersaoDecidida(db, conta!.id)).toMatchObject({ numero: 2, situacao: 'SUSPENDED' });
    const filha = dtoBase({ codigo: '1.1', classificacao: 'analitica', contaPaiCodigo: '1' });
    await expect(service.criar(filha, userId)).rejects.toMatchObject({
      status: 422, response: { message: 'conta desativada' },
    });
    expect(await service.validar(filha, userId)).toEqual({ valido: false, mensagens: ['conta desativada'] });
    const lista = await service.listar({ pagina: 1, q: '1.1', situacao: '', ordenar: 'contaContabil', direcao: 'asc' });
    expect(lista.total).toBe(0);
  });

  it('guarda: versão nova aprovada supera a anterior como pai', async () => {
    await service.criarCentro({ codigo: 'CT1', nome: 'Operação industrial', justificativa: 'abre centro' }, userId);
    await service.criar(dtoBase({ codigo: '0', classificacao: 'sintetica' }), userId);
    await promover('0');
    await service.criar(dtoBase({ codigo: '1', classificacao: 'sintetica' }), userId);
    const v1 = await promover('1');
    await service.versionar('1', comoEdicao(v1, { classificacao: 'analitica', contaPaiCodigo: '0', justificativa: 'vira analítica' }), userId);
    await service.revisarCompetencia('1', { numero: 2, vigenciaInicio: '2026-10-01', vigenciaFim: null, justificativa: 'revisa' }, userId);
    await service.aprovar('1', { numero: 2, justificativa: 'aprova' }, userId);
    await expect(service.criar(dtoBase({ codigo: '1.1', classificacao: 'analitica', contaPaiCodigo: '1' }), userId))
      .rejects.toMatchObject({ status: 422, response: { message: 'Conta pai analítica não é nível hierárquico válido' } });
  });

  it('guarda: revisão aberta não derruba a vigência da versão aprovada', async () => {
    await service.criarCentro({ codigo: 'CT1', nome: 'Operação industrial', justificativa: 'abre centro' }, userId);
    await service.criar(dtoBase({ codigo: '1', classificacao: 'sintetica' }), userId);
    const v1 = await promover('1');
    await service.versionar('1', comoEdicao(v1, { justificativa: 'abre v2' }), userId);
    await expect(service.criar(dtoBase({ codigo: '1.1', classificacao: 'analitica', contaPaiCodigo: '1' }), userId))
      .resolves.toMatchObject({ codigo: '1.1', contaPaiCodigo: '1' });
  });

  const contarAuditoriaVersoes = async () =>
    Number((await db.execute(sql`select count(*)::int as total from auditoria where tabela = 'conta_versoes'`)).rows[0].total);

  it('editar recusa ciclo e pai próprio sem gravar', async () => {
    await service.criarCentro({ codigo: 'CT1', nome: 'Operação industrial', justificativa: 'abre centro' }, userId);
    await service.criar(dtoBase({ codigo: '1', classificacao: 'sintetica' }), userId);
    const v1 = await promover('1');
    await service.criar(dtoBase({ codigo: '2', classificacao: 'sintetica', contaPaiCodigo: '1' }), userId);
    await promover('2');
    const v2 = await service.versionar('1', comoEdicao(v1, { contaPaiCodigo: null, justificativa: 'abre v2' }), userId);
    const auditoriasAntes = await contarAuditoriaVersoes();
    for (const pai of ['2', '1']) {
      const res = await request(srv()).post('/contabilidade/plano/1/editar').set('Cookie', adminCookies)
        .send(comoEdicao(v2, { contaPaiCodigo: pai }));
      expect(res.status).toBe(422);
      expect(res.body.message.message).toBe('Ciclo na hierarquia da conta');
    }
    expect((await service.obter('1')).contaPaiCodigo).toBeNull();
    expect(await contarAuditoriaVersoes()).toBe(auditoriasAntes);
  });

  it('guarda: editar recusa pai analítico', async () => {
    const analitica = await contaAprovadaAnalitica();
    await service.criar(dtoBase({ codigo: '7', classificacao: 'sintetica' }), userId);
    const rascunho = await service.obter('7');
    await expect(service.editar('7', comoEdicao(rascunho, { contaPaiCodigo: analitica.codigo }), userId))
      .rejects.toMatchObject({ status: 422, response: { message: 'Conta pai analítica não é nível hierárquico válido' } });
  });

  it('aprovar revalida o ciclo que a hierarquia criou depois do rascunho', async () => {
    await service.criarCentro({ codigo: 'CT1', nome: 'Operação industrial', justificativa: 'abre centro' }, userId);
    await service.criar(dtoBase({ codigo: '1', classificacao: 'sintetica' }), userId);
    const v1 = await promover('1');
    await service.criar(dtoBase({ codigo: '3', classificacao: 'sintetica' }), userId);
    const t1 = await promover('3');
    await service.versionar('1', comoEdicao(v1, { contaPaiCodigo: '3', justificativa: '1 sob 3' }), userId);
    await service.revisarCompetencia('1', { numero: 2, vigenciaInicio: '2026-10-01', vigenciaFim: null, justificativa: 'revisa' }, userId);
    await service.versionar('3', comoEdicao(t1, { contaPaiCodigo: '1', justificativa: '3 sob 1' }), userId);
    await service.revisarCompetencia('3', { numero: 2, vigenciaInicio: '2026-10-01', vigenciaFim: null, justificativa: 'revisa' }, userId);
    await service.aprovar('3', { numero: 2, justificativa: 'aprova 3 sob 1' }, userId);
    await expect(service.aprovar('1', { numero: 2, justificativa: 'aprova 1 sob 3' }, userId))
      .rejects.toMatchObject({ status: 422, response: { message: 'Ciclo na hierarquia da conta' } });
    expect((await service.obter('1')).situacao).toBe('REVIEW');
  });

  it('duas aprovações cruzadas não fecham ciclo', async () => {
    await service.criarCentro({ codigo: 'CT1', nome: 'Operação industrial', justificativa: 'abre centro' }, userId);
    for (const codigo of ['A', 'B']) {
      await service.criar(dtoBase({ codigo, classificacao: 'sintetica' }), userId);
    }
    const a = await promover('A');
    const b = await promover('B');
    await service.versionar('A', comoEdicao(a, { contaPaiCodigo: 'B', justificativa: 'A sob B' }), userId);
    await service.versionar('B', comoEdicao(b, { contaPaiCodigo: 'A', justificativa: 'B sob A' }), userId);
    for (const codigo of ['A', 'B']) {
      await service.revisarCompetencia(codigo, { numero: 2, vigenciaInicio: '2026-10-01', vigenciaFim: null, justificativa: 'revisa' }, userId);
    }
    const resultado = await Promise.allSettled([
      service.aprovar('A', { numero: 2, justificativa: 'aprova A' }, userId),
      service.aprovar('B', { numero: 2, justificativa: 'aprova B' }, userId),
    ]);
    expect(resultado.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const recusada = resultado.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(recusada.reason).toMatchObject({ status: 422, response: { message: 'Ciclo na hierarquia da conta' } });
  });

  async function contaComRascunhoAberto(emRevisao = false) {
    await service.criarCentro({ codigo: 'CT1', nome: 'Operação industrial', justificativa: 'abre centro' }, userId);
    await service.criar(dtoBase({ codigo: '1', classificacao: 'sintetica' }), userId);
    const v1 = await promover('1');
    await service.versionar('1', comoEdicao(v1, { nome: 'Caixa v2', justificativa: 'abre v2' }), userId);
    if (emRevisao) {
      await service.revisarCompetencia('1', { numero: 2, vigenciaInicio: '2026-10-01', vigenciaFim: null, justificativa: 'revisa v2' }, userId);
    }
  }
  const versaoBruta = async (numero: number) =>
    (await db.execute(sql`
      select v.id, v.situacao, v.deleted_at from conta_versoes v join contas_contabeis c on c.id = v.conta_id
       where c.codigo = '1' and v.numero = ${numero}`)).rows[0] as { id: string; situacao: string; deleted_at: Date | null };

  it('bloquear com rascunho aberto descarta o rascunho e suspende a aprovada', async () => {
    await contaComRascunhoAberto();
    const res = await request(srv()).post('/contabilidade/plano/1/bloquear').set('Cookie', adminCookies)
      .send({ numero: 2, justificativa: 'encerra a conta' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ numero: 1, situacao: 'SUSPENDED' });
    expect((await versaoBruta(2)).deleted_at).not.toBeNull();
    expect((await versaoBruta(1)).situacao).toBe('SUSPENDED');
    const trilha = (await db.execute(sql`
      select operacao, justificativa, created_at from auditoria
       where tabela = 'conta_versoes'
         and created_at = (select max(created_at) from auditoria where tabela = 'conta_versoes')
       order by id`)).rows as { operacao: string; justificativa: string; created_at: Date }[];
    expect(trilha.map((linha) => linha.operacao)).toEqual(['DELETE', 'UPDATE']);
    expect(trilha[0]!.justificativa).toMatch(/^Rascunho descartado pelo bloqueio da conta\. encerra a conta$/);
  });

  it('revisão aberta também é descartada pelo bloqueio', async () => {
    await contaComRascunhoAberto(true);
    await service.bloquear('1', { numero: 2, justificativa: 'encerra' }, userId);
    expect((await versaoBruta(2)).deleted_at).not.toBeNull();
    expect((await service.obter('1')).situacao).toBe('SUSPENDED');
  });

  it('guarda: número desatualizado segue 409 e não descarta', async () => {
    await contaComRascunhoAberto();
    await expect(service.bloquear('1', { numero: 1, justificativa: 'velho' }, userId))
      .rejects.toMatchObject({ status: 409, response: { message: 'conflito concorrente' } });
    expect((await versaoBruta(2)).deleted_at).toBeNull();
    expect((await versaoBruta(1)).situacao).toBe('APPROVED');
  });

  it('falha da auditoria desfaz o descarte', async () => {
    await contaComRascunhoAberto();
    const auditoriaSvc = app.get(AuditoriaService);
    const original = auditoriaSvc.registrar.bind(auditoriaSvc);
    const espiao = jest.spyOn(auditoriaSvc, 'registrar')
      .mockImplementationOnce(original)
      .mockRejectedValueOnce(new Error('falha injetada'));
    await expect(service.bloquear('1', { numero: 2, justificativa: 'encerra' }, userId)).rejects.toThrow('falha injetada');
    espiao.mockRestore();
    expect((await versaoBruta(2)).deleted_at).toBeNull();
    expect((await versaoBruta(1)).situacao).toBe('APPROVED');
  });

  it('editar fora do rascunho recusa com transição inválida', async () => {
    await service.criarCentro({ codigo: 'CT1', nome: 'Operação industrial', justificativa: 'abre centro' }, userId);
    await service.criar(dtoBase({ codigo: '1', classificacao: 'sintetica' }), userId);
    await service.revisarCompetencia('1', { numero: 1, vigenciaInicio: '2026-10-01', vigenciaFim: null, justificativa: 'revisa' }, userId);
    const emRevisao = await service.obter('1');
    await expect(service.editar('1', comoEdicao(emRevisao), userId))
      .rejects.toMatchObject({ status: 422, response: { message: 'Situação não permite esta transição' } });
    await db.execute(sql`update conta_versoes set situacao = 'REJECTED' where deleted_at is null`);
    await expect(service.editar('1', comoEdicao(emRevisao), userId))
      .rejects.toMatchObject({ status: 422, response: { message: 'Situação não permite esta transição' } });
  });

  it('histórico rotula e ordena os acontecimentos', async () => {
    await service.criarCentro({ codigo: 'CT1', nome: 'Operação industrial', justificativa: 'abre centro' }, userId);
    await service.criar(dtoBase({ codigo: '1', classificacao: 'sintetica' }), userId);
    const v1 = await promover('1');
    const v2 = await service.versionar('1', comoEdicao(v1, { justificativa: 'abre v2' }), userId);
    await service.editar('1', comoEdicao(v2, { nome: 'Caixa v2 ajustada' }), userId);
    await service.bloquear('1', { numero: 2, justificativa: 'encerra' }, userId);
    const linhas = await service.historico('1');
    expect(linhas.map((linha) => linha.acontecimento)).toEqual([
      'Conta criada', 'Enviada para revisão', 'Aprovada', 'Nova versão criada',
      'Rascunho editado', 'Rascunho descartado', 'Bloqueada',
    ]);
  });

  it('lote emite o evento de cada conta só depois do commit', async () => {
    await service.criarCentro({ codigo: 'CT1', nome: 'Operação industrial', justificativa: 'abre centro' }, userId);
    for (const codigo of ['A', 'B']) {
      await service.criar(dtoBase({ codigo, classificacao: 'sintetica' }), userId);
      await service.revisarCompetencia(codigo, { numero: 1, vigenciaInicio: '2026-10-01', vigenciaFim: null, justificativa: 'revisa' }, userId);
    }
    const emitir = jest.spyOn(app.get(EventEmitter2), 'emit');
    await service.lote({ acao: 'aprovar', codigos: ['A', 'B'], justificativa: 'aprova em lote', numeroPorCodigo: { A: 1, B: 1 } }, userId);
    const aprovadas = emitir.mock.calls.filter(([evento]) => evento === EVENTOS.PLANO_CONTA_APROVADA);
    expect(aprovadas.map(([, payload]) => payload)).toEqual([
      { codigo: 'A', acao: 'aprovar', situacao: 'APPROVED' },
      { codigo: 'B', acao: 'aprovar', situacao: 'APPROVED' },
    ]);
    emitir.mockClear();
    await service.criar(dtoBase({ codigo: 'C', classificacao: 'sintetica' }), userId);
    await service.revisarCompetencia('C', { numero: 1, vigenciaInicio: '2026-10-01', vigenciaFim: null, justificativa: 'revisa' }, userId);
    await expect(service.lote({
      acao: 'bloquear', codigos: ['A', 'C'], justificativa: 'falha no segundo', numeroPorCodigo: { A: 1, C: 1 },
    }, userId)).rejects.toMatchObject({ status: 422 });
    expect(emitir.mock.calls.filter(([evento]) => evento === EVENTOS.PLANO_CONTA_BLOQUEADA)).toHaveLength(0);
    expect((await service.obter('A')).situacao).toBe('APPROVED');
    emitir.mockRestore();
  });

  it('lote não devolve uuid', async () => {
    await service.criarCentro({ codigo: 'CT1', nome: 'Operação industrial', justificativa: 'abre centro' }, userId);
    await service.criar(dtoBase({ codigo: 'A', classificacao: 'sintetica' }), userId);
    await service.revisarCompetencia('A', { numero: 1, vigenciaInicio: '2026-10-01', vigenciaFim: null, justificativa: 'revisa' }, userId);
    const res = await request(srv()).post('/contabilidade/plano/lote').set('Cookie', adminCookies)
      .send({ acao: 'aprovar', codigos: ['A'], justificativa: 'aprova', numeroPorCodigo: { A: 1 } });
    expect(res.status).toBe(201);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ codigo: 'A', situacao: 'APPROVED' });
    expect(JSON.stringify(res.body)).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
  });

  it('csv exporta a visão inteira, não a página', async () => {
    await service.criarCentro({ codigo: 'CT1', nome: 'Operação industrial', justificativa: 'abre centro' }, userId);
    for (let i = 1; i <= 29; i += 1) {
      await service.criar(dtoBase({ codigo: String(i).padStart(2, '0'), nome: `Conta ${i}` }), userId);
    }
    const csv = await service.exportarCsv({ pagina: 2, q: '', situacao: '', ordenar: 'contaContabil', direcao: 'asc' });
    expect(csv.replace('\uFEFF', '').split('\n')).toHaveLength(30);
    const filtrado = await service.exportarCsv({ pagina: 1, q: 'Conta 2', situacao: 'DRAFT', ordenar: 'contaContabil', direcao: 'asc' });
    expect(filtrado.replace('\uFEFF', '').split('\n')).toHaveLength(12);
  });

  it('csv neutraliza célula que começa como fórmula', async () => {
    await service.criarCentro({ codigo: 'CT1', nome: 'Operação industrial', justificativa: 'abre centro' }, userId);
    const nomes = ['=1+1', '+SUM(A1)', '-2', '@cmd', '\t=tab', '=HYPERLINK("http://x")'];
    for (const [i, nome] of nomes.entries()) {
      await service.criar(dtoBase({ codigo: `F${i}`, nome }), userId);
    }
    const csv = await service.exportarCsv({ pagina: 1, q: '', situacao: '', ordenar: 'contaContabil', direcao: 'asc' });
    const linhas = csv.replace('\uFEFF', '').split('\n');
    for (const inicio of ["'=1+1;", "'+SUM(A1);", "'-2;", "'@cmd;"]) {
      expect(linhas.some((linha) => linha.startsWith(inicio))).toBe(true);
    }
    expect(csv).toContain(`"'\t=tab"`);
    expect(csv).toContain(`"'=HYPERLINK(""http://x"")"`);
  });
});
