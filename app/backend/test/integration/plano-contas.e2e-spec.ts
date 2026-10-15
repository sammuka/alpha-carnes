import { INestApplication } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { createTestApp, cleanupDb, createTestUser } from '../helpers/test-app';
import { DRIZZLE } from '../../src/database/database.module';
import * as schema from '../../src/database/schema';
import { centrosCusto, contasContabeis, contaVersoes } from '../../src/database/schema/contabilidade-plano.schema';
import { PlanoContasService } from '../../src/modules/contabilidade/plano/plano.service';
import type { CriarContaDto } from '../../src/modules/contabilidade/plano/dto/plano.dto';

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

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get<{ db: NodePgDatabase<typeof schema> }>(DRIZZLE).db;
    const admin = await createTestUser(app, { perfil: 'administrador' });
    const [usuario] = await db.select().from(schema.usuarios).where(eq(schema.usuarios.email, admin.adminEmail));
    if (!usuario) throw new Error('admin ausente');
    adminId = usuario.id;
    userId = usuario.id;
    service = app.get(PlanoContasService);
  });

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
});
