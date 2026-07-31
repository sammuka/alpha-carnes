import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { hash } from '@node-rs/argon2';
import { DRIZZLE } from '../../database/database.module';
import * as schema from '../../database/schema';
import { AuditoriaService } from '../../common/auditoria/auditoria.service';
import { primeiroOuFalha } from '../../common/crud/paginacao';
import { RbacService } from '../auth/rbac.service';
import type { CreateUsuarioDto } from './dto/create-usuario.dto';
import type { UpdateUsuarioDto } from './dto/update-usuario.dto';

type Db = NodePgDatabase<typeof schema>;

type RepresentantePermitido = {
  id: string;
  nome: string;
  status: string;
  deletedAt: Date | null;
};

function mesmosIds(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, indice) => id === b[indice]);
}

// Projeção pública de usuário (nunca expõe senhaHash).
const PROJECAO_USUARIO = {
  id: schema.usuarios.id,
  nome: schema.usuarios.nome,
  email: schema.usuarios.email,
  ativo: schema.usuarios.ativo,
  ultimoAcesso: schema.usuarios.ultimoAcesso,
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

      await this.definirRepresentantesNaTx(
        tx,
        usuario.id,
        dto.representantes,
        criadorId,
      );

      await this.auditoria.registrar(tx, {
        tabela: 'usuarios',
        registroId: usuario.id,
        operacao: 'INSERT',
        modulo: 'usuarios',
        usuarioId: criadorId,
        dadosAnteriores: {},
        dadosNovos: usuario,
      });
      return this.detalharNaTx(usuario.id, tx);
    });
  }

  async aprovar(usuarioId: string, aprovadorId: string) {
    const usuario = await this.db
      .select()
      .from(schema.usuarios)
      .where(eq(schema.usuarios.id, usuarioId))
      .then((r) => r[0] ?? null);

    if (!usuario) throw new NotFoundException('Usuário não encontrado');

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

  async resumoPerfis(): Promise<Array<{ slug: string; nome: string; total: number }>> {
    const linhas = await this.db
      .select({
        slug: schema.perfis.slug,
        nome: schema.perfis.nome,
        total: sql<number>`count(${schema.usuariosPerfis.usuarioId}) FILTER (WHERE ${schema.usuarios.deletedAt} IS NULL)::int`,
      })
      .from(schema.perfis)
      .leftJoin(schema.usuariosPerfis, eq(schema.perfis.id, schema.usuariosPerfis.perfilId))
      .leftJoin(schema.usuarios, eq(schema.usuariosPerfis.usuarioId, schema.usuarios.id))
      .groupBy(schema.perfis.slug, schema.perfis.nome);

    const ORDEM = [
      'administrador', 'gestor', 'compras', 'comercial', 'recebimento_pesagem', 'corte',
      'expedicao', 'conferente', 'faturamento', 'logistica', 'diretoria',
    ];
    return ORDEM.map((slug) => linhas.find((l) => l.slug === slug) ?? { slug, nome: slug, total: 0 });
  }

  async listar() {
    const usuarios = await this.db
      .select(PROJECAO_USUARIO)
      .from(schema.usuarios)
      .where(isNull(schema.usuarios.deletedAt));

    if (usuarios.length === 0) return [];

    const ids = usuarios.map((u) => u.id);
    const [perfisRows, representantesPorUsuario] = await Promise.all([
      this.db
        .select({ usuarioId: schema.usuariosPerfis.usuarioId, slug: schema.perfis.slug })
        .from(schema.usuariosPerfis)
        .innerJoin(schema.perfis, eq(schema.usuariosPerfis.perfilId, schema.perfis.id))
        .where(inArray(schema.usuariosPerfis.usuarioId, ids)),
      this.representantesPorUsuario(this.db, ids),
    ]);

    const perfisPorUsuario = new Map<string, string[]>();
    for (const row of perfisRows) {
      const atuais = perfisPorUsuario.get(row.usuarioId) ?? [];
      atuais.push(row.slug);
      perfisPorUsuario.set(row.usuarioId, atuais);
    }

    return usuarios.map((usuario) => {
      const representantesPermitidos = representantesPorUsuario.get(usuario.id) ?? [];
      return {
        ...usuario,
        perfis: perfisPorUsuario.get(usuario.id) ?? [],
        representantesPermitidos,
        escopoRepresentantes:
          representantesPermitidos.length === 0 ? 'todos' as const : 'restrito' as const,
      };
    });
  }

  async detalhar(id: string) {
    return this.detalharNaTx(id, this.db);
  }

  async definirRepresentantes(
    usuarioId: string,
    representantes: string[],
    autorUsuarioId: string,
  ) {
    return this.db.transaction((tx) =>
      this.definirRepresentantesNaTx(
        tx,
        usuarioId,
        representantes,
        autorUsuarioId,
      ),
    );
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
      return this.detalharNaTx(id, tx);
    });
  }

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

  private async representantesPorUsuario(
    exec: Db,
    usuariosIds: string[],
  ): Promise<Map<string, RepresentantePermitido[]>> {
    const resultado = new Map<string, RepresentantePermitido[]>();
    for (const id of usuariosIds) resultado.set(id, []);
    if (usuariosIds.length === 0) return resultado;

    const linhas = await exec
      .select({
        usuarioId: schema.usuariosRepresentantes.usuarioId,
        id: schema.representantes.id,
        nome: schema.representantes.nome,
        status: schema.representantes.status,
        deletedAt: schema.representantes.deletedAt,
      })
      .from(schema.usuariosRepresentantes)
      .innerJoin(
        schema.representantes,
        eq(
          schema.representantes.id,
          schema.usuariosRepresentantes.representanteId,
        ),
      )
      .where(inArray(schema.usuariosRepresentantes.usuarioId, usuariosIds))
      .orderBy(
        schema.usuariosRepresentantes.usuarioId,
        asc(schema.representantes.nome),
        asc(schema.representantes.id),
      );

    for (const linha of linhas) {
      resultado.get(linha.usuarioId)?.push({
        id: linha.id,
        nome: linha.nome,
        status: linha.status,
        deletedAt: linha.deletedAt,
      });
    }
    return resultado;
  }

  private async detalharNaTx(id: string, tx: Db) {
    const usuario = await tx
      .select(PROJECAO_USUARIO)
      .from(schema.usuarios)
      .where(and(eq(schema.usuarios.id, id), isNull(schema.usuarios.deletedAt)))
      .then((linhas) => linhas[0] ?? null);
    if (!usuario) throw new NotFoundException('Usuário não encontrado');

    const [perfis, porUsuario] = await Promise.all([
      this.perfisDoUsuario(id, tx),
      this.representantesPorUsuario(tx, [id]),
    ]);
    const representantesPermitidos = porUsuario.get(id) ?? [];
    return {
      ...usuario,
      perfis,
      representantesPermitidos,
      escopoRepresentantes:
        representantesPermitidos.length === 0 ? 'todos' as const : 'restrito' as const,
    };
  }

  private async definirRepresentantesNaTx(
    tx: Db,
    usuarioId: string,
    representantesSolicitados: string[],
    autorUsuarioId: string,
  ) {
    const usuario = await tx
      .select({ id: schema.usuarios.id })
      .from(schema.usuarios)
      .where(and(
        eq(schema.usuarios.id, usuarioId),
        isNull(schema.usuarios.deletedAt),
      ))
      .for('update')
      .limit(1)
      .then((linhas) => linhas[0] ?? null);
    if (!usuario) throw new NotFoundException('Usuário não encontrado');

    const anterioresRows = await tx
      .select({ representanteId: schema.usuariosRepresentantes.representanteId })
      .from(schema.usuariosRepresentantes)
      .where(eq(schema.usuariosRepresentantes.usuarioId, usuarioId))
      .orderBy(schema.usuariosRepresentantes.representanteId);
    const idsAnterioresOrdenados = anterioresRows.map((linha) => linha.representanteId);
    const anteriores = new Set(idsAnterioresOrdenados);
    const idsNovosOrdenados = [...representantesSolicitados].sort();

    const candidatos = idsNovosOrdenados.length === 0
      ? []
      : await tx
        .select({
          id: schema.representantes.id,
          deletedAt: schema.representantes.deletedAt,
        })
        .from(schema.representantes)
        .where(inArray(schema.representantes.id, idsNovosOrdenados));
    const candidatosPorId = new Map(candidatos.map((linha) => [linha.id, linha]));
    const invalidos = idsNovosOrdenados.filter((id) => {
      const candidato = candidatosPorId.get(id);
      return !candidato || (candidato.deletedAt !== null && !anteriores.has(id));
    });
    if (invalidos.length > 0) {
      throw new BadRequestException({
        code: 'REPRESENTANTES_INVALIDOS',
        message: 'Representantes permitidos contêm ID inexistente ou removido',
        representantes: invalidos,
      });
    }

    if (mesmosIds(idsAnterioresOrdenados, idsNovosOrdenados)) {
      return this.detalharNaTx(usuarioId, tx);
    }

    await tx
      .delete(schema.usuariosRepresentantes)
      .where(eq(schema.usuariosRepresentantes.usuarioId, usuarioId));
    if (idsNovosOrdenados.length > 0) {
      await tx.insert(schema.usuariosRepresentantes).values(
        idsNovosOrdenados.map((representanteId) => ({
          usuarioId,
          representanteId,
        })),
      );
    }

    await this.auditoria.registrar(tx, {
      tabela: 'usuarios_representantes',
      registroId: usuarioId,
      operacao: 'UPDATE',
      modulo: 'usuarios',
      usuarioId: autorUsuarioId,
      dadosAnteriores: { representantes: idsAnterioresOrdenados },
      dadosNovos: { representantes: idsNovosOrdenados },
    });
    return this.detalharNaTx(usuarioId, tx);
  }

  private async buscarAtivo(id: string, tx?: Db) {
    const exec = tx ?? this.db;
    return exec
      .select(PROJECAO_USUARIO)
      .from(schema.usuarios)
      .where(and(eq(schema.usuarios.id, id), isNull(schema.usuarios.deletedAt)))
      .then((r) => r[0] ?? null);
  }

  private async perfisDoUsuario(id: string, tx?: Db): Promise<string[]> {
    const exec = tx ?? this.db;
    const rows = await exec
      .select({ slug: schema.perfis.slug })
      .from(schema.usuariosPerfis)
      .innerJoin(schema.perfis, eq(schema.usuariosPerfis.perfilId, schema.perfis.id))
      .where(eq(schema.usuariosPerfis.usuarioId, id));
    return rows.map((r) => r.slug);
  }

  private async vincularPerfis(
    tx: Db,
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
