import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, desc, eq, getTableColumns, ilike, isNotNull, isNull, or, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../../database/database.module';
import * as schema from '../../../database/schema';
import { clientes, representantes } from '../../../database/schema';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import {
  calcularRange,
  montarPaginado,
  primeiroOuFalha,
  type ListarCadastroQuery,
  type Paginado,
} from '../../../common/crud/paginacao';
import type { CreateRepresentanteDto, UpdateRepresentanteDto } from './dto/representante.dto';

type Representante = typeof representantes.$inferSelect;
type RepresentanteComVinculos = Representante & {
  clientesVinculados: number;
  usuariosVinculadosCount: number;
};
type RepresentanteComClientes = Representante & {
  clientesVinculados: Array<{ id: string; nomeFantasia: string | null; razaoSocial: string }>;
  usuariosVinculados: Array<{ id: string; nome: string; email: string; ativo: boolean }>;
};

@Injectable()
export class RepresentantesService {
  constructor(
    @Inject(DRIZZLE)
    private readonly drizzle: { db: NodePgDatabase<typeof schema> },
    private readonly auditoria: AuditoriaService,
  ) {}

  private get db() {
    return this.drizzle.db;
  }

  async listar(query: ListarCadastroQuery): Promise<Paginado<RepresentanteComVinculos>> {
    const { limit, offset } = calcularRange(query);
    const filtros = [query.incluirRemovidos ? undefined : isNull(representantes.deletedAt)];
    if (query.search) {
      const termo = `%${query.search}%`;
      filtros.push(
        or(
          ilike(representantes.nome, termo),
          ilike(representantes.codigo, termo),
          ilike(representantes.contato, termo),
        ),
      );
    }
    if (query.status) filtros.push(eq(representantes.status, query.status));
    if (query.tipoCanal) filtros.push(eq(representantes.tipoCanal, query.tipoCanal));
    const where = and(...filtros.filter(Boolean));

    // "representantes"."id" precisa vir totalmente qualificado: interpolar ${representantes.id}
    // aqui emitiria só "id", que o Postgres resolveria para clientes.id (mesmo nome de coluna),
    // zerando a contagem sempre — bug real encontrado ao escrever o teste do DoD-83.
    const contagemClientes = sql<number>`(
    select count(*)::int from ${clientes}
    where ${clientes.representanteId} = "representantes"."id"
      and ${clientes.deletedAt} is null
  )`;

    const contagemUsuarios = sql<number>`(
  SELECT count(DISTINCT ur.usuario_id)::int
  FROM usuarios_representantes ur
  INNER JOIN usuarios u ON u.id = ur.usuario_id
  WHERE ur.representante_id = "representantes"."id"
    AND u.deleted_at IS NULL
)`;

    const [linhas, totalRow] = await Promise.all([
      this.db
        .select({
          ...getTableColumns(representantes),
          clientesVinculados: contagemClientes,
          usuariosVinculadosCount: contagemUsuarios,
        })
        .from(representantes)
        .where(where)
        .orderBy(desc(representantes.createdAt))
        .limit(limit)
        .offset(offset),
      this.db.select({ total: sql<number>`count(*)::int` }).from(representantes).where(where),
    ]);

    return montarPaginado(linhas, totalRow[0]?.total ?? 0, query);
  }

  /** Canais realmente usados, para o `select` da tela (decisão 44.3). */
  async canais(): Promise<string[]> {
    const linhas = await this.db
      .selectDistinct({ tipoCanal: representantes.tipoCanal })
      .from(representantes)
      .where(and(isNull(representantes.deletedAt), isNotNull(representantes.tipoCanal)))
      .orderBy(representantes.tipoCanal);
    return linhas.map((l) => l.tipoCanal).filter((c): c is string => c !== null);
  }

  async detalhar(id: string): Promise<RepresentanteComClientes> {
    const representante = await this.buscarAtivo(id);
    if (!representante) throw new NotFoundException('Representante não encontrado');

    const vinculados = await this.db
      .select({ id: clientes.id, nomeFantasia: clientes.nomeFantasia, razaoSocial: clientes.razaoSocial })
      .from(clientes)
      .where(and(eq(clientes.representanteId, id), isNull(clientes.deletedAt)))
      .orderBy(clientes.razaoSocial);

    const usuariosVinculados = await this.db
      .select({
        id: schema.usuarios.id,
        nome: schema.usuarios.nome,
        email: schema.usuarios.email,
        ativo: schema.usuarios.ativo,
      })
      .from(schema.usuariosRepresentantes)
      .innerJoin(
        schema.usuarios,
        eq(schema.usuarios.id, schema.usuariosRepresentantes.usuarioId),
      )
      .where(and(
        eq(schema.usuariosRepresentantes.representanteId, id),
        isNull(schema.usuarios.deletedAt),
      ))
      .orderBy(asc(schema.usuarios.nome), asc(schema.usuarios.id));

    return { ...representante, clientesVinculados: vinculados, usuariosVinculados };
  }

