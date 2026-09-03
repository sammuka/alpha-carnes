import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, ilike, isNull, or, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../database/database.module';
import * as schema from '../../database/schema';
import { frotaCaminhoes, rotas } from '../../database/schema';
import { AuditoriaService } from '../../common/auditoria/auditoria.service';
import {
  calcularRange, montarPaginado, primeiroOuFalha,
  type ListarCadastroQuery, type Paginado,
} from '../../common/crud/paginacao';
import type { CreateCaminhaoCadastroDto, UpdateCaminhaoCadastroDto } from './dto/caminhao-cadastro.dto';

type CaminhaoCadastro = typeof frotaCaminhoes.$inferSelect;
type CaminhaoCadastroLista = CaminhaoCadastro & { rotaPadraoNome: string | null };

@Injectable()
export class CaminhoesCadastroService {
  constructor(
    @Inject(DRIZZLE) private readonly drizzle: { db: NodePgDatabase<typeof schema> },
    private readonly auditoria: AuditoriaService,
  ) {}

  private get db() {
    return this.drizzle.db;
  }

  async listar(query: ListarCadastroQuery): Promise<Paginado<CaminhaoCadastroLista>> {
    const { limit, offset } = calcularRange(query);
    const filtros = [query.incluirRemovidos ? undefined : isNull(frotaCaminhoes.deletedAt)];
    if (query.search) {
      const termo = `%${query.search}%`;
      filtros.push(or(ilike(frotaCaminhoes.placa, termo), ilike(frotaCaminhoes.descricao, termo)));
    }
    if (query.status) filtros.push(eq(frotaCaminhoes.status, query.status));
    const where = and(...filtros.filter(Boolean));

    const [linhas, totalRow] = await Promise.all([
      this.db
        .select({
          id: frotaCaminhoes.id,
          placa: frotaCaminhoes.placa,
          descricao: frotaCaminhoes.descricao,
          capacidadeKg: frotaCaminhoes.capacidadeKg,
          rotaPadraoId: frotaCaminhoes.rotaPadraoId,
          rotaPadraoNome: rotas.nome,
          status: frotaCaminhoes.status,
          fabricante: frotaCaminhoes.fabricante,
          modelo: frotaCaminhoes.modelo,
          anoFabricacao: frotaCaminhoes.anoFabricacao,
          anoModelo: frotaCaminhoes.anoModelo,
          cor: frotaCaminhoes.cor,
          chassi: frotaCaminhoes.chassi,
          certificadoNumero: frotaCaminhoes.certificadoNumero,
          certificadoCidade: frotaCaminhoes.certificadoCidade,
          certificadoUf: frotaCaminhoes.certificadoUf,
          certificadoData: frotaCaminhoes.certificadoData,
          numeroSeguro: frotaCaminhoes.numeroSeguro,
          kilometragem: frotaCaminhoes.kilometragem,
          taraKg: frotaCaminhoes.taraKg,
          capacidadeM3: frotaCaminhoes.capacidadeM3,
          veiculoProprio: frotaCaminhoes.veiculoProprio,
          nomeProprietario: frotaCaminhoes.nomeProprietario,
          dimensoesJson: frotaCaminhoes.dimensoesJson,
          createdAt: frotaCaminhoes.createdAt,
          updatedAt: frotaCaminhoes.updatedAt,
          deletedAt: frotaCaminhoes.deletedAt,
        })
        .from(frotaCaminhoes)
        .leftJoin(rotas, eq(frotaCaminhoes.rotaPadraoId, rotas.id))
        .where(where)
        .orderBy(desc(frotaCaminhoes.createdAt))
        .limit(limit)
        .offset(offset),
      this.db.select({ total: sql<number>`count(*)::int` }).from(frotaCaminhoes).where(where),
    ]);

    return montarPaginado(linhas, totalRow[0]?.total ?? 0, query);
  }

