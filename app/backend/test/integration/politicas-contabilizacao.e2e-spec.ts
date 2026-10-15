import { INestApplication } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { createTestApp, cleanupDb, createTestUser } from '../helpers/test-app';
import { DRIZZLE } from '../../src/database/database.module';
import * as schema from '../../src/database/schema';
import { centrosCusto, contasContabeis } from '../../src/database/schema/contabilidade-plano.schema';
import {
  politicasContabilizacao,
  politicaVersoes,
  politicaSimulacoes,
} from '../../src/database/schema/contabilidade-politicas.schema';
import { PlanoContasService } from '../../src/modules/contabilidade/plano/plano.service';
import type { CriarContaDto } from '../../src/modules/contabilidade/plano/dto/plano.dto';
import { PoliticasContabilizacaoService } from '../../src/modules/contabilidade/politicas/politicas.service';
import type { ConfigurarPoliticaDto } from '../../src/modules/contabilidade/politicas/dto/politicas.dto';

function dtoConta(parcial: Partial<CriarContaDto>): CriarContaDto {
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

function dtoConfigurar(parcial: Partial<ConfigurarPoliticaDto> = {}): ConfigurarPoliticaDto {
  return {
    tipoEvento: 'LIQUIDACAO',
    competencia: '2026-10',
    contaDebitoCodigo: '1.1.01',
    contaCreditoCodigo: '2.1.01',
    centroCodigo: 'CT1',
    vigenciaInicio: '2026-10-01',
    justificativa: 'abre a regra',
    ...parcial,
  };
}

describe('Políticas de contabilização', () => {
  let app: INestApplication;
  let db: NodePgDatabase<typeof schema>;
  let adminId: string;
  let autorId: string;
  let plano: PlanoContasService;
  let service: PoliticasContabilizacaoService;

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get<{ db: NodePgDatabase<typeof schema> }>(DRIZZLE).db;
    const admin = await createTestUser(app, { perfil: 'administrador' });
    const [usuario] = await db.select().from(schema.usuarios).where(eq(schema.usuarios.email, admin.adminEmail));
    if (!usuario) throw new Error('admin ausente');
    adminId = usuario.id;
    autorId = usuario.id;
    plano = app.get(PlanoContasService);
    service = app.get(PoliticasContabilizacaoService);
  });

  beforeEach(async () => {
    await db.execute(sql`delete from politica_simulacoes`);
    await db.execute(sql`delete from politica_versoes`);
    await db.execute(sql`delete from politicas_contabilizacao`);
  });

  afterAll(async () => {
    await cleanupDb(app);
    await app.close();
  });

  async function limparPlano() {
    await db.execute(sql`delete from conta_versoes`);
    await db.execute(sql`delete from contas_contabeis`);
    await db.execute(sql`delete from centros_custo`);
  }

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

  async function prepararContasAnaliticas() {
    await limparPlano();
    await plano.criarCentro({ codigo: 'CT1', nome: 'Operação industrial', justificativa: 'abre centro' }, autorId);
    await plano.criar(dtoConta({ codigo: '1', classificacao: 'sintetica', contaPaiCodigo: null, nome: 'Ativo' }), autorId);
    await aprovarDireto('1');
    await plano.criar(dtoConta({ codigo: '1.1.01', classificacao: 'analitica', contaPaiCodigo: '1', nome: 'Caixa' }), autorId);
    await aprovarDireto('1.1.01');
    await plano.criar(dtoConta({ codigo: '2', classificacao: 'sintetica', contaPaiCodigo: null, nome: 'Passivo', natureza: 'PASSIVO' }), autorId);
    await aprovarDireto('2');
    await plano.criar(dtoConta({ codigo: '2.1.01', classificacao: 'analitica', contaPaiCodigo: '2', nome: 'Fornecedores', natureza: 'PASSIVO' }), autorId);
    await aprovarDireto('2.1.01');
  }

  async function prepararContaSinteticaAprovada(codigo: string) {
    await limparPlano();
    await plano.criarCentro({ codigo: 'CT1', nome: 'Operação industrial', justificativa: 'abre centro' }, autorId);
    await plano.criar(dtoConta({ codigo, classificacao: 'sintetica', contaPaiCodigo: null }), autorId);
    await aprovarDireto(codigo);
  }

  it('recusa tipo fora do enum, competência fora do dia 01 e simulação desbalanceada', async () => {
    const centro = await db.insert(centrosCusto).values({ codigo: 'CT1', nome: 'Operação industrial' }).returning();
    const debito = await db.insert(contasContabeis).values({ codigo: '1.1.01' }).returning();
    const credito = await db.insert(contasContabeis).values({ codigo: '2.1.01' }).returning();
    const politica = await db.insert(politicasContabilizacao).values({
      codigo: 'LIQUIDACAO-2026-10',
      tipoEvento: 'LIQUIDACAO',
      competencia: '2026-10-01',
    }).returning();
    await expect(db.insert(politicasContabilizacao).values({
      codigo: 'OUTRO-2026-10',
      tipoEvento: 'COMPRA',
      competencia: '2026-10-01',
    })).rejects.toThrow();
    await expect(db.insert(politicasContabilizacao).values({
      codigo: 'LIQUIDACAO-2026-11',
      tipoEvento: 'LIQUIDACAO',
      competencia: '2026-11-15',
    })).rejects.toThrow();
    const versao = await db.insert(politicaVersoes).values({
      politicaId: politica[0].id,
      numero: 1,
      contaDebitoId: debito[0].id,
      contaCreditoId: credito[0].id,
      centroCustoId: centro[0].id,
      vigenciaInicio: '2026-10-01',
      situacao: 'DRAFT',
      justificativa: 'abre',
      responsavelId: adminId,
    }).returning();
    await expect(db.insert(politicaSimulacoes).values({
      politicaId: politica[0].id,
      versaoNumero: versao[0].numero,
      valor: '10.00',
      debito: '10.00',
      credito: '10.01',
    })).rejects.toThrow();
  });

  it('recusa evento duplicado e não grava a segunda política', async () => {
    await prepararContasAnaliticas();
    await service.configurar(dtoConfigurar(), autorId);
    await expect(service.configurar(dtoConfigurar(), autorId)).rejects.toMatchObject({
      status: 409,
      response: { message: 'evento duplicado', codigo: 'LIQUIDACAO-2026-10' },
    });
    const lista = await service.listar({ pagina: 1, q: '', situacao: '', competencia: '', ordenar: 'competencia', direcao: 'asc' });
    expect(lista.total).toBe(1);
  });

  it('não troca o tipo de ocorrência e mantém a origem', async () => {
    await prepararContasAnaliticas();
    const politica = await service.configurar(dtoConfigurar(), autorId);
    await expect(service.editar(politica.codigo, {
      numero: 1,
      tipoEvento: 'TARIFA',
      competencia: '2026-10',
      contaDebitoCodigo: '1.1.01',
      contaCreditoCodigo: '2.1.01',
      centroCodigo: 'CT1',
      vigenciaInicio: '2026-10-01',
      justificativa: 'tenta trocar a origem',
    }, autorId)).rejects.toMatchObject({
      status: 422,
      response: { message: 'origem imutável', codigo: 'LIQUIDACAO-2026-10' },
    });
    expect((await service.obter(politica.codigo)).tipoEvento).toBe('LIQUIDACAO');
  });

  it('recusa conta sintética como mapeamento ausente', async () => {
    await prepararContaSinteticaAprovada('1');
    await expect(service.configurar(dtoConfigurar({ contaDebitoCodigo: '1' }), autorId)).rejects.toMatchObject({
      status: 422,
      response: { message: 'mapeamento ausente', codigo: 'LIQUIDACAO-2026-10' },
    });
    expect((await service.listar({ pagina: 1, q: '', situacao: '', competencia: '', ordenar: 'competencia', direcao: 'asc' })).total).toBe(0);
  });
});
