import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { hash } from '@node-rs/argon2';
import { DRIZZLE } from '../../database/database.module';
import * as schema from '../../database/schema';
import { AuditoriaService } from '../../common/auditoria/auditoria.service';
import { primeiroOuFalha } from '../../common/crud/paginacao';
import { RbacService } from '../auth/rbac.service';
import type { CreateUsuarioDto } from './dto/create-usuario.dto';
import type { UpdateUsuarioDto } from './dto/update-usuario.dto';

// Projeção pública de usuário (nunca expõe senhaHash).
const PROJECAO_USUARIO = {
  id: schema.usuarios.id,
  nome: schema.usuarios.nome,
  email: schema.usuarios.email,
  ativo: schema.usuarios.ativo,
  createdAt: schema.usuarios.createdAt,
  updatedAt: schema.usuarios.updatedAt,
  deletedAt: schema.usuarios.deletedAt,
};

@Injectable()
export class UsuariosService {
  constructor(
    @Inject(DRIZZLE)
    private readonly drizzle: { db: NodePgDatabase<typeof schema> },
    private readonly rbacService: RbacService,
    private readonly auditoria: AuditoriaService,
  ) {}

  private get db() {
    return this.drizzle.db;
  }

  async criar(dto: CreateUsuarioDto, criadorId: string) {
    return this.db.transaction(async (tx) => {
      const existe = await tx
        .select({ id: schema.usuarios.id })
        .from(schema.usuarios)
        .where(and(eq(schema.usuarios.email, dto.email), isNull(schema.usuarios.deletedAt)));
      if (existe.length > 0) throw new ConflictException('Email já cadastrado');

      const senhaHash = await hash(dto.password);

      const usuario = primeiroOuFalha(
        await tx
          .insert(schema.usuarios)
          .values({ nome: dto.nome, email: dto.email, senhaHash, criadoPorId: criadorId })
          .returning(PROJECAO_USUARIO),
      );

      if (dto.perfis && dto.perfis.length > 0) {
        await this.vincularPerfis(tx, usuario.id, dto.perfis);
      }

      await this.auditoria.registrar(tx, {
        tabela: 'usuarios',
        registroId: usuario.id,
        operacao: 'INSERT',
        modulo: 'usuarios',
        usuarioId: criadorId,
        dadosAnteriores: {},
        dadosNovos: usuario,
      });
      return usuario;
    });
  }

  async aprovar(usuarioId: string, aprovadorId: string) {
    const usuario = await this.db
      .select()
      .from(schema.usuarios)
      .where(eq(schema.usuarios.id, usuarioId))
      .then((r) => r[0] ?? null);

    if (!usuario) throw new NotFoundException('Usuário não encontrado');

    // SF-01: criador não pode aprovar o usuário que ele mesmo criou.
    if (usuario.criadoPorId) {
      try {
        this.rbacService.assertCriadorNaoAprovador(usuario.criadoPorId, aprovadorId);
      } catch {
        throw new ConflictException(
          'Segregação de funções: o criador do usuário não pode ser o aprovador (SF-01)',
        );
      }
    }

    return { message: 'Usuário aprovado', usuarioId };
  }

  async listar() {
    const usuarios = await this.db
      .select(PROJECAO_USUARIO)
      .from(schema.usuarios)
      .where(isNull(schema.usuarios.deletedAt));

    if (usuarios.length === 0) return [];

    const ids = usuarios.map((u) => u.id);
    const perfisRows = await this.db
      .select({ usuarioId: schema.usuariosPerfis.usuarioId, slug: schema.perfis.slug })
      .from(schema.usuariosPerfis)
      .innerJoin(schema.perfis, eq(schema.usuariosPerfis.perfilId, schema.perfis.id))
      .where(inArray(schema.usuariosPerfis.usuarioId, ids));

    const perfisPorUsuario = new Map<string, string[]>();
    for (const row of perfisRows) {
      const atual = perfisPorUsuario.get(row.usuarioId) ?? [];
      atual.push(row.slug);
      perfisPorUsuario.set(row.usuarioId, atual);
    }

    return usuarios.map((u) => ({
      ...u,
      perfis: perfisPorUsuario.get(u.id) ?? [],
    }));
  }

  async detalhar(id: string) {
    const usuario = await this.buscarAtivo(id);
    if (!usuario) throw new NotFoundException('Usuário não encontrado');
    const perfis = await this.perfisDoUsuario(id);
    return { ...usuario, perfis };
  }

  async atualizar(id: string, dto: UpdateUsuarioDto, autorId: string) {
    return this.db.transaction(async (tx) => {
      const anterior = await this.buscarAtivo(id, tx);
      if (!anterior) throw new NotFoundException('Usuário não encontrado');

      if (dto.email && dto.email !== anterior.email) {
        const colisao = await tx
          .select({ id: schema.usuarios.id })
          .from(schema.usuarios)
          .where(and(eq(schema.usuarios.email, dto.email), isNull(schema.usuarios.deletedAt)));
        if (colisao.length > 0) throw new ConflictException('Email já cadastrado');
      }

      const atualizado = primeiroOuFalha(
        await tx
          .update(schema.usuarios)
          .set({
            nome: dto.nome ?? anterior.nome,
            email: dto.email ?? anterior.email,
            ativo: dto.ativo ?? anterior.ativo,
          })
          .where(eq(schema.usuarios.id, id))
          .returning(PROJECAO_USUARIO),
      );

      await this.auditoria.registrar(tx, {
        tabela: 'usuarios',
        registroId: id,
        operacao: 'UPDATE',
        modulo: 'usuarios',
        usuarioId: autorId,
        dadosAnteriores: anterior,
        dadosNovos: atualizado,
      });
      return atualizado;
    });
  }