  async detalhar(id: string): Promise<CaminhaoCadastro> {
    const registro = await this.buscarAtivo(id);
    if (!registro) throw new NotFoundException('Caminhão não encontrado');
    return registro;
  }

  async criar(dto: CreateCaminhaoCadastroDto, usuarioId: string): Promise<CaminhaoCadastro> {
    return this.db.transaction(async (tx) => {
      await this.assertPlacaLivre(tx, dto.placa);

      const rota = await this.resolverRotaPadrao(tx, dto.rotaPadraoId, null);

      const criado = primeiroOuFalha(
        await tx.insert(frotaCaminhoes).values({
          placa: dto.placa,
          descricao: dto.descricao,
          capacidadeKg: dto.capacidadeKg,
          rotaPadraoId: rota?.id ?? null,
          status: dto.status,
          fabricante: dto.fabricante,
          modelo: dto.modelo,
          anoFabricacao: dto.anoFabricacao,
          anoModelo: dto.anoModelo,
          cor: dto.cor,
          chassi: dto.chassi,
          certificadoNumero: dto.certificadoNumero,
          certificadoCidade: dto.certificadoCidade,
          certificadoUf: dto.certificadoUf,
          certificadoData: dto.certificadoData,
          numeroSeguro: dto.numeroSeguro,
          kilometragem: dto.kilometragem,
          taraKg: dto.taraKg,
          capacidadeM3: dto.capacidadeM3,
          veiculoProprio: dto.veiculoProprio,
          nomeProprietario: dto.nomeProprietario,
        }).returning(),
      );

      await this.auditoria.registrar(tx, {
        tabela: 'frota_caminhoes', registroId: criado.id, operacao: 'INSERT',
        modulo: 'cadastros', usuarioId, dadosAnteriores: {}, dadosNovos: criado,
      });
      return criado;
    });
  }

  async atualizar(id: string, dto: UpdateCaminhaoCadastroDto, usuarioId: string): Promise<CaminhaoCadastro> {
    return this.db.transaction(async (tx) => {
      const anterior = await this.buscarAtivo(id, tx);
      if (!anterior) throw new NotFoundException('Caminhão não encontrado');
      if (dto.placa && dto.placa !== anterior.placa) await this.assertPlacaLivre(tx, dto.placa);

      const rota = dto.rotaPadraoId === undefined
        ? null
        : await this.resolverRotaPadrao(tx, dto.rotaPadraoId, anterior.rotaPadraoId);

      const atualizado = primeiroOuFalha(
        await tx.update(frotaCaminhoes).set({
          placa: dto.placa ?? anterior.placa,
          descricao: dto.descricao ?? anterior.descricao,
          capacidadeKg: dto.capacidadeKg ?? anterior.capacidadeKg,
          rotaPadraoId: dto.rotaPadraoId === undefined ? anterior.rotaPadraoId : rota?.id ?? null,
          status: dto.status ?? anterior.status,
          fabricante: dto.fabricante ?? anterior.fabricante,
          modelo: dto.modelo ?? anterior.modelo,
          anoFabricacao: dto.anoFabricacao ?? anterior.anoFabricacao,
          anoModelo: dto.anoModelo ?? anterior.anoModelo,
          cor: dto.cor ?? anterior.cor,
          chassi: dto.chassi ?? anterior.chassi,
          certificadoNumero: dto.certificadoNumero ?? anterior.certificadoNumero,
          certificadoCidade: dto.certificadoCidade ?? anterior.certificadoCidade,
          certificadoUf: dto.certificadoUf ?? anterior.certificadoUf,
          certificadoData: dto.certificadoData ?? anterior.certificadoData,
          numeroSeguro: dto.numeroSeguro ?? anterior.numeroSeguro,
          kilometragem: dto.kilometragem ?? anterior.kilometragem,
          taraKg: dto.taraKg ?? anterior.taraKg,
          capacidadeM3: dto.capacidadeM3 ?? anterior.capacidadeM3,
          veiculoProprio: dto.veiculoProprio ?? anterior.veiculoProprio,
          nomeProprietario: dto.nomeProprietario ?? anterior.nomeProprietario,
        }).where(eq(frotaCaminhoes.id, id)).returning(),
      );

      await this.auditoria.registrar(tx, {
        tabela: 'frota_caminhoes', registroId: id, operacao: 'UPDATE',
        modulo: 'cadastros', usuarioId, dadosAnteriores: anterior, dadosNovos: atualizado,
      });
      return atualizado;
    });
  }

