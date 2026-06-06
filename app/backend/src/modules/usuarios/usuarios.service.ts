import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq, isNull, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { hash } from '@node-rs/argon2';
import { DRIZZLE } from '../../database/database.module';
import * as schema from '../../database/schema';
import { RbacService } from '../auth/rbac.service';
import type { CreateUsuarioDto } from './dto/create-usuario.dto';

@Injectable()
export class UsuariosService {
  constructor(
    @Inject(DRIZZLE)
    private readonly drizzle: { db: NodePgDatabase<typeof schema> },
    private readonly rbacService: RbacService,
  ) {}

  private get db() {
    return this.drizzle.db;
  }

  async criar(dto: CreateUsuarioDto, criadorId: string) {
    // Verificar email único
    const existe = await this.db
      .select({ id: schema.usuarios.id })
      .from(schema.usuarios)
      .where(sql`${schema.usuarios.email} = ${dto.email} AND ${schema.usuarios.deletedAt} IS NULL`);
    if (existe.length > 0) throw new ConflictException('Email já cadastrado');

    const senhaHash = await hash(dto.password);

    const [usuario] = await this.db
      .insert(schema.usuarios)
      .values({
        nome: dto.nome,
        email: dto.email,
        senhaHash,
        criadoPorId: criadorId,
      })
      .returning();

    return usuario;
  }

  async aprovar(usuarioId: string, aprovadorId: string) {
    const usuario = await this.db
      .select()
      .from(schema.usuarios)
      .where(eq(schema.usuarios.id, usuarioId))
      .then((r) => r[0] ?? null);

    if (!usuario) throw new NotFoundException('Usuário não encontrado');

    // SF-01: criador não pode aprovar o usuário que ele mesmo criou
    if (usuario.criadoPorId) {
      try {
        this.rbacService.assertCriadorNaoAprovador(usuario.criadoPorId, aprovadorId);
      } catch {
        throw new ConflictException('Segregação de funções: o criador do usuário não pode ser o aprovador (SF-01)');
      }
    }

    return { message: 'Usuário aprovado', usuarioId };
  }

  async listar() {
    return this.db
      .select({
        id: schema.usuarios.id,
        nome: schema.usuarios.nome,
        email: schema.usuarios.email,
        ativo: schema.usuarios.ativo,
        createdAt: schema.usuarios.createdAt,
      })
      .from(schema.usuarios)
      .where(isNull(schema.usuarios.deletedAt));
  }
}
