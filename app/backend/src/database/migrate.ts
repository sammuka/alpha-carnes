import 'dotenv/config';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import * as path from 'path';

async function runMigrations() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('❌ DATABASE_URL não definida');
    process.exit(1);
  }

  const pool = new Pool({ connectionString });
  const db = drizzle(pool);

  try {
    console.log('🔄 Aplicando migrations...');
    await migrate(db, {
      migrationsFolder: path.join(__dirname, 'migrations'),
    });
    console.log('✅ Migrations aplicadas com sucesso');
  } catch (err) {
    console.error('❌ Falha ao aplicar migrations:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();