  async remover(id: string, usuarioId: string): Promise<{ id: string; deletedAt: Date }> {
    return this.db.transaction(async (tx) => {
      const anterior = await this.buscarAtivo(id, tx);
      if (!anterior) throw new NotFoundException('Caminhão não encontrado');

      const removido = primeiroOuFalha(
        await tx.update(frotaCaminhoes).set({ deletedAt: new Date() })
          .where(eq(frotaCaminhoes.id, id)).returning(),
      );

      await this.auditoria.registrar(tx, {
        tabela: 'frota_caminhoes', registroId: id, operacao: 'DELETE',
        modulo: 'cadastros', usuarioId, dadosAnteriores: anterior, dadosNovos: removido,
      });
      return { id, deletedAt: removido.deletedAt as Date };
    });
  }

  async restaurar(id: string, usuarioId: string): Promise<CaminhaoCadastro> {
    return this.db.transaction(async (tx) => {
      const anterior = await tx.select().from(frotaCaminhoes)
        .where(eq(frotaCaminhoes.id, id)).then((r) => r[0] ?? null);
      if (!anterior) throw new NotFoundException('Caminhão não encontrado');
      if (!anterior.deletedAt) throw new ConflictException('Caminhão não está removido');
      await this.assertPlacaLivre(tx, anterior.placa);

      const restaurado = primeiroOuFalha(
        await tx.update(frotaCaminhoes).set({ deletedAt: null })
          .where(eq(frotaCaminhoes.id, id)).returning(),
      );

      await this.auditoria.registrar(tx, {
        tabela: 'frota_caminhoes', registroId: id, operacao: 'UPDATE',
        modulo: 'cadastros', usuarioId, dadosAnteriores: anterior, dadosNovos: restaurado,
      });
      return restaurado;
    });
  }

  private async assertPlacaLivre(
    tx: NodePgDatabase<typeof schema>,
    placa: string,
  ): Promise<void> {
    const existente = await tx.select({ id: frotaCaminhoes.id }).from(frotaCaminhoes)
      .where(and(isNull(frotaCaminhoes.deletedAt), eq(frotaCaminhoes.placa, placa)))
      .then((r) => r[0] ?? null);
    if (existente) throw new ConflictException('Já existe caminhão ativo com esta placa');
  }

  private async buscarAtivo(
    id: string,
    tx?: NodePgDatabase<typeof schema>,
  ): Promise<CaminhaoCadastro | null> {
    const exec = tx ?? this.db;
    return exec.select().from(frotaCaminhoes)
      .where(and(eq(frotaCaminhoes.id, id), isNull(frotaCaminhoes.deletedAt)))
      .then((r) => r[0] ?? null);
  }

  private async resolverRotaPadrao(
    tx: NodePgDatabase<typeof schema>,
    id: string | null | undefined,
    idPersistidoAtual: string | null,
  ): Promise<{ id: string } | null> {
    if (id == null) return null;
    const vinculo = await tx.select({ id: rotas.id, status: rotas.status })
      .from(rotas)
      .where(and(eq(rotas.id, id), isNull(rotas.deletedAt)))
      .then((rows) => rows[0] ?? null);
    if (!vinculo || (vinculo.status !== 'ativo' && vinculo.id !== idPersistidoAtual)) {
      throw new BadRequestException({ codigo: 'VINCULO_CADASTRO_INVALIDO', message: 'Rota não encontrada, removida ou inativa' });
    }
    return { id: vinculo.id };
  }
}
