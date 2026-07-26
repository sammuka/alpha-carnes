import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { Pool } from 'pg';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { hash } from '@node-rs/argon2';
import * as schema from './schema';
import { DESCRICOES_PERMISSOES, MAPA_PERFIL_PERMISSOES } from '../common/rbac/permissoes';
import { MENUS_VISIVEIS_POR_PERFIL } from '../common/rbac/menus-canonicos';
import { modelosEtiqueta, parametros, perfis } from './schema';

type Db = NodePgDatabase<typeof schema>;

/**
 * Reconcilia `perfis.menus_visiveis` com a matriz de rastreabilidade v1.1.
 * Sobrescreve alterações feitas em runtime (decisão 23 da Onda 3): rodar o seed
 * sempre devolve os 11 perfis ao estado canônico.
 */
export async function seedMenusVisiveis(db: Db): Promise<void> {
  for (const [slug, menus] of Object.entries(MENUS_VISIVEIS_POR_PERFIL)) {
    await db.update(perfis).set({ menusVisiveis: menus }).where(eq(perfis.slug, slug));
  }
}

/** As 9 chaves da v1.1 §16 exibidas em Administração / Parâmetros (decisão 25 da Onda 3). */
const PARAMETROS_SEED = [
  {
    chave: 'comercial.overbooking_permitido',
    descricao: 'Permitir overbooking',
    valorJson: {
      grupo: 'Comercial',
      tipo: 'toggle',
      titulo: 'Permitir overbooking',
      texto:
        'Sim (sem limite, com confirmação). Qualquer vendedor pode realizar overbooking; o sistema solicita confirmação explícita quando a disponibilidade for insuficiente.',
      valor: true,
      provisorio: false,
      pendencia: null,
    },
  },
  {
    chave: 'comercial.prioridade_consumo',
    descricao: 'Prioridade de consumo',
    valorJson: {
      grupo: 'Comercial',
      tipo: 'info',
      titulo: 'Prioridade de consumo',
      texto:
        'Físico → Virtual → Overbooking. O consumo segue automaticamente essa ordem, sem exigir escolha manual do comercial.',
      valor: null,
      provisorio: false,
      pendencia: null,
    },
  },
  {
    chave: 'operacao.fifo_estoque',
    descricao: 'Estoque anterior sai primeiro (FIFO)',
    valorJson: {
      grupo: 'Operação',
      tipo: 'toggle',
      titulo: 'Estoque anterior sai primeiro (FIFO)',
      texto: 'Sim. O estoque físico já existente é priorizado antes do estoque virtual programado.',
      valor: true,
      provisorio: false,
      pendencia: null,
    },
  },
  {
    chave: 'operacao.cadencia_dias_semana',
    descricao: 'Cadência de geração de Operações',
    valorJson: {
      grupo: 'Operação',
      tipo: 'texto',
      titulo: 'Cadência de geração de Operações',
      texto:
        'Segunda, quarta e sexta. Dias da semana em que uma Operação é criada automaticamente (ver Gestão / Operações). Compra Programada e Pedido de Venda sempre se vinculam a uma Operação desta cadência, ou a uma extraordinária criada manualmente para datas fora do padrão. Cadência provisória — pendente de validação formal.',
      valor: '1,3,5',
      // Array consumido por POST /operacoes/gerar-cadencia (mesmo padrão da Onda 1).
      dias: [1, 3, 5],
      provisorio: true,
      pendencia: 'P1',
    },
  },
  {
    chave: 'operacao.composicao_boi_casado',
    descricao: 'Composição do boi casado (AD-01)',
    valorJson: {
      grupo: 'Operação',
      tipo: 'info',
      titulo: 'Composição do boi casado',
      texto:
        '2 TZ + 2 DT + 2 PA. Composição confirmada pelo cliente e registrada em AD-01; permanece parametrizável.',
      valor: null,
      provisorio: false,
      pendencia: null,
    },
  },
  {
    chave: 'operacao.regras_transformacao_tz',
    descricao: 'Regras de transformação do TZ',
    valorJson: {
      grupo: 'Operação',
      tipo: 'texto',
      titulo: 'Regras de transformação do TZ',
      texto:
        '2 alternativas: (A) Coxão-bola + Jacaré; (B) Coxão-bola com alcatra + Filé curto. Regra parametrizável, não fixada em código.',
      valor: '',
      provisorio: true,
      pendencia: 'P12',
    },
  },
  {
    chave: 'fiscal.seguro_integrado',
    descricao: 'Seguro integrado',
    valorJson: {
      grupo: 'Fiscal',
      tipo: 'toggle',
      titulo: 'Seguro integrado',
      texto: 'Não (manual). O controle de envio e confirmação do seguro é feito manualmente pelo faturamento.',
      valor: false,
      provisorio: false,
      pendencia: null,
    },
  },
  {
    chave: 'fiscal.emissao_fiscal',
    descricao: 'Emissão fiscal (AD-02)',
    valorJson: {
      grupo: 'Fiscal',
      tipo: 'info',
      titulo: 'Emissão fiscal',
      texto:
        'Via sistema externo: NFS-e da Prefeitura de Osasco-SP (EISS), conforme AD-02. Integração aguardando homologação.',
      valor: null,
      provisorio: false,
      pendencia: null,
    },
  },
  {
    chave: 'fiscal.expiracao_reserva_rascunho',
    descricao: 'Expiração de reserva de rascunho (AD-06)',
    valorJson: {
      grupo: 'Fiscal',
      tipo: 'info',
      titulo: 'Expiração de reserva de rascunho',
      texto:
        "Sem expiração automática (AD-06). A reserva do rascunho é liberada por remoção/cancelamento pelo vendedor ou pela ação administrativa auditada 'Liberar reserva'.",
      valor: null,
      provisorio: false,
      pendencia: null,
    },
  },
] as const;

