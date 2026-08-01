import * as fs from 'fs';
import * as path from 'path';
import type { PoolClient } from 'pg';
import {
  BACKEND_DIR,
  MIGRATIONS_DIR,
  WORKTREE_ROOT,
  aplicarTagsOnda4,
  closeOnda4Pool,
  columnExists,
  inOnda4Transaction,
  indexExists,
  markDrizzleThrough,
  migrateOnda4WithDrizzle,
  migrarAteOnda4,
  migrationStatements,
  onda4Pool,
  resetOnda4Database,
  runDrizzleKit,
  runOnda4Seed,
  tableExists,
} from '../helpers/onda4-migrations';

const O4_TABLES = [
  'adendos_pedido',
  'tabelas_preco',
  'tabelas_preco_itens',
  'tabelas_preco_publicacoes',
] as const;

async function insertRoute(
  code: string,
  name: string,
  deleted = false,
): Promise<string> {
  const { rows } = await (await onda4Pool()).query<{ id: string }>(
    `INSERT INTO rotas (codigo, nome, deleted_at)
     VALUES ($1, $2, CASE WHEN $3 THEN now() ELSE NULL END)
     RETURNING id`,
    [code, name, deleted],
  );
  return rows[0]!.id;
}

async function insertLegacyClient(
  suffix: string,
  legacyRoute: string,
  deleted = false,
): Promise<string> {
  const { rows } = await (await onda4Pool()).query<{ id: string }>(
    `INSERT INTO clientes
       (codigo, razao_social, documento_fiscal, status, rota_padrao, deleted_at)
     VALUES ($1, $2, $3, 'ativo', $4, CASE WHEN $5 THEN now() ELSE NULL END)
     RETURNING id`,
    [
      `CLI-${suffix}`,
      `Cliente ${suffix}`,
      `DOC-${suffix}`,
      legacyRoute,
      deleted,
    ],
  );
  return rows[0]!.id;
}

async function clientRoute(
  id: string,
): Promise<{ rota_id: string | null; rota_padrao?: string }> {
  const legacyExists = await columnExists('clientes', 'rota_padrao');
  const projection = legacyExists
    ? 'rota_id, rota_padrao'
    : 'rota_id';
  const { rows } = await (await onda4Pool()).query<{
    rota_id: string | null;
    rota_padrao?: string;
  }>(`SELECT ${projection} FROM clientes WHERE id = $1`, [id]);
  return rows[0]!;
}

async function expectFinalStructure(): Promise<void> {
  for (const table of O4_TABLES) {
    expect(await tableExists(table)).toBe(true);
  }
  expect(await columnExists('clientes', 'rota_id')).toBe(true);
  expect(await columnExists('clientes', 'rota_padrao')).toBe(false);
  expect(await indexExists('idx_clientes_rota')).toBe(true);
}

async function executeSqlFile(
  client: PoolClient,
  filePath: string,
): Promise<void> {
  const statements = fs.readFileSync(filePath, 'utf8')
    .split('--> statement-breakpoint')
    .map((statement) => statement.trim())
    .filter(Boolean);
  for (const statement of statements) {
    await client.query(statement);
  }
}

