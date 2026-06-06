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
import * as cookieParser from 'cookie-parser';

export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.use(cookieParser());
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.init();
  return app;
}

export async function cleanupDb(app: INestApplication): Promise<void> {
  const { db } = app.get<{ db: NodePgDatabase<typeof schema> }>(DRIZZLE);
  await db.execute(sql`
    TRUNCATE TABLE auditoria, refresh_tokens, usuarios_perfis, perfis_permissoes, permissoes, perfis, usuarios
    RESTART IDENTITY CASCADE
  `);
}

export async function createTestUser(
  app: INestApplication,
  opts: { perfil: string },
): Promise<{ adminEmail: string; adminPassword: string }> {
  const { db } = app.get<{ db: NodePgDatabase<typeof schema> }>(DRIZZLE);
  const rbacService = app.get(RbacService);

  const email = `test-${opts.perfil}-${Date.now()}@test.local`;
  const password = 'TestPass@123456';
  const senhaHash = await hash(password);

  // Inserir usuário
  const [usuario] = await db
    .insert(schema.usuarios)
    .values({ nome: `Test ${opts.perfil}`, email, senhaHash })
    .returning();

  // Inserir perfil se não existir
  await db
    .insert(schema.perfis)
    .values({ slug: opts.perfil, nome: opts.perfil })
    .onConflictDoNothing();

  // Inserir permissões e mapa (via RbacService ou direto)
  await rbacService.ensurePermissoesF1();

  // Vincular usuário ao perfil
  const [perfil] = await db
    .select()
    .from(schema.perfis)
    .where(sql`${schema.perfis.slug} = ${opts.perfil}`);

  await db
    .insert(schema.usuariosPerfis)
    .values({ usuarioId: usuario.id, perfilId: perfil.id })
    .onConflictDoNothing();

  return { adminEmail: email, adminPassword: password };
}
