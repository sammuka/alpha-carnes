import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { Pool } from 'pg';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { hash } from '@node-rs/argon2';
import * as schema from './schema';
import { DESCRICOES_PERMISSOES, MAPA_PERFIL_PERMISSOES } from '../common/rbac/permissoes';
import { MENUS_VISIVEIS_POR_PERFIL } from '../common/rbac/menus-canonicos';
import { modelosEtiqueta, parametros, perfis } from './schema';
import { seedCatalogoMvp } from './seed-catalogo-mvp';
import { seedRegrasDesdobramentoComercial } from './seed-regras-desdobramento-comercial';
import { seedRegrasTransformacaoTz } from './seed-regras-transformacao-tz';

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

/** As 10 chaves da v1.1 §16 exibidas em Administração / Parâmetros (decisão 25 da Onda 3). */
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
    chave: 'estoque.limiar_aprovacao_ajuste',
    descricao: 'Limiar de aprovação de ajustes de estoque',
    valorJson: {
      grupo: 'Operação',
      tipo: 'numero',
      titulo: 'Limiar de aprovação de ajustes',
      texto: 'Ajustes com |delta| acima deste valor exigem aprovação da gestão.',
      valor: 5,
      provisorio: true,
      pendencia: 'doc 04 §5.3 — valor de demonstração',
    },
  },
  {
    chave: 'estoque.tunel_congelamento',
    descricao: 'Túnel de congelamento (capacidade informativa)',
    valorJson: {
      grupo: 'Operação',
      tipo: 'info',
      titulo: 'Túnel de congelamento',
      texto: 'Capacidade nominal informativa; ocupação real pendente de modelagem.',
      capacidadeKg: 10000,
      provisorio: true,
      pendencia: 'P3',
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
    chave: 'desossa.momento_escolha_regra',
    descricao: 'Momento da escolha da regra de transformação na desossa',
    valorJson: {
      valor: 'ambos',
      opcoes: ['entrada', 'saida', 'ambos'],
      provisorio: true,
      pendencia: 'P6',
      titulo: 'Momento da escolha da regra (P6)',
      detalhe:
        'v1.1 §16.7 — escolha na entrada ou confirmação na saída; obrigatória antes de gerar produtos.',
    },
  },
  {
    chave: 'gestao.modelos_relatorio_sif',
    descricao: 'Modelos oficiais dos relatórios SIF',
    valorJson: {
      grupo: 'Operação',
      tipo: 'texto',
      titulo: 'Modelos oficiais dos relatórios SIF',
      texto:
        'Lista provisória: mapa de recebimento diário, relatório de produção/desossa, controle de expedição, relatório de perdas e destinação. Nomes e layouts provisórios — a lista oficial e os modelos exigidos pelo SIF ainda não foram entregues pelo cliente.',
      valor: 'mapa_recebimento,producao_desossa,controle_expedicao,perdas_destinacao',
      provisorio: true,
      pendencia: 'P8',
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
  {
    chave: 'faturamento.codigo_servico_atividade',
    descricao: 'Código de serviço (Atividade) na emissão EISS',
    valorJson: {
      pergunta: 'Qual o código de Atividade (LC 404/2022) usado na emissão de NFS-e?',
      texto: 'Enviado como <Atividade> no request EISS (formato "00.00"). Valor provisório até o contador confirmar.',
      valor: '14.01',
      provisorio: true,
      pendencia: 'Confirmação do contador do cliente — D10.1',
    },
  },
  {
    chave: 'faturamento.simples_nacional',
    descricao: 'Enquadramento Simples Nacional (EISS SimplesNacional)',
    valorJson: {
      pergunta: 'A AlphaCarnes é optante do Simples Nacional?',
      texto: 'Enviado como <SimplesNacional> no request EISS. Valor provisório até confirmação contábil.',
      valor: false,
      provisorio: true,
      pendencia: 'Confirmação do contador do cliente — D10.1',
    },
  },
  {
    chave: 'faturamento.modelo_fiscal',
    descricao: 'Modelo fiscal da emissão EISS (padrão ou RTC)',
    valorJson: {
      pergunta: 'A emissão deve usar o modelo padrão (Emitir) ou o modelo RTC (RTC_EmitirNFE)?',
      texto: 'Lido no momento do envio e gravado na nota emitida (notas_fiscais.modelo_fiscal).',
      valor: 'padrao',
      opcoes: ['padrao', 'rtc'],
      provisorio: true,
      pendencia: 'D10.2',
    },
  },
  {
    chave: 'faturamento.seguro_obrigatorio',
    descricao: 'Seguro confirmado é requisito obrigatório para liberação do caminhão',
    valorJson: {
      pergunta: 'A liberação do caminhão deve exigir seguro confirmado?',
      texto: 'Quando false, o requisito de seguro do checklist de liberação reporta ok=true (dispensado por parâmetro).',
      valor: true,
      provisorio: true,
      pendencia: 'D10.6',
    },
  },
  {
    chave: 'faturamento.rtc_class_trib',
    descricao: 'RTC — ClassTrib (6 dígitos)',
    valorJson: {
      pergunta: 'Qual o ClassTrib (6 dígitos) para emissão no modelo RTC?',
      texto: 'Obrigatório apenas quando faturamento.modelo_fiscal="rtc". Vazio → RTC_PARAMETROS_INCOMPLETOS.',
      valor: '',
      provisorio: true,
      pendencia: 'Obter via GET /faturamento/rtc/pesquisar-nbs — D10.2',
    },
  },
  {
    chave: 'faturamento.rtc_codigo_nbs',
    descricao: 'RTC — Código NBS (12 dígitos pontuado)',
    valorJson: {
      pergunta: 'Qual o Código NBS para emissão no modelo RTC?',
      texto: 'Obrigatório apenas quando faturamento.modelo_fiscal="rtc". Vazio → RTC_PARAMETROS_INCOMPLETOS.',
      valor: '',
      provisorio: true,
      pendencia: 'Obter via GET /faturamento/rtc/pesquisar-nbs — D10.2',
    },
  },
  {
    chave: 'faturamento.rtc_ind_operacao',
    descricao: 'RTC — IndOperacao (6 dígitos)',
    valorJson: {
      pergunta: 'Qual o IndOperacao para emissão no modelo RTC?',
      texto: 'Obrigatório apenas quando faturamento.modelo_fiscal="rtc". Vazio → RTC_PARAMETROS_INCOMPLETOS.',
      valor: '',
      provisorio: true,
      pendencia: 'D10.2',
    },
  },
  {
    chave: 'faturamento.rtc_id_local_incidencia',
    descricao: 'RTC — IdLocalIncidencia (1 dígito)',
    valorJson: {
      pergunta: 'Qual o IdLocalIncidencia para emissão no modelo RTC?',
      texto: 'Obrigatório apenas quando faturamento.modelo_fiscal="rtc". Vazio → RTC_PARAMETROS_INCOMPLETOS.',
      valor: '',
      provisorio: true,
      pendencia: 'D10.2',
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

    await seedCatalogoMvp(db);
    console.log('✅ Catálogo MVP (11 pares) semeado — Provisório P11');

    await seedRegrasDesdobramentoComercial(db);
    console.log('✅ Regras de desdobramento comercial (AD-01 BOI + identidade) semeadas');

    await seedRegrasTransformacaoTz(db);
    console.log('✅ Regras TZ A/B provisórias semeadas — P12');

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