describe('Onda 4 — migrations geradas D36', () => {
  afterAll(async () => {
    await closeOnda4Pool();
  });

  it('0017 faz backfill deterministico e idempotente sem inventar rota', async () => {
    await migrarAteOnda4('0016_onda4_comercial_expand');

    const codeRouteId = await insertRoute('COD-EXATO', 'Rota código');
    const uniqueNameRouteId = await insertRoute('NOME-01', 'Nome único');
    const collisionCodeRouteId = await insertRoute(
      'COLISAO',
      'Destino por código',
    );
    await insertRoute('COLISAO-NOME', 'COLISAO');
    await insertRoute('AMB-01', 'Nome ambíguo');
    await insertRoute('AMB-02', 'Nome ambíguo');
    await insertRoute('ROTA-REMOVIDA', 'Nome removido', true);

    const codeClient = await insertLegacyClient('COD', 'COD-EXATO');
    const nameClient = await insertLegacyClient('NOME', 'Nome único');
    const collisionClient = await insertLegacyClient('COL', 'COLISAO');
    const deletedClient = await insertLegacyClient(
      'SOFT-DELETED',
      'COD-EXATO',
      true,
    );
    const ambiguousClient = await insertLegacyClient(
      'AMBIGUO',
      'Nome ambíguo',
    );
    const removedRouteClient = await insertLegacyClient(
      'ROTA-REMOVIDA',
      'ROTA-REMOVIDA',
    );

    const dml = migrationStatements('0017_onda4_comercial_backfill').slice(
      0,
      2,
    );
    await inOnda4Transaction(async (client) => {
      for (const statement of dml) await client.query(statement);
      const { rows } = await client.query<{
        id: string;
        rota_id: string | null;
      }>(
        `SELECT id, rota_id FROM clientes WHERE id = ANY($1::uuid[])`,
        [[ambiguousClient, removedRouteClient]],
      );
      expect(rows).toHaveLength(2);
      expect(rows.every((row) => row.rota_id === null)).toBe(true);
    });

    await (await onda4Pool()).query(
      'DELETE FROM clientes WHERE id = ANY($1::uuid[])',
      [[ambiguousClient, removedRouteClient]],
    );

    await aplicarTagsOnda4(['0017_onda4_comercial_backfill']);
    expect((await clientRoute(codeClient)).rota_id).toBe(codeRouteId);
    expect((await clientRoute(nameClient)).rota_id).toBe(uniqueNameRouteId);
    expect((await clientRoute(collisionClient)).rota_id).toBe(
      collisionCodeRouteId,
    );
    expect((await clientRoute(deletedClient)).rota_id).toBe(codeRouteId);

    const before = await (await onda4Pool()).query<{
      id: string;
      rota_id: string | null;
    }>('SELECT id, rota_id FROM clientes ORDER BY id');
    await aplicarTagsOnda4(['0017_onda4_comercial_backfill']);
    const after = await (await onda4Pool()).query<{
      id: string;
      rota_id: string | null;
    }>('SELECT id, rota_id FROM clientes ORDER BY id');
    expect(after.rows).toEqual(before.rows);
  }, 120_000);

  it('guarda bloqueia o contract ate todo legado estar associado', async () => {
    await migrarAteOnda4('0016_onda4_comercial_expand');
    const clientId = await insertLegacyClient('SEM-ROTA', 'SEM-CORRESPONDENCIA');

    await expect(
      aplicarTagsOnda4([
        '0017_onda4_comercial_backfill',
        '0018_onda4_comercial_contract',
      ]),
    ).rejects.toThrow(/backfill incompleto/);

    expect(await columnExists('clientes', 'rota_padrao')).toBe(true);
    expect(await columnExists('clientes', 'rota_id')).toBe(true);
    expect(await clientRoute(clientId)).toEqual({
      rota_id: null,
      rota_padrao: 'SEM-CORRESPONDENCIA',
    });

    const routeId = await insertRoute(
      'SEM-CORRESPONDENCIA',
      'Rota corrigida',
    );
    await aplicarTagsOnda4([
      '0017_onda4_comercial_backfill',
      '0018_onda4_comercial_contract',
    ]);

    expect(await columnExists('clientes', 'rota_padrao')).toBe(false);
    expect((await clientRoute(clientId)).rota_id).toBe(routeId);
  }, 120_000);

  it('cadeia gerada migra bancos limpo e legado ate o contract', async () => {
    await resetOnda4Database();
    await migrateOnda4WithDrizzle();
    const cleanEntries = await (await onda4Pool()).query<{ total: string }>(
      'SELECT count(*)::text AS total FROM drizzle.__drizzle_migrations',
    );
    await migrateOnda4WithDrizzle();
    const cleanEntriesAgain = await (await onda4Pool()).query<{ total: string }>(
      'SELECT count(*)::text AS total FROM drizzle.__drizzle_migrations',
    );
    expect(cleanEntriesAgain.rows).toEqual(cleanEntries.rows);
    await expectFinalStructure();
    expect(runOnda4Seed()).toContain('Seed');
    expect(runOnda4Seed()).toContain('Seed');

    await migrarAteOnda4('0015_onda3_cadastros_admin');
    const routeId = await insertRoute('LEGACY-ROTA', 'Legacy rota');
    const clientId = await insertLegacyClient('LEGACY', 'LEGACY-ROTA');
    await markDrizzleThrough('0015_onda3_cadastros_admin');
    await migrateOnda4WithDrizzle();
    const legacyEntries = await (await onda4Pool()).query<{ total: string }>(
      'SELECT count(*)::text AS total FROM drizzle.__drizzle_migrations',
    );
    await migrateOnda4WithDrizzle();
    const legacyEntriesAgain = await (await onda4Pool()).query<{ total: string }>(
      'SELECT count(*)::text AS total FROM drizzle.__drizzle_migrations',
    );
    expect(legacyEntriesAgain.rows).toEqual(legacyEntries.rows);
    expect((await clientRoute(clientId)).rota_id).toBe(routeId);
    await expectFinalStructure();
    expect(runOnda4Seed()).toContain('Seed');
    expect(runOnda4Seed()).toContain('Seed');
  }, 300_000);

  it('receita de rollback gerado restaura compatibilidade sem perder dados O4', async () => {
    // Baseline O4 puro: migra só até 0018 (sem 0019/0020), para o generate não ver tabelas O5.
    await migrarAteOnda4('0018_onda4_comercial_contract');
    await markDrizzleThrough('0018_onda4_comercial_contract');

    const routeId = await insertRoute('ROLLBACK-ROTA', 'Rollback rota');
    const { rows: clients } = await (await onda4Pool()).query<{ id: string }>(
      `INSERT INTO clientes
         (codigo, razao_social, documento_fiscal, status, rota_id)
       VALUES ('CLI-ROLLBACK', 'Cliente rollback', 'DOC-ROLLBACK', 'ativo', $1)
       RETURNING id`,
      [routeId],
    );
    const clientId = clients[0]!.id;
    const { rows: priceTables } = await (await onda4Pool()).query<{ id: string }>(
      `INSERT INTO tabelas_preco (data, status, observacao)
       VALUES ('2099-12-31', 'rascunho', 'probe rollback')
       RETURNING id`,
    );
    const priceTableId = priceTables[0]!.id;

    const runtimeRoot = path.resolve(WORKTREE_ROOT, '.codex/runtime');
    const probe = path.resolve(runtimeRoot, 'o4-rollback-probe');
    if (!probe.startsWith(`${runtimeRoot}${path.sep}`)) {
      throw new Error('probe de rollback fora de .codex/runtime');
    }

    fs.rmSync(probe, { recursive: true, force: true });
    fs.mkdirSync(probe, { recursive: true });
    try {
      fs.cpSync(path.resolve(BACKEND_DIR, 'src/database/schema'), path.join(probe, 'schema'), {
        recursive: true,
      });
      fs.cpSync(MIGRATIONS_DIR, path.join(probe, 'migrations'), {
        recursive: true,
      });
      // Probe O4: baseline até 0018 — SQL/snapshots/schemas O5+O6 não entram na receita.
      // Sem remover 0021/0022, o drizzle-kit ancora no snapshot 0022 e o generate mistura
      // DROP de tabelas O5 com o ADD de rota_padrao (quebra a asserção byte-a-byte).
      for (const postO4Artifact of [
        'migrations/0019_onda5_gestao.sql',
        'migrations/0020_onda5_usuarios_representantes.sql',
        'migrations/0021_onda6_recebimento_balanca_expand.sql',
        'migrations/0022_onda6_etiqueta_estado_backfill.sql',
        'migrations/0023_onda7_desossa_expand.sql',
        'migrations/meta/0019_snapshot.json',
        'migrations/meta/0020_snapshot.json',
        'migrations/meta/0021_snapshot.json',
        'migrations/meta/0022_snapshot.json',
        'migrations/meta/0023_snapshot.json',
        'schema/relatorios-sif.schema.ts',
        'schema/aprovacoes-operacionais.schema.ts',
        // Emenda 7: importa aprovacoes-operacionais — quebra resolve do probe O4
        'schema/divergencias-transformacao.schema.ts',
      ]) {
        fs.rmSync(path.join(probe, postO4Artifact), { force: true });
      }
      // pesagem.schema da O6 (trocas_peca + estado da etiqueta) voltaria a gerar DDL extra —
      // restaura o snapshot pré-O6 pinado (sem depender de git fetch no CI shallow).
      fs.copyFileSync(
        path.resolve(__dirname, '../helpers/fixtures/pesagem.schema.pre-onda6.ts'),
        path.join(probe, 'schema/pesagem.schema.ts'),
      );
      // Emenda 7: colunas O7 em transformacoes/regras gerariam DDL extra no generate O4
      fs.copyFileSync(
        path.resolve(__dirname, '../helpers/fixtures/transformacoes.schema.pre-onda7.ts'),
        path.join(probe, 'schema/transformacoes.schema.ts'),
      );
      fs.copyFileSync(
        path.resolve(__dirname, '../helpers/fixtures/regras-transformacao.schema.pre-onda7.ts'),
        path.join(probe, 'schema/regras-transformacao.schema.ts'),
      );
      const probeJournal = JSON.parse(
        fs.readFileSync(path.join(probe, 'migrations/meta/_journal.json'), 'utf8'),
      ) as { version: string; dialect: string; entries: Array<{ idx: number; tag: string }> };
      probeJournal.entries = probeJournal.entries.filter((entry) => entry.idx <= 18);
      fs.writeFileSync(
        path.join(probe, 'migrations/meta/_journal.json'),
        `${JSON.stringify(probeJournal, null, 2)}\n`,
        'utf8',
      );
      const probeSchemaIndex = path.join(probe, 'schema/index.ts');
      const o4SchemaLines = fs.readFileSync(probeSchemaIndex, 'utf8')
        .split(/\r?\n/)
        .filter((line) =>
          !line.includes('relatorios-sif.schema') &&
          !line.includes('aprovacoes-operacionais.schema') &&
          !line.includes('usuarios-representantes.schema') &&
          !line.includes('divergencias-transformacao.schema'),
        );
      fs.writeFileSync(probeSchemaIndex, `${o4SchemaLines.join('\n')}\n`, 'utf8');

      // usuarios_representantes vive em auth.schema (O5) — remove do probe para o
      // generate não divergir do snapshot 0018.
      const probeAuthSchema = path.join(probe, 'schema/auth.schema.ts');
      let authSchema = fs.readFileSync(probeAuthSchema, 'utf8');
      authSchema = authSchema.replace(
        /import \{ representantes \} from '\.\/representantes\.schema';\r?\n/,
        '',
      );
      const tableStart = authSchema.indexOf('export const usuariosRepresentantes = pgTable');
      const relationsStart = authSchema.indexOf('export const usuariosRelations');
      if (tableStart < 0 || relationsStart < 0) {
        throw new Error('auth.schema do probe sem bloco usuariosRepresentantes esperado');
      }
      const commentStart = authSchema.lastIndexOf('\n//', tableStart);
      authSchema = `${authSchema.slice(0, commentStart)}\n${authSchema.slice(relationsStart)}`;
      authSchema = authSchema.replace(
        /\s*representantesPermitidos: many\(usuariosRepresentantes\),/,
        '',
      );
      const urRelations = authSchema.indexOf('export const usuariosRepresentantesRelations');
      if (urRelations >= 0) {
        authSchema = authSchema.slice(0, urRelations).trimEnd() + '\n';
      }
      // primaryKey só era usado pela tabela O5 removida
      authSchema = authSchema.replace(/^\s*primaryKey,\r?\n/m, '');
      fs.writeFileSync(probeAuthSchema, authSchema, 'utf8');

      fs.writeFileSync(
        path.join(probe, 'drizzle.config.ts'),
        [
          "import { defineConfig } from 'drizzle-kit';",
          'export default defineConfig({',
          "  dialect: 'postgresql',",
          "  schema: './schema/index.ts',",
          "  out: './migrations',",
          "  dbCredentials: { url: 'postgres://unused' },",
          '});',
          '',
        ].join('\n'),
        'utf8',
      );

      const copiedClientSchema = path.join(probe, 'schema/clientes.schema.ts');
      const finalSchema = fs.readFileSync(copiedClientSchema, 'utf8');
      const routeIdLine =
        "    rotaId:                  uuid('rota_id').references(() => rotas.id),";
      if (!finalSchema.includes(routeIdLine)) {
        throw new Error('schema copiado sem rotaId');
      }
      fs.writeFileSync(
        copiedClientSchema,
        finalSchema.replace(
          routeIdLine,
          [
            "    rotaPadrao:              text('rota_padrao'),",
            routeIdLine,
          ].join('\n'),
        ),
        'utf8',
      );

      const expandOutput = runDrizzleKit(probe, [
        'generate',
        '--config',
        'drizzle.config.ts',
        '--name',
        'onda4_comercial_rollback_expand',
      ]);
      expect(expandOutput).toContain(
        '0019_onda4_comercial_rollback_expand.sql',
      );
      const rollbackExpand = path.join(
        probe,
        'migrations/0019_onda4_comercial_rollback_expand.sql',
      );
      expect(fs.readFileSync(rollbackExpand, 'utf8').trim()).toBe(
        'ALTER TABLE "clientes" ADD COLUMN "rota_padrao" text;',
      );

      const customOutput = runDrizzleKit(probe, [
        'generate',
        '--config',
        'drizzle.config.ts',
        '--custom',
        '--name',
        'onda4_comercial_rollback_backfill',
      ]);
      expect(customOutput).toContain(
        '0020_onda4_comercial_rollback_backfill.sql',
      );
      const rollbackBackfill = path.join(
        probe,
        'migrations/0020_onda4_comercial_rollback_backfill.sql',
      );
      const inverseSql = [
        '-- Onda 4 — rollback de aplicação: restaura o contrato legado.',
        'UPDATE "clientes" AS c',
        '   SET "rota_padrao" = r."codigo"',
        '  FROM "rotas" AS r',
        ' WHERE c."rota_padrao" IS NULL',
        '   AND c."rota_id" = r."id";',
        '--> statement-breakpoint',
        'DO $$',
        'DECLARE pendentes integer;',
        'BEGIN',
        '  SELECT count(*) INTO pendentes',
        '    FROM "clientes"',
        '   WHERE "rota_id" IS NOT NULL',
        '     AND "rota_padrao" IS NULL;',
        '  IF pendentes > 0 THEN',
        "    RAISE EXCEPTION 'rollback incompleto: % cliente(s) sem rota_padrao', pendentes;",
        '  END IF;',
        'END $$;',
        '',
      ].join('\n');
      fs.writeFileSync(rollbackBackfill, inverseSql, 'utf8');
      expect(inverseSql).not.toMatch(
        /^\s*(CREATE|ALTER|DROP|TRUNCATE)\b/im,
      );

      const client = await (await onda4Pool()).connect();
      try {
        await client.query('BEGIN');
        await executeSqlFile(client, rollbackExpand);
        await executeSqlFile(client, rollbackBackfill);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }

      const { rows: legacyClients } = await (await onda4Pool()).query<{
        rota_padrao: string | null;
      }>(
        'SELECT rota_padrao FROM clientes WHERE id = $1',
        [clientId],
      );
      expect(legacyClients[0]!.rota_padrao).toBe('ROLLBACK-ROTA');
      const { rows: preserved } = await (await onda4Pool()).query<{ id: string }>(
        'SELECT id FROM tabelas_preco WHERE id = $1',
        [priceTableId],
      );
      expect(preserved).toEqual([{ id: priceTableId }]);
      for (const table of O4_TABLES) {
        expect(await tableExists(table)).toBe(true);
      }
      expect(await columnExists('clientes', 'rota_id')).toBe(true);
      expect(await indexExists('idx_clientes_rota')).toBe(true);
    } finally {
      fs.rmSync(probe, { recursive: true, force: true });
    }
  }, 300_000);
});
