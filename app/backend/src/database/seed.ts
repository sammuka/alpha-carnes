import 'dotenv/config';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { hash } from '@node-rs/argon2';
import * as schema from './schema';

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

const PERMISSOES_FIXAS = [
  { id: '01960000-0000-7000-8000-000000000101', codigo: 'USUARIOS_GERENCIAR', descricao: 'Criar e editar usuários' },
  { id: '01960000-0000-7000-8000-000000000102', codigo: 'USUARIOS_APROVAR', descricao: 'Aprovar novos usuários (SF-01)' },
  { id: '01960000-0000-7000-8000-000000000103', codigo: 'PERFIS_GERENCIAR', descricao: 'Gerenciar catálogo de perfis' },
  { id: '01960000-0000-7000-8000-000000000104', codigo: 'AUDITORIA_VISUALIZAR', descricao: 'Consultar log de auditoria' },
] as const;

const MAPA: Record<string, string[]> = {
  administrador: ['USUARIOS_GERENCIAR', 'USUARIOS_APROVAR', 'PERFIS_GERENCIAR', 'AUDITORIA_VISUALIZAR'],
  gestor: ['USUARIOS_APROVAR', 'AUDITORIA_VISUALIZAR'],
  diretoria: ['AUDITORIA_VISUALIZAR'],
};

async function seed() {
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
        .values({ id: perm.id, codigo: perm.codigo, descricao: perm.descricao })
        .onConflictDoNothing();
    }
    console.log(`✅ ${PERMISSOES_FIXAS.length} permissões inseridas/verificadas`);

    // 3. Inserir mapa perfis_permissoes
    for (const [slug, codigos] of Object.entries(MAPA)) {
      const perfil = PERFIS_FIXOS.find((p) => p.slug === slug);
      if (!perfil) continue;
      for (const codigo of codigos) {
        const perm = PERMISSOES_FIXAS.find((p) => p.codigo === codigo);
        if (!perm) continue;
        await db.insert(schema.perfisPermissoes)
          .values({ perfilId: perfil.id, permissaoId: perm.id })
          .onConflictDoNothing();
      }
    }
    console.log('✅ Mapa perfis→permissões inserido/verificado');

    // 4. Inserir usuário admin
    const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@alphacarnes.local';
    const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@AlphaCarnes2026!';
    const senhaHash = await hash(adminPassword);

    const adminPerfil = PERFIS_FIXOS.find((p) => p.slug === 'administrador')!;

    const [admin] = await db.insert(schema.usuarios)
      .values({ nome: 'Administrador', email: adminEmail, senhaHash })
      .onConflictDoNothing()
      .returning();

    if (admin) {
      await db.insert(schema.usuariosPerfis)
        .values({ usuarioId: admin.id, perfilId: adminPerfil.id })
        .onConflictDoNothing();
      console.log(`✅ Usuário admin criado: ${adminEmail}`);
    } else {
      console.log(`ℹ️ Usuário admin já existe: ${adminEmail}`);
    }

    console.log('🎉 Seed concluído com sucesso!');
  } catch (err) {
    console.error('❌ Falha no seed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
