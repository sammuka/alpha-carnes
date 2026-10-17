import { INestApplication } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import request from 'supertest';
import { createTestApp, cleanupDb, createTestUser, loginCookies } from '../helpers/test-app';
import { DRIZZLE } from '../../src/database/database.module';
import * as schema from '../../src/database/schema';
import { centrosCusto, contasContabeis, contaVersoes } from '../../src/database/schema/contabilidade-plano.schema';
import { PlanoContasService } from '../../src/modules/contabilidade/plano/plano.service';
import { PoliticasContabilizacaoService } from '../../src/modules/contabilidade/politicas/politicas.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AuditoriaService } from '../../src/common/auditoria/auditoria.service';
import { EVENTOS } from '../../src/realtime/events/eventos';
import { LIMITE_OPCOES_PAI, ultimaVersaoDecidida } from '../../src/modules/contabilidade/plano/vigencia';
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
  let aprovadorId: string;
  let service: PlanoContasService;
  let adminCookies: string;
  let aprovadorCookies: string;
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
    // Segregação (AD-39): quem aprova a versão é outro administrador, nunca o autor dela.
    const aprovador = await createTestUser(app, { perfil: 'administrador' });
    const [segundo] = await db.select().from(schema.usuarios).where(eq(schema.usuarios.email, aprovador.adminEmail));
    if (!segundo) throw new Error('segundo administrador ausente');
    aprovadorId = segundo.id;
    service = app.get(PlanoContasService);
    adminCookies = await loginCookies(app, admin.adminEmail, admin.adminPassword);
    aprovadorCookies = await loginCookies(app, aprovador.adminEmail, aprovador.adminPassword);
    comercialCookies = await loginCookies(app, comercial.adminEmail, comercial.adminPassword);
  });

  const srv = () => app.getHttpServer();

  beforeEach(async () => {
    await db.execute(sql`delete from politica_simulacoes`);
    await db.execute(sql`delete from politica_versoes`);
    await db.execute(sql`delete from politicas_contabilizacao`);
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
      autorId: adminId,
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
    return service.aprovar(codigo, { numero: 1, justificativa: 'aprova' }, aprovadorId);
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

  it('a listagem devolve as contagens de em revisão e bloqueadas de todo o plano, sem o filtro da grade', async () => {
    const conta = await contaAprovadaAnalitica();
    await service.bloquear(conta.codigo, { numero: conta.numero, justificativa: 'bloqueio' }, userId);
    await service.criar(dtoBase({ codigo: '2', classificacao: 'sintetica', contaPaiCodigo: null, centroCodigo: 'CT1' }), userId);
    await service.revisarCompetencia('2', { numero: 1, vigenciaInicio: '2026-10-01', vigenciaFim: null, justificativa: 'revisa' }, userId);
    await service.criar(dtoBase({ codigo: '3', classificacao: 'sintetica', contaPaiCodigo: null, centroCodigo: 'CT1' }), userId);
    const lista = await service.listar({ pagina: 1, q: 'nada casa', situacao: 'DRAFT', ordenar: 'contaContabil', direcao: 'asc' });
    expect(lista.total).toBe(0);
    expect(lista.contagens).toEqual({ revisao: 1, suspensos: 1 });
  });

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
      numero: 1, vigenciaInicio: '2026-10-01', vigenciaFim: '2999-12-31', justificativa: 'revisa',
    }, userId);
    await service.executar('aprovar', '1', { numero: 1, justificativa: 'aprova' }, aprovadorId);
    // A vigência da filha cabe na do pai (plano D3, leitura restritiva): o pai termina em 2999-12-31.
    await service.criar(dtoBase({
      codigo: '1.1', classificacao: 'analitica', contaPaiCodigo: '1', vigenciaFim: '2999-12-31',
    }), userId);
    await service.executar('revisar-competencia', '1.1', {
      numero: 1, vigenciaInicio: '2026-10-01', vigenciaFim: '2999-12-31', justificativa: 'revisa filha',
    }, userId);
    const filha = await service.executar('aprovar', '1.1', { numero: 1, justificativa: 'aprova filha' }, aprovadorId);
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
    }, aprovadorId);
    expect(aprovado).toHaveLength(1);
    await service.criar(dtoBase({ codigo: '1.1', classificacao: 'analitica', contaPaiCodigo: '1' }), userId);
    await service.revisarCompetencia('1.1', {
      numero: 1, vigenciaInicio: '2026-10-01', vigenciaFim: null, justificativa: 'revisa',
    }, userId);
    await service.aprovar('1.1', { numero: 1, justificativa: 'aprova' }, aprovadorId);
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
    await expect(service.aprovar('1', { numero: 1, justificativa: '   ' }, aprovadorId))
      .rejects.toMatchObject({ status: 422 });
    await expect(service.aprovar('1', { numero: 1, justificativa: 'aprova' }, aprovadorId)).resolves.toMatchObject({
      situacao: 'APPROVED',
    });
    await expect(service.aprovar('1', { numero: 1, justificativa: 'de novo' }, aprovadorId))
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

  it('o endpoint de exportação devolve text/csv com o nome do arquivo e o BOM', async () => {
    const res = await request(srv()).get('/contabilidade/plano/exportar?ordenar=contaContabil&direcao=asc')
      .set('Cookie', adminCookies).buffer(true).parse((resposta, pronto) => {
        const partes: Buffer[] = [];
        resposta.on('data', (parte: Buffer) => partes.push(parte));
        resposta.on('end', () => pronto(null, Buffer.concat(partes)));
      });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toBe('attachment; filename="plano-de-contas.csv"');
    expect([...(res.body as Buffer).subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
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
        acao: 'bloquear', codigos: ['constructor'], justificativa: 'conflito', numeroPorCodigo: {},
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
    await service.aprovar('1', { numero: 2, justificativa: 'aprova v2' }, aprovadorId);
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
    await service.aprovar('1', { numero: 2, justificativa: 'aprova' }, aprovadorId);
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
    await service.aprovar('3', { numero: 2, justificativa: 'aprova 3 sob 1' }, aprovadorId);
    await expect(service.aprovar('1', { numero: 2, justificativa: 'aprova 1 sob 3' }, aprovadorId))
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
      service.aprovar('A', { numero: 2, justificativa: 'aprova A' }, aprovadorId),
      service.aprovar('B', { numero: 2, justificativa: 'aprova B' }, aprovadorId),
    ]);
    expect(resultado.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const recusada = resultado.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(recusada.reason).toMatchObject({ status: 422, response: { message: 'Ciclo na hierarquia da conta' } });
  });

  it('bloquear e aprovar compartilham o lock da hierarquia e nunca deixam filho aprovado sob pai suspenso', async () => {
    await service.criarCentro({ codigo: 'CT1', nome: 'Operação industrial', justificativa: 'abre centro' }, userId);
    await service.criar(dtoBase({ codigo: 'P', classificacao: 'sintetica' }), userId);
    await promover('P');
    await service.criar(dtoBase({ codigo: 'P.1', classificacao: 'sintetica', contaPaiCodigo: 'P' }), userId);
    await service.revisarCompetencia('P.1', { numero: 1, vigenciaInicio: '2026-10-01', vigenciaFim: null, justificativa: 'revisa' }, userId);

    // 1) bloquear espera quem segura o lock da hierarquia.
    let liberar!: () => void;
    const segura = new Promise<void>((r) => { liberar = r; });
    let preso!: () => void;
    const lockPego = new Promise<void>((r) => { preso = r; });
    const externa = db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${'contabilidade:hierarquia'}))`);
      preso();
      await segura;
    });
    await lockPego;
    let terminou = false;
    const bloqueio = service.bloquear('P', { numero: 1, justificativa: 'bloqueia pai' }, userId).then(() => { terminou = true; });
    try {
      await new Promise((r) => setTimeout(r, 400));
      expect(terminou).toBe(false);
    } finally {
      liberar();
      await externa;
    }
    await bloqueio;

    // 2) com o pai já suspenso, a aprovação do filho é recusada.
    await expect(service.aprovar('P.1', { numero: 1, justificativa: 'aprova filho' }, aprovadorId))
      .rejects.toMatchObject({ status: 422, response: { message: 'conta desativada' } });
    expect((await service.obter('P.1')).situacao).toBe('REVIEW');
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
    await service.lote({ acao: 'aprovar', codigos: ['A', 'B'], justificativa: 'aprova em lote', numeroPorCodigo: { A: 1, B: 1 } }, aprovadorId);
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
    const res = await request(srv()).post('/contabilidade/plano/lote').set('Cookie', aprovadorCookies)
      .send({ acao: 'aprovar', codigos: ['A'], justificativa: 'aprova', numeroPorCodigo: { A: 1 } });
    expect(res.status).toBe(201);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ codigo: 'A', situacao: 'APPROVED' });
    expect(JSON.stringify(res.body)).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
  });

  describe('listagem estável', () => {
    const base = { pagina: 1, q: '', situacao: '', ordenar: 'contaContabil', direcao: 'asc' } as const;

    it('pagina sem duplicar nem perder linha em empate, em cada ordenação e sentido', async () => {
      await service.criarCentro({ codigo: 'CT1', nome: 'Operação industrial', justificativa: 'abre centro' }, userId);
      for (let i = 1; i <= 100; i += 1) {
        await service.criar(dtoBase({ codigo: String(i).padStart(4, '0'), nome: 'Igual' }), userId);
      }
      // Reescreve as linhas em ordem aleatória: a ordem física deixa de coincidir com o código.
      const ids = await db.execute(sql`select id from conta_versoes order by random()`);
      for (const linha of ids.rows as { id: string }[]) {
        await db.execute(sql`update conta_versoes set justificativa = justificativa || '.' where id = ${linha.id}`);
      }
      for (const ordenar of ['contaContabil', 'naturezaConta', 'centroCusto', 'vigenciaInicio', 'vigenciaFim'] as const) {
        for (const direcao of ['asc', 'desc'] as const) {
          const codigos: string[] = [];
          let total = 0;
          for (let pagina = 1; pagina <= 5; pagina += 1) {
            const r = await service.listar({ ...base, ordenar, direcao, pagina });
            total = r.total;
            codigos.push(...r.itens.map((i) => i.codigo));
          }
          expect(total).toBe(100);
          expect(codigos).toHaveLength(100);
          expect(new Set(codigos).size).toBe(100);
          const csv = (await service.exportarCsv({ ...base, ordenar, direcao })).replace('﻿', '').split('\n');
          expect(csv).toHaveLength(101);
        }
      }
    });

    it('lista e total vêm do mesmo instante sob escrita concorrente', async () => {
      await service.criarCentro({ codigo: 'CT1', nome: 'Operação industrial', justificativa: 'abre centro' }, userId);
      await service.criar(dtoBase({ codigo: '000' }), userId);
      let gravando = true;
      const gravacao = (async () => {
        for (let i = 1; i <= 60; i += 1) await service.criar(dtoBase({ codigo: String(i).padStart(3, '0') }), userId);
        gravando = false;
      })();
      const leituras: { n: number; total: number }[] = [];
      const leitor = async () => {
        while (gravando) {
          const r = await service.listar({ ...base, pagina: 1 });
          leituras.push({ n: r.itens.length, total: r.total });
        }
      };
      await Promise.all([gravacao, leitor(), leitor(), leitor(), leitor()]);
      expect(leituras.length).toBeGreaterThan(5);
      for (const l of leituras) expect(l.n).toBe(Math.min(l.total, 20));
    });

    it('busca trata % e _ como texto literal', async () => {
      await service.criarCentro({ codigo: 'CT1', nome: 'Operação industrial', justificativa: 'abre centro' }, userId);
      await service.criar(dtoBase({ codigo: 'A1', nome: 'Caixa_100%' }), userId);
      await service.criar(dtoBase({ codigo: 'A2', nome: 'Caixa geral' }), userId);
      expect((await service.listar({ ...base, q: '%' })).total).toBe(1);
      expect((await service.listar({ ...base, q: '_' })).total).toBe(1);
      expect((await service.listar({ ...base, q: 'Caixa_100%' })).total).toBe(1);
      expect((await service.listar({ ...base, q: 'Caixa' })).total).toBe(2);
    });
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

  it('dez criações simultâneas do mesmo centro: uma grava, nove respondem 409', async () => {
    const resultados = await Promise.allSettled(
      Array.from({ length: 10 }, () => service.criarCentro({ codigo: 'CTX', nome: 'Concorrente', justificativa: 'corrida' }, userId)),
    );
    expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    for (const r of resultados.filter((x): x is PromiseRejectedResult => x.status === 'rejected')) {
      expect(r.reason).toMatchObject({ status: 409, response: { message: 'Já existe centro de custo com este código' } });
    }
    expect((await service.listarCentrosAtivos()).filter((c) => c.codigo === 'CTX')).toHaveLength(1);
  });

  describe('opções de conta pai', () => {
    const opcoes = (qs = '', cookies = adminCookies) =>
      request(srv()).get(`/contabilidade/plano/opcoes-pai${qs}`).set('Cookie', cookies);
    const codigosDe = (res: request.Response) => (res.body.itens as { codigo: string }[]).map((i) => i.codigo);
    const grade = (pagina: number, extra: { q?: string; situacao?: '' | 'DRAFT' } = {}) =>
      service.listar({ pagina, q: extra.q ?? '', situacao: extra.situacao ?? '', ordenar: 'contaContabil', direcao: 'asc' });

    async function sinteticasAprovadas(quantidade: number) {
      await service.criarCentro({ codigo: 'CT1', nome: 'Operação industrial', justificativa: 'abre centro' }, userId);
      for (let i = 1; i <= quantidade; i += 1) {
        const n = String(i).padStart(2, '0');
        await service.criar(dtoBase({ codigo: `C${n}`, nome: `Conta ${n}`, classificacao: 'sintetica' }), userId);
        await aprovarDireto(`C${n}`);
      }
    }

    it('pai fora da página 1 da grade aparece e a criação com ele funciona', async () => {
      await sinteticasAprovadas(25);
      const primeira = await grade(1);
      const segunda = await grade(2);
      expect(primeira.total).toBe(25);
      expect(primeira.itens).toHaveLength(20);
      const foraDaPagina = segunda.itens[0]!.codigo;
      expect(primeira.itens.map((i) => i.codigo)).not.toContain(foraDaPagina);

      const res = await opcoes();
      expect(res.status).toBe(200);
      expect(res.body.truncado).toBe(false);
      expect(codigosDe(res)).toHaveLength(25);
      expect(codigosDe(res)).toContain(foraDaPagina);

      const criada = await request(srv()).post('/contabilidade/plano').set('Cookie', adminCookies)
        .send(dtoBase({ codigo: 'FILHA', nome: 'Filha', classificacao: 'analitica', contaPaiCodigo: foraDaPagina }));
      expect(criada.status).toBe(201);
      expect(criada.body.contaPaiCodigo).toBe(foraDaPagina);
    });

    it('o filtro e a busca da grade não reduzem as opções', async () => {
      await sinteticasAprovadas(3);
      const filtrada = await grade(1, { q: 'zzz', situacao: 'DRAFT' });
      expect(filtrada.total).toBe(0);
      expect(codigosDe(await opcoes())).toEqual(['C01', 'C02', 'C03']);
    });

    it('pai aprovado com v2 em rascunho aparece, com o nome da versão vigente', async () => {
      await service.criarCentro({ codigo: 'CT1', nome: 'Operação industrial', justificativa: 'abre centro' }, userId);
      await service.criar(dtoBase({ codigo: '1', nome: 'Caixa e bancos', classificacao: 'sintetica' }), userId);
      const v1 = await promover('1');
      await service.versionar('1', comoEdicao(v1, { nome: 'Caixa novo', justificativa: 'abre v2' }), userId);
      expect((await opcoes()).body.itens).toEqual([{ codigo: '1', nome: 'Caixa e bancos' }]);
    });

    it('pai com v1 aprovada e v2 suspensa não aparece', async () => {
      await contaComV2Suspensa();
      const res = await opcoes();
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ itens: [], truncado: false });
    });

    it('só entram sintéticas cuja última versão decidida é aprovada, igual a ultimaVersaoDecidida', async () => {
      await contaAprovadaAnalitica();
      await service.criar(dtoBase({ codigo: '2', nome: 'Só rascunho', classificacao: 'sintetica' }), userId);
      await service.criar(dtoBase({ codigo: '3', nome: 'Com revisão aberta', classificacao: 'sintetica' }), userId);
      const v1 = await promover('3');
      await service.versionar('3', comoEdicao(v1, { justificativa: 'abre v2' }), userId);
      await service.revisarCompetencia('3', { numero: 2, vigenciaInicio: '2026-10-01', vigenciaFim: null, justificativa: 'revisa v2' }, userId);

      const esperados: string[] = [];
      for (const conta of await db.select().from(contasContabeis)) {
        const decidida = await ultimaVersaoDecidida(db, conta.id);
        if (decidida?.situacao === 'APPROVED' && decidida.classificacao === 'sintetica') esperados.push(conta.codigo);
      }
      expect(esperados.sort()).toEqual(['1', '3']);
      expect(codigosDe(await opcoes())).toEqual(esperados.sort());
    });

    it('busca por código ou nome sem caixa, e % é literal', async () => {
      await sinteticasAprovadas(3);
      expect(codigosDe(await opcoes('?q=conta%2002'))).toEqual(['C02']);
      expect(codigosDe(await opcoes('?q=c03'))).toEqual(['C03']);
      expect((await opcoes('?q=%25')).body.itens).toEqual([]);
    });

    it('passando do teto responde truncado e a busca devolve a conta fora dele', async () => {
      await sinteticasAprovadas(LIMITE_OPCOES_PAI + 1);
      const res = await opcoes();
      expect(res.body.itens).toHaveLength(LIMITE_OPCOES_PAI);
      expect(res.body.truncado).toBe(true);
      const ultima = `C${LIMITE_OPCOES_PAI + 1}`;
      expect(codigosDe(await opcoes(`?q=${ultima}`))).toEqual([ultima]);
      expect((await opcoes(`?q=${ultima}`)).body.truncado).toBe(false);
    });

    it('exige a permissão de leitura e não devolve identificador', async () => {
      await sinteticasAprovadas(2);
      expect((await opcoes('', comercialCookies)).status).toBe(403);
      expect((await request(srv()).get('/contabilidade/plano/opcoes-pai')).status).toBe(401);
      const res = await opcoes();
      for (const item of res.body.itens as object[]) expect(Object.keys(item).sort()).toEqual(['codigo', 'nome']);
      expect(JSON.stringify(res.body)).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    });
  });
  describe('Portão A r1: classificação, vigência do pai, segregação e entrada', () => {
    const NUL = String.fromCharCode(0);
    const politicas = () => app.get(PoliticasContabilizacaoService);
    const post = (url: string, corpo: unknown, cookies = adminCookies) =>
      request(srv()).post(url).set('Cookie', cookies).send(corpo as object);
    const autorDe = async (codigo: string, numero: number) =>
      ((await db.execute(sql`
        select u.email from conta_versoes v
          join contas_contabeis c on c.id = v.conta_id
          join usuarios u on u.id = v.autor_id
         where c.codigo = ${codigo} and v.numero = ${numero}`)).rows[0] as { email: string } | undefined)?.email;

    async function planoComPolitica() {
      await service.criarCentro({ codigo: 'CT1', nome: 'Operação industrial', justificativa: 'abre centro' }, userId);
      for (const [codigo, natureza] of [['1', 'ATIVO'], ['2', 'PASSIVO']] as const) {
        await service.criar(dtoBase({ codigo, classificacao: 'sintetica', natureza }), userId);
        await promover(codigo);
      }
      await service.criar(dtoBase({ codigo: '1.1.01', classificacao: 'analitica', contaPaiCodigo: '1' }), userId);
      const debito = await promover('1.1.01');
      await service.criar(dtoBase({ codigo: '2.1.01', classificacao: 'analitica', contaPaiCodigo: '2', natureza: 'PASSIVO' }), userId);
      await promover('2.1.01');
      await politicas().configurar({
        tipoEvento: 'LIQUIDACAO', competencia: '2026-10', contaDebitoCodigo: '1.1.01', contaCreditoCodigo: '2.1.01',
        centroCodigo: 'CT1', vigenciaInicio: '2026-10-01', justificativa: 'abre a regra',
      }, userId);
      return debito;
    }

    it('sintética com filha decidida não vira analítica: versionar e editar respondem 422', async () => {
      await service.criarCentro({ codigo: 'CT1', nome: 'Operação industrial', justificativa: 'abre centro' }, userId);
      await service.criar(dtoBase({ codigo: '0', classificacao: 'sintetica' }), userId);
      await promover('0');
      await service.criar(dtoBase({ codigo: '1', classificacao: 'sintetica' }), userId);
      const pai = await promover('1');
      await service.criar(dtoBase({ codigo: '1.1', classificacao: 'analitica', contaPaiCodigo: '1' }), userId);
      await promover('1.1');
      const viraAnalitica = comoEdicao(pai, { classificacao: 'analitica', contaPaiCodigo: '0', justificativa: 'vira analítica' });
      const versionar = await post('/contabilidade/plano/1/versionar', viraAnalitica);
      expect(versionar.status).toBe(422);
      expect(versionar.body.message.message).toBe('Conta com contas filhas não pode ser analítica');
      expect(await contarVersoes('1')).toBe(1);
      // editar: o rascunho v2 ainda sintético não pode ser editado para analítica.
      const v2 = await service.versionar('1', comoEdicao(pai, { nome: 'Grupo v2', justificativa: 'abre v2' }), userId);
      await expect(service.editar('1', comoEdicao(v2, { classificacao: 'analitica', contaPaiCodigo: '0' }), userId))
        .rejects.toMatchObject({ status: 422, response: { message: 'Conta com contas filhas não pode ser analítica' } });
      expect((await service.obter('1')).classificacao).toBe('sintetica');
    });

    it('aprovar recusa analítica quando a filha foi aprovada depois do rascunho', async () => {
      await service.criarCentro({ codigo: 'CT1', nome: 'Operação industrial', justificativa: 'abre centro' }, userId);
      await service.criar(dtoBase({ codigo: '0', classificacao: 'sintetica' }), userId);
      await promover('0');
      await service.criar(dtoBase({ codigo: 'X', classificacao: 'sintetica' }), userId);
      const x = await promover('X');
      await service.versionar('X', comoEdicao(x, { classificacao: 'analitica', contaPaiCodigo: '0', justificativa: 'vira analítica' }), userId);
      await service.revisarCompetencia('X', { numero: 2, vigenciaInicio: '2026-10-01', vigenciaFim: null, justificativa: 'revisa' }, userId);
      await service.criar(dtoBase({ codigo: 'X.1', classificacao: 'analitica', contaPaiCodigo: 'X' }), userId);
      await promover('X.1');
      const res = await post('/contabilidade/plano/X/aprovar', { numero: 2, justificativa: 'aprova' }, aprovadorCookies);
      expect(res.status).toBe(422);
      expect(res.body.message.message).toBe('Conta com contas filhas não pode ser analítica');
      expect((await service.obter('X')).situacao).toBe('REVIEW');
    });

    it('analítica usada por política não vira sintética; a política aprovada segue válida', async () => {
      const debito = await planoComPolitica();
      const viraSintetica = comoEdicao(debito, { classificacao: 'sintetica', justificativa: 'vira sintética' });
      const recusa = await post('/contabilidade/plano/1.1.01/versionar', viraSintetica);
      expect(recusa.status).toBe(422);
      expect(recusa.body.message.message).toBe('Conta usada em política de contabilização não pode ser sintética');
      expect(await contarVersoes('1.1.01')).toBe(1);
      // Com a política aprovada (outra pessoa aprova) a troca segue barrada; versão que não muda a classificação passa.
      await politicas().simular('LIQUIDACAO-2026-10', { numero: 1, valor: '100.00', justificativa: 'simula' }, userId);
      await politicas().aprovar('LIQUIDACAO-2026-10', { numero: 1, justificativa: 'aprova a regra' }, aprovadorId);
      expect((await post('/contabilidade/plano/1.1.01/versionar', viraSintetica)).status).toBe(422);
      const v2 = await service.versionar('1.1.01', comoEdicao(debito, { nome: 'Caixa geral', justificativa: 'renomeia' }), userId);
      await expect(service.editar('1.1.01', comoEdicao(v2, { classificacao: 'sintetica' }), userId))
        .rejects.toMatchObject({ status: 422, response: { message: 'Conta usada em política de contabilização não pode ser sintética' } });
      await service.revisarCompetencia('1.1.01', { numero: 2, vigenciaInicio: '2026-10-01', vigenciaFim: null, justificativa: 'revisa' }, userId);
      await service.aprovar('1.1.01', { numero: 2, justificativa: 'aprova v2' }, aprovadorId);
      const politica = await politicas().obter('LIQUIDACAO-2026-10');
      expect(politica).toMatchObject({ situacao: 'APPROVED', contaDebitoCodigo: '1.1.01', contaDebitoNome: 'Caixa geral' });
      await expect(politicas().simular('LIQUIDACAO-2026-10', { numero: 1, valor: '10.00', justificativa: 'simula de novo' }, userId))
        .resolves.toMatchObject({ situacao: 'APPROVED' });
    });

    it('aprovar recusa sintética quando uma política passou a usar a conta depois do rascunho', async () => {
      await service.criarCentro({ codigo: 'CT1', nome: 'Operação industrial', justificativa: 'abre centro' }, userId);
      for (const [codigo, natureza] of [['1', 'ATIVO'], ['2', 'PASSIVO']] as const) {
        await service.criar(dtoBase({ codigo, classificacao: 'sintetica', natureza }), userId);
        await promover(codigo);
      }
      await service.criar(dtoBase({ codigo: '1.1.01', classificacao: 'analitica', contaPaiCodigo: '1' }), userId);
      const debito = await promover('1.1.01');
      await service.criar(dtoBase({ codigo: '2.1.01', classificacao: 'analitica', contaPaiCodigo: '2', natureza: 'PASSIVO' }), userId);
      await promover('2.1.01');
      await service.versionar('1.1.01', comoEdicao(debito, { classificacao: 'sintetica', justificativa: 'vira sintética' }), userId);
      await service.revisarCompetencia('1.1.01', { numero: 2, vigenciaInicio: '2026-10-01', vigenciaFim: null, justificativa: 'revisa' }, userId);
      await politicas().configurar({
        tipoEvento: 'TARIFA', competencia: '2026-08', contaDebitoCodigo: '1.1.01', contaCreditoCodigo: '2.1.01',
        centroCodigo: 'CT1', vigenciaInicio: '2026-10-01', justificativa: 'abre a regra',
      }, userId);
      await expect(service.aprovar('1.1.01', { numero: 2, justificativa: 'aprova' }, aprovadorId))
        .rejects.toMatchObject({ status: 422, response: { message: 'Conta usada em política de contabilização não pode ser sintética' } });
      expect((await service.obter('1.1.01')).situacao).toBe('REVIEW');
    });

    async function paisForaDeVigencia() {
      await service.criarCentro({ codigo: 'CT1', nome: 'Operação industrial', justificativa: 'abre centro' }, userId);
      await service.criar(dtoBase({ codigo: '9', nome: 'Vencida', classificacao: 'sintetica', vigenciaInicio: '2020-01-01', vigenciaFim: '2020-12-31' }), userId);
      await aprovarDireto('9');
      await service.criar(dtoBase({ codigo: '8', nome: 'Futura', classificacao: 'sintetica', vigenciaInicio: '2099-01-01' }), userId);
      await aprovarDireto('8');
      await service.criar(dtoBase({ codigo: '7', nome: 'Vigente', classificacao: 'sintetica', vigenciaInicio: '2020-01-01' }), userId);
      await aprovarDireto('7');
    }

    it('pai vencido ou futuro não aparece em opcoes-pai e é recusado como pai (criar, validar, editar, versionar)', async () => {
      await paisForaDeVigencia();
      const opcoes = await request(srv()).get('/contabilidade/plano/opcoes-pai').set('Cookie', adminCookies);
      expect((opcoes.body.itens as { codigo: string }[]).map((i) => i.codigo)).toEqual(['7']);
      for (const pai of ['9', '8']) {
        const res = await post('/contabilidade/plano', dtoBase({ codigo: `${pai}.01`, classificacao: 'analitica', contaPaiCodigo: pai, vigenciaInicio: '2099-02-01' }));
        expect(res.status).toBe(422);
        expect(res.body.message.message).toBe('Conta pai fora de vigência');
        expect((await service.validar(dtoBase({ codigo: `${pai}.02`, classificacao: 'analitica', contaPaiCodigo: pai }), userId)).mensagens)
          .toContain('Conta pai fora de vigência');
      }
      await service.criar(dtoBase({ codigo: '7.1', classificacao: 'sintetica', contaPaiCodigo: '7' }), userId);
      const rascunho = await service.obter('7.1');
      await expect(service.editar('7.1', comoEdicao(rascunho, { contaPaiCodigo: '9' }), userId))
        .rejects.toMatchObject({ status: 422, response: { message: 'Conta pai fora de vigência' } });
      const aprovada = await promover('7.1');
      await expect(service.versionar('7.1', comoEdicao(aprovada, { contaPaiCodigo: '8', justificativa: 'muda pai' }), userId))
        .rejects.toMatchObject({ status: 422, response: { message: 'Conta pai fora de vigência' } });
      expect(await contarVersoes('7.1')).toBe(1);
    });

    it('aprovar recusa quando o pai saiu de vigência depois do rascunho', async () => {
      await paisForaDeVigencia();
      await service.criar(dtoBase({ codigo: '7.1', classificacao: 'analitica', contaPaiCodigo: '7' }), userId);
      await service.revisarCompetencia('7.1', { numero: 1, vigenciaInicio: '2026-10-01', vigenciaFim: null, justificativa: 'revisa' }, userId);
      await db.execute(sql`
        update conta_versoes v set vigencia_inicio = '2019-01-01', vigencia_fim = '2019-12-31'
          from contas_contabeis c where v.conta_id = c.id and c.codigo = '7'`);
      await expect(service.aprovar('7.1', { numero: 1, justificativa: 'aprova' }, aprovadorId))
        .rejects.toMatchObject({ status: 422, response: { message: 'Conta pai fora de vigência' } });
    });

    it('a vigência da filha cabe inteira na do pai', async () => {
      await service.criarCentro({ codigo: 'CT1', nome: 'Operação industrial', justificativa: 'abre centro' }, userId);
      await service.criar(dtoBase({ codigo: 'P', classificacao: 'sintetica', vigenciaInicio: '2020-01-01', vigenciaFim: '2999-12-31' }), userId);
      await aprovarDireto('P');
      const fora = 'Vigência da conta fora da vigência da conta pai';
      for (const [inicio, fim] of [['2019-12-31', '2999-12-31'], ['2026-10-01', null], ['2026-10-01', '3000-01-01']] as const) {
        await expect(service.criar(dtoBase({ codigo: 'P.1', contaPaiCodigo: 'P', vigenciaInicio: inicio, vigenciaFim: fim }), userId))
          .rejects.toMatchObject({ status: 422, response: { message: fora } });
      }
      await expect(service.criar(dtoBase({ codigo: 'P.1', contaPaiCodigo: 'P', vigenciaInicio: '2020-01-01', vigenciaFim: '2999-12-31' }), userId))
        .resolves.toMatchObject({ codigo: 'P.1', contaPaiCodigo: 'P' });
      // revisar-competencia que estica a filha para fora do pai é barrado na aprovação.
      await service.revisarCompetencia('P.1', { numero: 1, vigenciaInicio: '2026-10-01', vigenciaFim: null, justificativa: 'estica' }, userId);
      await expect(service.aprovar('P.1', { numero: 1, justificativa: 'aprova' }, aprovadorId))
        .rejects.toMatchObject({ status: 422, response: { message: fora } });
    });

    it('autor aprovando a própria versão responde 422 SEGREGACAO_FUNCAO, individual e em lote', async () => {
      await service.criarCentro({ codigo: 'CT1', nome: 'Operação industrial', justificativa: 'abre centro' }, userId);
      for (const codigo of ['A', 'B']) {
        await service.criar(dtoBase({ codigo, classificacao: 'sintetica' }), userId);
        await service.revisarCompetencia(codigo, { numero: 1, vigenciaInicio: '2026-10-01', vigenciaFim: null, justificativa: 'revisa' }, userId);
      }
      const individual = await post('/contabilidade/plano/A/aprovar', { numero: 1, justificativa: 'autoaprova' });
      expect(individual.status).toBe(422);
      expect(individual.body.message).toMatchObject({
        codigo: 'SEGREGACAO_FUNCAO',
        message: 'A aprovação deve ser feita por usuário diferente do autor da conta.',
      });
      const lote = await post('/contabilidade/plano/lote', { acao: 'aprovar', codigos: ['A', 'B'], justificativa: 'autoaprova', numeroPorCodigo: { A: 1, B: 1 } });
      expect(lote.status).toBe(422);
      expect(lote.body.message).toMatchObject({ codigo: 'A', erro: 'SEGREGACAO_FUNCAO' });
      expect((await service.obter('A')).situacao).toBe('REVIEW');
      expect((await service.obter('B')).situacao).toBe('REVIEW');
      const outro = await post('/contabilidade/plano/lote', { acao: 'aprovar', codigos: ['A', 'B'], justificativa: 'outro aprova', numeroPorCodigo: { A: 1, B: 1 } }, aprovadorCookies);
      expect(outro.status).toBe(201);
      expect((outro.body as { situacao: string }[]).map((c) => c.situacao)).toEqual(['APPROVED', 'APPROVED']);
    });

    it('outro administrador aprova (201); o autor fica preservado após revisar e a versão nova tem o próprio autor', async () => {
      const [admin] = await db.select().from(schema.usuarios).where(eq(schema.usuarios.id, userId));
      const [segundo] = await db.select().from(schema.usuarios).where(eq(schema.usuarios.id, aprovadorId));
      await service.criarCentro({ codigo: 'CT1', nome: 'Operação industrial', justificativa: 'abre centro' }, userId);
      await service.criar(dtoBase({ codigo: '1', classificacao: 'sintetica' }), userId);
      // Quem revisou sem ser o autor pode aprovar (mesma regra da AD-25): o segundo administrador revisa e aprova.
      await service.revisarCompetencia('1', { numero: 1, vigenciaInicio: '2026-10-01', vigenciaFim: null, justificativa: 'revisa' }, aprovadorId);
      expect(await autorDe('1', 1)).toBe(admin!.email);
      const aprovada = await post('/contabilidade/plano/1/aprovar', { numero: 1, justificativa: 'outro aprova' }, aprovadorCookies);
      expect(aprovada.status).toBe(201);
      expect(aprovada.body).toMatchObject({ situacao: 'APPROVED' });
      expect(await autorDe('1', 1)).toBe(admin!.email);
      // Versão nova aberta pelo segundo administrador: ele é o autor dela e não a aprova; o primeiro, que editou, aprova.
      await service.versionar('1', comoEdicao(await service.obter('1'), { nome: 'Caixa v2', justificativa: 'abre v2' }), aprovadorId);
      await service.editar('1', comoEdicao(await service.obter('1'), { nome: 'Caixa v2 ajustada' }), userId);
      expect(await autorDe('1', 2)).toBe(segundo!.email);
      await service.revisarCompetencia('1', { numero: 2, vigenciaInicio: '2026-10-01', vigenciaFim: null, justificativa: 'revisa v2' }, userId);
      await expect(service.aprovar('1', { numero: 2, justificativa: 'autoaprova' }, aprovadorId))
        .rejects.toMatchObject({ status: 422, response: { codigo: 'SEGREGACAO_FUNCAO' } });
      await expect(service.aprovar('1', { numero: 2, justificativa: 'quem editou aprova' }, userId))
        .resolves.toMatchObject({ situacao: 'APPROVED', numero: 2 });
      expect(await autorDe('1', 2)).toBe(segundo!.email);
    });

    it('revisar-competencia com fim antes do início responde 400 e não grava', async () => {
      await service.criarCentro({ codigo: 'CT1', nome: 'Operação industrial', justificativa: 'abre centro' }, userId);
      await service.criar(dtoBase({ codigo: 'P1' }), userId);
      const res = await post('/contabilidade/plano/P1/revisar-competencia', {
        numero: 1, vigenciaInicio: '2026-10-01', vigenciaFim: '2026-09-01', justificativa: 'revisa',
      });
      expect(res.status).toBe(400);
      expect(res.body.message.errors[0].path).toEqual(['vigenciaFim']);
      expect((await service.obter('P1')).situacao).toBe('DRAFT');
      // O lote não recebe vigência (usa a gravada): campos a mais são descartados e nunca chegam ao CHECK.
      const lote = await post('/contabilidade/plano/lote', {
        acao: 'revisar-competencia', codigos: ['P1'], justificativa: 'revisa em lote', numeroPorCodigo: { P1: 1 },
        vigenciaInicio: '2026-10-01', vigenciaFim: '2026-09-01',
      });
      expect(lote.status).toBe(201);
      expect(lote.body[0]).toMatchObject({ vigenciaInicio: '2026-10-01', vigenciaFim: null, situacao: 'REVIEW' });
    });

    it('situação diferente de Rascunho no criar responde 422 e não grava', async () => {
      await service.criarCentro({ codigo: 'CT1', nome: 'Operação industrial', justificativa: 'abre centro' }, userId);
      const res = await post('/contabilidade/plano', { ...dtoBase({ codigo: 'S1' }), situacao: 'APPROVED' });
      expect(res.status).toBe(422);
      expect(await contarVersoes('S1')).toBe(0);
      expect((await post('/contabilidade/plano', { ...dtoBase({ codigo: 'S2' }), situacao: 'DRAFT' })).status).toBe(201);
    });

    it.each([
      ['código "."', { codigo: '.' }],
      ['código ".."', { codigo: '..' }],
      ['código com espaço de largura zero', { codigo: `1${String.fromCharCode(0x200b)}` }],
      ['código com ponto no fim', { codigo: '1.' }],
      ['código com pontos repetidos', { codigo: '1..1' }],
      ['código com NUL', { codigo: `1${String.fromCharCode(0)}` }],
      ['nome com NUL', { nome: `Caixa${String.fromCharCode(0)}` }],
      ['grupo com NUL', { grupo: `Circulante${String.fromCharCode(0)}` }],
      ['justificativa com NUL', { justificativa: `abertura${String.fromCharCode(0)}` }],
      ['justificativa só de espaço de largura zero', { justificativa: String.fromCharCode(0x200b).repeat(5) }],
      ['justificativa com dois caracteres visíveis', { justificativa: ' ok ' }],
    ])('%s responde 400 e não grava', async (_nome, extra) => {
      await service.criarCentro({ codigo: 'CT1', nome: 'Operação industrial', justificativa: 'abre centro' }, userId);
      const res = await post('/contabilidade/plano', { ...dtoBase({ codigo: 'OK1' }), ...extra });
      expect(res.status).toBe(400);
      expect(Number((await db.execute(sql`select count(*)::int as total from contas_contabeis`)).rows[0].total)).toBe(0);
    });

    it('NUL no centro, na busca e no caminho responde 400 (nunca 500)', async () => {
      expect((await post('/contabilidade/centros-custo', { codigo: 'C1', nome: `Centro${NUL}`, justificativa: 'abre centro' })).status).toBe(400);
      const busca = encodeURIComponent(`a${NUL}`);
      for (const url of [`/contabilidade/plano?q=${busca}`, `/contabilidade/plano/opcoes-pai?q=${busca}`, `/contabilidade/plano/exportar?q=${busca}`, `/contabilidade/plano/${busca}/historico`]) {
        expect((await request(srv()).get(url).set('Cookie', adminCookies)).status).toBe(400);
      }
      expect((await post(`/contabilidade/plano/${busca}/aprovar`, { numero: 1, justificativa: 'aprova' })).status).toBe(400);
    });

    it('justificativa com espaço de largura zero nas pontas é aparada e gravada', async () => {
      const zw = String.fromCharCode(0x200b);
      const res = await post('/contabilidade/centros-custo', { codigo: 'C1', nome: 'Centro', justificativa: `${zw}abre centro${zw}` });
      expect(res.status).toBe(201);
      const [linha] = (await db.execute(sql`select justificativa from auditoria where tabela = 'centros_custo' order by created_at desc limit 1`)).rows as { justificativa: string }[];
      expect(linha!.justificativa).toBe('abre centro');
    });
  });
});
