import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { AllExceptionsFilter } from '../../src/common/filters/all-exceptions.filter';
import { DRIZZLE } from '../../src/database/database.module';
import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../src/database/schema';
import { hash } from '@node-rs/argon2';
import { RbacService } from '../../src/modules/auth/rbac.service';
import cookieParser from 'cookie-parser';

export async function createTestApp(
  envOverrides: Record<string, string> = {},
): Promise<INestApplication> {
  // Por padrão, limite de throttle alto para não interferir nos testes gerais
  // (que fazem múltiplos logins do mesmo IP serialmente). A suíte de rate limiting
  // sobrescreve THROTTLE_LOGIN_LIMIT para um valor baixo.
  const defaults: Record<string, string> = { THROTTLE_LOGIN_LIMIT: '1000' };
  const overrides = { ...defaults, ...envOverrides };
  const previous: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(overrides)) {
    previous[k] = process.env[k];
    process.env[k] = v;
  }

  try {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    const app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
    return app;
  } finally {
    // Restaura a env para não vazar entre suítes
    for (const [k, v] of Object.entries(previous)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

/**
 * Extrai apenas os pares `nome=valor` do header set-cookie para reenvio no header Cookie.
 * Descarta atributos (Path, HttpOnly, Max-Age, SameSite) — senão o servidor interpreta
 * "Max-Age", "Path" etc. como cookies espúrios.
 */
export function joinSetCookie(res: { headers: Record<string, unknown> }): string {
  const raw = res.headers['set-cookie'];
  if (!raw) return '';
  const arr = Array.isArray(raw) ? raw : [String(raw)];
  return arr.map((c) => c.split(';')[0]).join('; ');
}

export async function cleanupDb(app: INestApplication): Promise<void> {
  const { db } = app.get<{ db: NodePgDatabase<typeof schema> }>(DRIZZLE);
  await db.execute(sql`
    TRUNCATE TABLE
      auditoria,
      conclusoes_conferencia_nfs, conclusoes_conferencia,
      notas_fiscais_fornecedor_itens, notas_fiscais_fornecedor,
      pendencias_overbooking_historico, pendencias_overbooking,
      pedidos_fornecedor_itens, pedidos_fornecedor,
      conferencias_carga, carga_itens, caminhoes_pedidos, caminhoes,
      etiquetas_impressoes, subitens, transformacoes, associacoes_peca_historico, pecas,
      ocorrencias_fornecedor_historico, ocorrencias_fornecedor,
      divergencias_recebimento, recebimentos_itens, recebimentos,
      reservas_disponibilidade, pedidos_venda_itens, pedidos_venda,
      disponibilidades_virtuais, compras_programadas_itens, compras_programadas,
      operacoes,
      regras_desdobramento_comercial, regras_transformacao_saidas, regras_transformacao,
      produtos, rotas, representantes,
      clientes, fornecedores, itens_compra, itens_comerciais, parametros,
      refresh_tokens, usuarios_perfis, perfis_permissoes, permissoes, perfis, usuarios
    RESTART IDENTITY CASCADE
  `);
}

/** Faz login e devolve o header Cookie pronto para autenticar requisições subsequentes. */
export async function loginCookies(
  app: INestApplication,
  email: string,
  password: string,
): Promise<string> {
  const { default: request } = await import('supertest');
  const res = await request(app.getHttpServer()).post('/auth/login').send({ email, password });
  return joinSetCookie(res);
}

// Os 11 perfis canônicos (slugs do CHECK em perfis). Todos são criados nos testes para
// que a gestão de perfis/permissões (ADR-008) e a vinculação usuário↔perfil funcionem.
const PERFIL_SLUGS = [
  'administrador', 'compras', 'gestor', 'comercial', 'recebimento_pesagem',
  'corte', 'expedicao', 'conferente', 'faturamento', 'logistica', 'diretoria',
] as const;

export async function createTestUser(
  app: INestApplication,
  opts: { perfil: string },
): Promise<{ adminEmail: string; adminPassword: string }> {
  const { db } = app.get<{ db: NodePgDatabase<typeof schema> }>(DRIZZLE);
  const rbacService = app.get(RbacService);

  const email = `test-${opts.perfil}-${Date.now()}-${Math.round(performance.now() * 1000)}@test.local`;
  const password = 'TestPass@123456';
  const senhaHash = await hash(password);

  // Inserir usuário
  const [usuario] = await db
    .insert(schema.usuarios)
    .values({ nome: `Test ${opts.perfil}`, email, senhaHash })
    .returning();
  if (!usuario) throw new Error('Falha ao criar usuário de teste');

  // Inserir TODOS os perfis canônicos (idempotente) — necessário para vínculos e gestão de perfis.
  for (const slug of PERFIL_SLUGS) {
    await db.insert(schema.perfis).values({ slug, nome: slug }).onConflictDoNothing();
  }

  // Inserir permissões e popular perfis_permissoes do banco (ADR-008 — fonte da verdade).
  await rbacService.ensurePermissoes();

  // Vincular usuário ao perfil
  const [perfil] = await db
    .select()
    .from(schema.perfis)
    .where(sql`${schema.perfis.slug} = ${opts.perfil}`);
  if (!perfil) throw new Error(`Perfil de teste não encontrado: ${opts.perfil}`);

  await db
    .insert(schema.usuariosPerfis)
    .values({ usuarioId: usuario.id, perfilId: perfil.id })
    .onConflictDoNothing();

  return { adminEmail: email, adminPassword: password };
}