  async criar(dto: CreateRepresentanteDto, usuarioId: string): Promise<Representante> {
    return this.db.transaction(async (tx) => {
      await this.assertCodigoUnico(tx, dto.codigo, null);

      const criado = primeiroOuFalha(
        await tx
          .insert(representantes)
          .values({
            codigo: dto.codigo,
            nome: dto.nome,
            tipoCanal: dto.tipoCanal,
            contato: dto.contato,
            status: dto.status,
            observacao: dto.observacao,
          })
          .returning(),
      );

      await this.auditoria.registrar(tx, {
        tabela: 'representantes',
        registroId: criado.id,
        operacao: 'INSERT',
        modulo: 'cadastros',
        usuarioId,
        dadosAnteriores: {},
        dadosNovos: criado,
      });
      return criado;
    });
  }

  async atualizar(id: string, dto: UpdateRepresentanteDto, usuarioId: string): Promise<Representante> {
    return this.db.transaction(async (tx) => {
      const anterior = await this.buscarAtivo(id, tx);
      if (!anterior) throw new NotFoundException('Representante não encontrado');

      await this.assertCodigoUnico(tx, dto.codigo ?? anterior.codigo, id);

      const atualizado = primeiroOuFalha(
        await tx
          .update(representantes)
          .set({
            codigo: dto.codigo ?? anterior.codigo,
            nome: dto.nome ?? anterior.nome,
            tipoCanal: dto.tipoCanal ?? anterior.tipoCanal,
            contato: dto.contato ?? anterior.contato,
            status: dto.status ?? anterior.status,
            observacao: dto.observacao ?? anterior.observacao,
          })
          .where(eq(representantes.id, id))
          .returning(),
      );

      await this.auditoria.registrar(tx, {
        tabela: 'representantes',
        registroId: id,
        operacao: 'UPDATE',
        modulo: 'cadastros',
        usuarioId,
        dadosAnteriores: anterior,
        dadosNovos: atualizado,
      });
      return atualizado;
    });
  }

  async remover(id: string, usuarioId: string): Promise<{ id: string; deletedAt: Date }> {
    return this.db.transaction(async (tx) => {
      const anterior = await this.buscarAtivo(id, tx);
      if (!anterior) throw new NotFoundException('Representante não encontrado');

      const removido = primeiroOuFalha(
        await tx.update(representantes).set({ deletedAt: new Date() }).where(eq(representantes.id, id)).returning(),
      );

      await this.auditoria.registrar(tx, {
        tabela: 'representantes',
        registroId: id,
        operacao: 'DELETE',
        modulo: 'cadastros',
        usuarioId,
        dadosAnteriores: anterior,
        dadosNovos: removido,
      });
      return { id, deletedAt: removido.deletedAt as Date };
    });
  }

  async restaurar(id: string, usuarioId: string): Promise<Representante> {
    return this.db.transaction(async (tx) => {
      const anterior = await tx
        .select()
        .from(representantes)
        .where(eq(representantes.id, id))
        .then((r) => r[0] ?? null);
      if (!anterior) throw new NotFoundException('Representante não encontrado');
      if (!anterior.deletedAt) throw new ConflictException('Representante não está removido');

      await this.assertCodigoUnico(tx, anterior.codigo, id);

      const restaurado = primeiroOuFalha(
        await tx.update(representantes).set({ deletedAt: null }).where(eq(representantes.id, id)).returning(),
      );

      await this.auditoria.registrar(tx, {
        tabela: 'representantes',
        registroId: id,
        operacao: 'UPDATE',
        modulo: 'cadastros',
        usuarioId,
        dadosAnteriores: anterior,
        dadosNovos: restaurado,
      });
      return restaurado;
    });
  }

  private async buscarAtivo(id: string, tx?: NodePgDatabase<typeof schema>): Promise<Representante | null> {
    const exec = tx ?? this.db;
    return exec
      .select()
      .from(representantes)
      .where(and(eq(representantes.id, id), isNull(representantes.deletedAt)))
      .then((r) => r[0] ?? null);
  }

  private async assertCodigoUnico(
    tx: NodePgDatabase<typeof schema>,
    codigo: string,
    idAtual: string | null,
  ): Promise<void> {
    const conflitos = await tx
      .select({ id: representantes.id })
      .from(representantes)
      .where(and(isNull(representantes.deletedAt), eq(representantes.codigo, codigo)));
    for (const c of conflitos) {
      if (idAtual && c.id === idAtual) continue;
      throw new ConflictException('Já existe representante com este código');
    }
  }
}
