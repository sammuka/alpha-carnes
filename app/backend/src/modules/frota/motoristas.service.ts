import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, ilike, isNull, or, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../database/database.module';
import * as schema from '../../database/schema';
import { frotaCaminhoes, frotaMotoristas } from '../../database/schema';
import { AuditoriaService } from '../../common/auditoria/auditoria.service';
import {
  calcularRange, montarPaginado, primeiroOuFalha,
  type ListarCadastroQuery, type Paginado,
} from '../../common/crud/paginacao';
import type { CreateMotoristaDto, UpdateMotoristaDto } from './dto/motorista.dto';

type Motorista = typeof frotaMotoristas.$inferSelect;
type MotoristaLista = Motorista & {
  caminhaoPadraoPlaca: string | null;
  caminhaoPadraoAtivo: boolean | null;
};

@Injectable()
export class MotoristasService {
  constructor(
    @Inject(DRIZZLE) private readonly drizzle: { db: NodePgDatabase<typeof schema> },
    private readonly auditoria: AuditoriaService,
  ) {}

  private get db() {
    return this.drizzle.db;
  }

  async listar(query: ListarCadastroQuery): Promise<Paginado<MotoristaLista>> {
    const { limit, offset } = calcularRange(query);
    const filtros = [query.incluirRemovidos ? undefined : isNull(frotaMotoristas.deletedAt)];
    if (query.search) {
      const termo = `%${query.search}%`;
      filtros.push(
        or(
          ilike(frotaMotoristas.nome, termo),
          ilike(frotaMotoristas.documento, termo),
          ilike(frotaMotoristas.telefone, termo),
        ),
      );
    }
    if (query.status) filtros.push(eq(frotaMotoristas.status, query.status));
    const where = and(...filtros.filter(Boolean));

    const [linhas, totalRow] = await Promise.all([
      this.db
        .select({
          id: frotaMotoristas.id,
          nome: frotaMotoristas.nome,
          documento: frotaMotoristas.documento,
          telefone: frotaMotoristas.telefone,
          caminhaoPadraoId: frotaMotoristas.caminhaoPadraoId,
          caminhaoPadraoPlaca: frotaCaminhoes.placa,
          caminhaoPadraoAtivo: sql<boolean | null>`${frotaCaminhoes.deletedAt} IS NULL`,
          status: frotaMotoristas.status,
          rg: frotaMotoristas.rg,
          carteiraProfissional: frotaMotoristas.carteiraProfissional,
          nacionalidade: frotaMotoristas.nacionalidade,
          carteiraHabilitacao: frotaMotoristas.carteiraHabilitacao,
          validadeHabilitacao: frotaMotoristas.validadeHabilitacao,
          emissaoHabilitacao: frotaMotoristas.emissaoHabilitacao,
          dataPrimeiraHabilitacao: frotaMotoristas.dataPrimeiraHabilitacao,
          celular: frotaMotoristas.celular,
          contato: frotaMotoristas.contato,
          email: frotaMotoristas.email,
          tipoVinculo: frotaMotoristas.tipoVinculo,
          inicioVinculo: frotaMotoristas.inicioVinculo,
          enderecoJson: frotaMotoristas.enderecoJson,
          fornecedorLegadoId: frotaMotoristas.fornecedorLegadoId,
          createdAt: frotaMotoristas.createdAt,
          updatedAt: frotaMotoristas.updatedAt,
          deletedAt: frotaMotoristas.deletedAt,
        })
        .from(frotaMotoristas)
        .leftJoin(frotaCaminhoes, eq(frotaMotoristas.caminhaoPadraoId, frotaCaminhoes.id))
        .where(where)
        .orderBy(desc(frotaMotoristas.createdAt))
        .limit(limit)
        .offset(offset),
      this.db.select({ total: sql<number>`count(*)::int` }).from(frotaMotoristas).where(where),
    ]);

    return montarPaginado(linhas, totalRow[0]?.total ?? 0, query);
  }

  async detalhar(id: string): Promise<Motorista> {
    const registro = await this.buscarAtivo(id);
    if (!registro) throw new NotFoundException('Motorista não encontrado');
    return registro;
  }

  async criar(dto: CreateMotoristaDto, usuarioId: string): Promise<Motorista> {
    return this.db.transaction(async (tx) => {
      await this.assertDocumentoLivre(tx, dto.documento);

      const caminhao = await this.resolverCaminhaoPadrao(tx, dto.caminhaoPadraoId, null);

      const criado = primeiroOuFalha(
        await tx.insert(frotaMotoristas).values({
          nome: dto.nome,
          documento: dto.documento,
          telefone: dto.telefone,
          caminhaoPadraoId: caminhao?.id ?? null,
          status: dto.status,
          rg: dto.rg,
          carteiraProfissional: dto.carteiraProfissional,
          nacionalidade: dto.nacionalidade,
          carteiraHabilitacao: dto.carteiraHabilitacao,
          validadeHabilitacao: dto.validadeHabilitacao,
          emissaoHabilitacao: dto.emissaoHabilitacao,
          dataPrimeiraHabilitacao: dto.dataPrimeiraHabilitacao,
          celular: dto.celular,
          contato: dto.contato,
          email: dto.email,
          tipoVinculo: dto.tipoVinculo,
          inicioVinculo: dto.inicioVinculo,
        }).returning(),
      );

      await this.auditoria.registrar(tx, {
        tabela: 'frota_motoristas', registroId: criado.id, operacao: 'INSERT',
        modulo: 'cadastros', usuarioId, dadosAnteriores: {}, dadosNovos: criado,
      });
      return criado;
    });
  }