  async remover(id: string, autorId: string) {
    return this.db.transaction(async (tx) => {
      const anterior = await this.buscarAtivo(id, tx);
      if (!anterior) throw new NotFoundException('Usuário não encontrado');

      const removido = primeiroOuFalha(
        await tx
          .update(schema.usuarios)
          .set({ deletedAt: new Date(), ativo: false })
          .where(eq(schema.usuarios.id, id))
          .returning(PROJECAO_USUARIO),
      );

      await this.auditoria.registrar(tx, {
        tabela: 'usuarios',
        registroId: id,
        operacao: 'DELETE',
        modulo: 'usuarios',
        usuarioId: autorId,
        dadosAnteriores: anterior,
        dadosNovos: removido,
      });
      return { id, deletedAt: removido.deletedAt as Date };
    });
  }

  async restaurar(id: string, autorId: string) {
    return this.db.transaction(async (tx) => {
      const anterior = await tx
        .select(PROJECAO_USUARIO)
        .from(schema.usuarios)
        .where(eq(schema.usuarios.id, id))
        .then((r) => r[0] ?? null);
      if (!anterior) throw new NotFoundException('Usuário não encontrado');
      if (!anterior.deletedAt) throw new ConflictException('Usuário não está removido');

      const colisao = await tx
        .select({ id: schema.usuarios.id })
        .from(schema.usuarios)
        .where(and(eq(schema.usuarios.email, anterior.email), isNull(schema.usuarios.deletedAt)));
      if (colisao.length > 0) throw new ConflictException('Já existe usuário ativo com este email');

      const restaurado = primeiroOuFalha(
        await tx
          .update(schema.usuarios)
          .set({ deletedAt: null, ativo: true })
          .where(eq(schema.usuarios.id, id))
          .returning(PROJECAO_USUARIO),
      );

      await this.auditoria.registrar(tx, {
        tabela: 'usuarios',
        registroId: id,
        operacao: 'UPDATE',
        modulo: 'usuarios',
        usuarioId: autorId,
        dadosAnteriores: anterior,
        dadosNovos: restaurado,
      });
      return restaurado;
    });
  }

  /** Define o conjunto de perfis de um usuário (substitui os atuais). Auditado. */
  async definirPerfis(id: string, slugs: string[], autorId: string) {
    return this.db.transaction(async (tx) => {
      const usuario = await this.buscarAtivo(id, tx);
      if (!usuario) throw new NotFoundException('Usuário não encontrado');

      const anteriores = await this.perfisDoUsuario(id, tx);

      await tx.delete(schema.usuariosPerfis).where(eq(schema.usuariosPerfis.usuarioId, id));
      const novos = slugs.length ? await this.vincularPerfis(tx, id, slugs) : [];

      await this.auditoria.registrar(tx, {
        tabela: 'usuarios_perfis',
        registroId: id,
        operacao: 'UPDATE',
        modulo: 'usuarios',
        usuarioId: autorId,
        dadosAnteriores: { perfis: anteriores },
        dadosNovos: { perfis: novos },
      });
      return { id, perfis: novos };
    });
  }

  private async buscarAtivo(id: string, tx?: NodePgDatabase<typeof schema>) {
    const exec = tx ?? this.db;
    return exec
      .select(PROJECAO_USUARIO)
      .from(schema.usuarios)
      .where(and(eq(schema.usuarios.id, id), isNull(schema.usuarios.deletedAt)))
      .then((r) => r[0] ?? null);
  }

  private async perfisDoUsuario(id: string, tx?: NodePgDatabase<typeof schema>): Promise<string[]> {
    const exec = tx ?? this.db;
    const rows = await exec
      .select({ slug: schema.perfis.slug })
      .from(schema.usuariosPerfis)
      .innerJoin(schema.perfis, eq(schema.usuariosPerfis.perfilId, schema.perfis.id))
      .where(eq(schema.usuariosPerfis.usuarioId, id));
    return rows.map((r) => r.slug);
  }

  /** Vincula um usuário a perfis pelos slugs. Slugs inexistentes → 400 explícito. */
  private async vincularPerfis(
    tx: NodePgDatabase<typeof schema>,
    usuarioId: string,
    slugs: string[],
  ): Promise<string[]> {
    const perfis = await tx.select().from(schema.perfis).where(inArray(schema.perfis.slug, slugs));
    if (perfis.length !== new Set(slugs).size) {
      const encontrados = new Set(perfis.map((p) => p.slug));
      const faltando = slugs.filter((s) => !encontrados.has(s));
      throw new ConflictException(`Perfis inexistentes: ${faltando.join(', ')}`);
    }
    for (const perfil of perfis) {
      await tx
        .insert(schema.usuariosPerfis)
        .values({ usuarioId, perfilId: perfil.id })
        .onConflictDoNothing();
    }
    return perfis.map((p) => p.slug);
  }
}