export async function seedParametros(db: Db): Promise<void> {
  for (const p of PARAMETROS_SEED) {
    await db
      .insert(parametros)
      .values({ chave: p.chave, descricao: p.descricao, valorJson: p.valorJson })
      .onConflictDoNothing({ target: parametros.chave });
  }
}

/** Campos padrão das etiquetas — ModelosEtiqueta.tsx linhas 33–40. */
function camposEtiqueta(overrides: Record<string, boolean>): Record<string, boolean> {
  return {
    codigo: true, produto: true, peso: true, clientePedido: false, destino: true,
    origemFrigorifico: true, nfLote: true, dataHora: true, operador: true,
    caracteristicas: false, qrCode: true, codigoBarras: false,
    ...overrides,
  };
}

/** Os 6 modelos de ModelosEtiqueta.tsx linhas 44–69 (decisão 21 da Onda 3). */
const MODELOS_ETIQUETA_SEED = [
  { slug: 'peca-pedido', nome: 'Peça para Pedido', campos: camposEtiqueta({ clientePedido: true, caracteristicas: true }) },
  { slug: 'peca-estoque', nome: 'Peça para Estoque', campos: camposEtiqueta({ clientePedido: false, destino: true }) },
  { slug: 'peca-desossa', nome: 'Peça para Desossa', campos: camposEtiqueta({ clientePedido: false, caracteristicas: true }) },
  { slug: 'parte-pedido', nome: 'Parte para Pedido', campos: camposEtiqueta({ clientePedido: true, caracteristicas: true, origemFrigorifico: true }) },
  { slug: 'parte-estoque', nome: 'Parte para Estoque', campos: camposEtiqueta({ clientePedido: false }) },
  { slug: 'produto-unidade', nome: 'Produto por Unidade', campos: camposEtiqueta({ peso: false, caracteristicas: false, qrCode: false, codigoBarras: true }) },
];

export async function seedModelosEtiqueta(db: Db): Promise<void> {
  for (const m of MODELOS_ETIQUETA_SEED) {
    await db
      .insert(modelosEtiqueta)
      .values({ slug: m.slug, nome: m.nome, campos: m.campos })
      .onConflictDoNothing();
  }
}

// UUIDs fixos para entidades de sistema (estabilidade entre ambientes/re-seeds)
const PERFIS_FIXOS = [
  { id: '01960000-0000-7000-8000-000000000001', slug: 'administrador', nome: 'Administrador do Sistema' },
  { id: '01960000-0000-7000-8000-000000000002', slug: 'compras', nome: 'Comprador / Operador de Compras' },
  { id: '01960000-0000-7000-8000-000000000003', slug: 'gestor', nome: 'Gestor Comercial / Operacional' },
  { id: '01960000-0000-7000-8000-000000000004', slug: 'comercial', nome: 'Operador Comercial' },
  { id: '01960000-0000-7000-8000-000000000005', slug: 'recebimento_pesagem', nome: 'Operador de Recebimento / Pesagem' },
  { id: '01960000-0000-7000-8000-000000000006', slug: 'corte', nome: 'Operador de Corte' },
  { id: '01960000-0000-7000-8000-000000000007', slug: 'expedicao', nome: 'Operador de Expedição' },
  { id: '01960000-0000-7000-8000-000000000008', slug: 'conferente', nome: 'Conferente' },
  { id: '01960000-0000-7000-8000-000000000009', slug: 'faturamento', nome: 'Faturamento / Fiscal' },
  { id: '01960000-0000-7000-8000-000000000010', slug: 'logistica', nome: 'Logística / Liberação' },
  { id: '01960000-0000-7000-8000-000000000011', slug: 'diretoria', nome: 'Diretoria / Gestão Executiva' },
] as const;