  async atualizar(id: string, dto: UpdateMotoristaDto, usuarioId: string): Promise<Motorista> {
    return this.db.transaction(async (tx) => {
      const anterior = await this.buscarAtivo(id, tx);
      if (!anterior) throw new NotFoundException('Motorista não encontrado');
      if (dto.documento && dto.documento !== anterior.documento) {
        await this.assertDocumentoLivre(tx, dto.documento);
      }

      const caminhao = dto.caminhaoPadraoId === undefined
        ? null
        : await this.resolverCaminhaoPadrao(tx, dto.caminhaoPadraoId, anterior.caminhaoPadraoId);

      const atualizado = primeiroOuFalha(
        await tx.update(frotaMotoristas).set({
          nome: dto.nome ?? anterior.nome,
          documento: dto.documento ?? anterior.documento,
          telefone: dto.telefone ?? anterior.telefone,
          caminhaoPadraoId: dto.caminhaoPadraoId === undefined ? anterior.caminhaoPadraoId : caminhao?.id ?? null,
          status: dto.status ?? anterior.status,
          rg: dto.rg ?? anterior.rg,
          carteiraProfissional: dto.carteiraProfissional ?? anterior.carteiraProfissional,
          nacionalidade: dto.nacionalidade ?? anterior.nacionalidade,
          carteiraHabilitacao: dto.carteiraHabilitacao ?? anterior.carteiraHabilitacao,
          validadeHabilitacao: dto.validadeHabilitacao ?? anterior.validadeHabilitacao,
          emissaoHabilitacao: dto.emissaoHabilitacao ?? anterior.emissaoHabilitacao,
          dataPrimeiraHabilitacao: dto.dataPrimeiraHabilitacao ?? anterior.dataPrimeiraHabilitacao,
          celular: dto.celular ?? anterior.celular,
          contato: dto.contato ?? anterior.contato,
          email: dto.email ?? anterior.email,
          tipoVinculo: dto.tipoVinculo ?? anterior.tipoVinculo,
          inicioVinculo: dto.inicioVinculo ?? anterior.inicioVinculo,
        }).where(eq(frotaMotoristas.id, id)).returning(),
      );

      await this.auditoria.registrar(tx, {
        tabela: 'frota_motoristas', registroId: id, operacao: 'UPDATE',
        modulo: 'cadastros', usuarioId, dadosAnteriores: anterior, dadosNovos: atualizado,
      });
      return atualizado;
    });
  }

  async remover(id: string, usuarioId: string): Promise<{ id: string; deletedAt: Date }> {
    return this.db.transaction(async (tx) => {
      const anterior = await this.buscarAtivo(id, tx);
      if (!anterior) throw new NotFoundException('Motorista não encontrado');

      const removido = primeiroOuFalha(
        await tx.update(frotaMotoristas).set({ deletedAt: new Date() })
          .where(eq(frotaMotoristas.id, id)).returning(),
      );

      await this.auditoria.registrar(tx, {
        tabela: 'frota_motoristas', registroId: id, operacao: 'DELETE',
        modulo: 'cadastros', usuarioId, dadosAnteriores: anterior, dadosNovos: removido,
      });
      return { id, deletedAt: removido.deletedAt as Date };
    });
  }

  async restaurar(id: string, usuarioId: string): Promise<Motorista> {
    return this.db.transaction(async (tx) => {
      const anterior = await tx.select().from(frotaMotoristas)
        .where(eq(frotaMotoristas.id, id)).then((r) => r[0] ?? null);
      if (!anterior) throw new NotFoundException('Motorista não encontrado');
      if (!anterior.deletedAt) throw new ConflictException('Motorista não está removido');
      await this.assertDocumentoLivre(tx, anterior.documento);

      const restaurado = primeiroOuFalha(
        await tx.update(frotaMotoristas).set({ deletedAt: null })
          .where(eq(frotaMotoristas.id, id)).returning(),
      );

      await this.auditoria.registrar(tx, {
        tabela: 'frota_motoristas', registroId: id, operacao: 'UPDATE',
        modulo: 'cadastros', usuarioId, dadosAnteriores: anterior, dadosNovos: restaurado,
      });
      return restaurado;
    });
  }

  private async assertDocumentoLivre(
    tx: NodePgDatabase<typeof schema>,
    documento: string,
  ): Promise<void> {
    const existente = await tx.select({ id: frotaMotoristas.id }).from(frotaMotoristas)
      .where(and(isNull(frotaMotoristas.deletedAt), eq(frotaMotoristas.documento, documento)))
      .then((r) => r[0] ?? null);
    if (existente) throw new ConflictException('Já existe motorista ativo com este documento');
  }

  private async buscarAtivo(
    id: string,
    tx?: NodePgDatabase<typeof schema>,
  ): Promise<Motorista | null> {
    const exec = tx ?? this.db;
    return exec.select().from(frotaMotoristas)
      .where(and(eq(frotaMotoristas.id, id), isNull(frotaMotoristas.deletedAt)))
      .then((r) => r[0] ?? null);
  }

  private async resolverCaminhaoPadrao(
    tx: NodePgDatabase<typeof schema>,
    id: string | null | undefined,
    idPersistidoAtual: string | null,
  ): Promise<{ id: string } | null> {
    if (id == null) return null;
    const vinculo = await tx.select({ id: frotaCaminhoes.id, status: frotaCaminhoes.status })
      .from(frotaCaminhoes)
      .where(and(eq(frotaCaminhoes.id, id), isNull(frotaCaminhoes.deletedAt)))
      .then((rows) => rows[0] ?? null);
    if (!vinculo || (vinculo.status !== 'ativo' && vinculo.id !== idPersistidoAtual)) {
      throw new BadRequestException({ codigo: 'VINCULO_CADASTRO_INVALIDO', message: 'Caminhão não encontrado, removido ou inativo' });
    }
    return { id: vinculo.id };
  }
}