// Catálogo de permissões e mapa perfil→permissão vêm da fonte única (common/rbac/permissoes).
// O codigo é unique; onConflictDoNothing garante idempotência sem UUIDs fixos por permissão.
const PERMISSOES_FIXAS = Object.entries(DESCRICOES_PERMISSOES).map(([codigo, descricao]) => ({
  codigo,
  descricao,
}));

const MAPA: Record<string, string[]> = MAPA_PERFIL_PERMISSOES;

export async function seed() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('❌ DATABASE_URL não definida');
    process.exit(1);
  }

  const pool = new Pool({ connectionString });
  const db = drizzle(pool, { schema });

  try {
    console.log('🌱 Iniciando seed...');

    // 1. Inserir perfis (upsert por slug)
    for (const perfil of PERFIS_FIXOS) {
      await db.insert(schema.perfis)
        .values({ id: perfil.id, slug: perfil.slug, nome: perfil.nome })
        .onConflictDoNothing();
    }
    console.log(`✅ ${PERFIS_FIXOS.length} perfis inseridos/verificados`);

    // 2. Inserir permissões
    for (const perm of PERMISSOES_FIXAS) {
      await db.insert(schema.permissoes)
        .values({ codigo: perm.codigo, descricao: perm.descricao })
        .onConflictDoNothing();
    }
    console.log(`✅ ${PERMISSOES_FIXAS.length} permissões inseridas/verificadas`);

    // 3. Inserir mapa perfis_permissoes (resolve o id da permissão por código no banco)
    const permissoesDb = await db.select().from(schema.permissoes);
    const idPorCodigo = new Map(permissoesDb.map((p) => [p.codigo, p.id]));
    for (const [slug, codigos] of Object.entries(MAPA)) {
      const perfil = PERFIS_FIXOS.find((p) => p.slug === slug);
      if (!perfil) continue;
      for (const codigo of codigos) {
        const permissaoId = idPorCodigo.get(codigo);
        if (!permissaoId) continue;
        await db.insert(schema.perfisPermissoes)
          .values({ perfilId: perfil.id, permissaoId })
          .onConflictDoNothing();
      }
    }
    console.log('✅ Mapa perfis→permissões inserido/verificado');

    await seedMenusVisiveis(db);
    await seedParametros(db);
    await seedModelosEtiqueta(db);
    console.log('✅ Menus visíveis, parâmetros e modelos de etiqueta reconciliados');

    // 4. Inserir usuário admin
    const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@alphacarnes.local';
    const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@AlphaCarnes2026!';
    const senhaHash = await hash(adminPassword);

    const adminPerfil = PERFIS_FIXOS.find((p) => p.slug === 'administrador')!;

    const [admin] = await db.insert(schema.usuarios)
      .values({ nome: 'Administrador', email: adminEmail, senhaHash })
      .onConflictDoUpdate({
        target: schema.usuarios.email,
        set: {
          nome: 'Administrador',
          senhaHash,
          ativo: true,
          deletedAt: null,
          updatedAt: new Date(),
        },
      })
      .returning();

    if (!admin) {
      throw new Error(`Falha ao verificar usuário admin: ${adminEmail}`);
    }

    await db.insert(schema.usuariosPerfis)
      .values({ usuarioId: admin.id, perfilId: adminPerfil.id })
      .onConflictDoNothing();
    console.log(`✅ Usuário admin verificado: ${adminEmail}`);

    console.log('🎉 Seed concluído com sucesso!');
  } catch (err) {
    console.error('❌ Falha no seed:', err);
    // process.exit aborta o Jest quando seed() é importado por seed.spec.ts
    if (require.main === module) process.exit(1);
    throw err;
  } finally {
    await pool.end();
  }
}

// Executar apenas quando chamado diretamente (não quando importado como módulo)
if (require.main === module) {
  seed();
}
