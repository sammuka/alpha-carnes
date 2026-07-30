import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { and, asc, desc, eq, isNull, lt, or, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../../database/database.module';
import * as schema from '../../../database/schema';
import {
  produtos,
  tabelasPreco,
  tabelasPrecoItens,
  tabelasPrecoPublicacoes,
} from '../../../database/schema';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import {
  calcularRange,
  montarPaginado,
  primeiroOuFalha,
  type ListarQuery,
  type Paginado,
} from '../../../common/crud/paginacao';
import { EVENTOS } from '../../../realtime/events/eventos';
import type {
  CopiarTabelaPrecoDto,
  CriarTabelaPrecoDto,
  PublicarTabelaPrecoDto,
  SalvarItensTabelaPrecoDto,
} from './dto/tabela-preco.dto';

// Alias local por arquivo, convenção do repositório (`disponibilidade.service.ts:12`).
type Tx = NodePgDatabase<typeof schema>;
type TabelaPreco = typeof tabelasPreco.$inferSelect;

type FaixasDePreco = {
  precoA: string | null; precoB: string | null;
  precoC: string | null; precoD: string | null;
};
type MapaDePrecos = Map<string, FaixasDePreco>;

@Injectable()
export class PrecosService {
  constructor(
    @Inject(DRIZZLE) private readonly drizzle: { db: NodePgDatabase<typeof schema> },
    private readonly auditoria: AuditoriaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  private get db() {
    return this.drizzle.db;
  }

  async listar(query: ListarQuery): Promise<Paginado<TabelaPreco>> {
    const { limit, offset } = calcularRange(query);
    const where = query.incluirRemovidos ? undefined : isNull(tabelasPreco.deletedAt);
    const [linhas, totalRow] = await Promise.all([
      this.db.select().from(tabelasPreco).where(where)
        .orderBy(desc(tabelasPreco.data)).limit(limit).offset(offset),
      this.db.select({ total: sql<number>`count(*)::int` }).from(tabelasPreco).where(where),
    ]);
    return montarPaginado(linhas, totalRow[0]?.total ?? 0, query);
  }

  /** D30 — histórico append-only da tabela. 404 explícito se a tabela não existe. */
  async historico(id: string) {
    const [tabela] = await this.db.select({ id: tabelasPreco.id }).from(tabelasPreco)
      .where(and(eq(tabelasPreco.id, id), isNull(tabelasPreco.deletedAt)))
      .limit(1);
    if (!tabela) throw new NotFoundException('Tabela de preços não encontrada');
    return this.db.select().from(tabelasPrecoPublicacoes)
      .where(eq(tabelasPrecoPublicacoes.tabelaPrecoId, id))
      .orderBy(desc(tabelasPrecoPublicacoes.criadoEm));
  }

  async criar(dto: CriarTabelaPrecoDto, usuarioId: string) {
    const criada = await this.db.transaction(async (tx) => {
      const [existente] = await tx.select({ id: tabelasPreco.id }).from(tabelasPreco)
        .where(and(eq(tabelasPreco.data, dto.data), isNull(tabelasPreco.deletedAt)));
      if (existente) {
        throw new ConflictException({
          code: 'TABELA_PRECO_DUPLICADA',
          message: `Já existe tabela de preços para ${dto.data}.`,
        });
      }
      // `primeiroOuFalha` porque sob `noUncheckedIndexedAccess` o `.returning()` é `T[]`
      // e `linhas[0]` é `T | undefined` — mesmo padrão de `PedidosService.criar`.
      const tabela = primeiroOuFalha(
        await tx.insert(tabelasPreco)
          .values({ data: dto.data, observacao: dto.observacao }).returning(),
        'Criação da tabela de preços não retornou registro',
      );
      const catalogo = await tx.select({ id: produtos.id }).from(produtos)
        .where(and(eq(produtos.status, 'ativo'), eq(produtos.ativoVenda, true),
                   isNull(produtos.deletedAt)));
      const base = await this.precosDaUltimaPublicada(tx);
      if (catalogo.length > 0) {
        await tx.insert(tabelasPrecoItens).values(catalogo.map((p) => ({
          tabelaPrecoId: tabela.id,
          produtoId: p.id,
          precoA: base.get(p.id)?.precoA ?? null,
          precoB: base.get(p.id)?.precoB ?? null,
          precoC: base.get(p.id)?.precoC ?? null,
          precoD: base.get(p.id)?.precoD ?? null,
        })));
      }
      await this.auditoria.registrar(tx, {
        tabela: 'tabelas_preco', registroId: tabela.id, operacao: 'INSERT',
        modulo: 'comercial.precos', usuarioId, dadosNovos: { data: dto.data },
      });
      return tabela;
    });
    // `detalhar` lê por `this.db`, que é OUTRA conexão do pool: chamado de dentro da transação
    // ele não enxergaria as linhas ainda não commitadas e lançaria 404, revertendo a criação
    // inteira. A leitura vai depois do commit — mesmo padrão de `publicar` e `salvarItens`.
    return this.detalhar(criada.id);
  }

  /** `salvarItens` faz o upsert dos preços; tabela publicada volta ao rascunho (D16). */
  async salvarItens(id: string, dto: SalvarItensTabelaPrecoDto, usuarioId: string) {
    await this.db.transaction(async (tx) => {
      const tabela = await this.exigirTabela(tx, id);
      for (const item of dto.itens) {
        // Colunas NUMERIC chegam como string no driver do Postgres; o DTO valida com
        // `z.coerce.number()` (mensagens de erro melhores), então a conversão é só aqui,
        // no limite com o banco — mesmo padrão de `compras-programadas.service.ts:201`.
        const faixas = {
          precoA: item.precoA != null ? String(item.precoA) : null,
          precoB: item.precoB != null ? String(item.precoB) : null,
          precoC: item.precoC != null ? String(item.precoC) : null,
          precoD: item.precoD != null ? String(item.precoD) : null,
        };
        await tx.insert(tabelasPrecoItens)
          .values({ tabelaPrecoId: id, produtoId: item.produtoId, ...faixas })
          .onConflictDoUpdate({
            // uq_tabelas_preco_itens_produto é índice TOTAL (a tabela é linha-filha e não tem
            // deleted_at, ver 0016) — logo não leva targetWhere, ao contrário de uq_tabelas_preco_data.
            target: [tabelasPrecoItens.tabelaPrecoId, tabelasPrecoItens.produtoId],
            set: { ...faixas, updatedAt: new Date() },
          });
      }
      if (tabela.status === 'publicada') {
        await tx.update(tabelasPreco)
          .set({ status: 'rascunho', publicadaPor: null, publicadaEm: null, updatedAt: new Date() })
          .where(eq(tabelasPreco.id, id));
        await tx.insert(tabelasPrecoPublicacoes).values({
          tabelaPrecoId: id, acao: 'revertida_para_rascunho', autorId: usuarioId,
          observacao: 'Edição de tabela publicada (D16).',
        });
      }
      await this.auditoria.registrar(tx, {
        tabela: 'tabelas_preco', registroId: id, operacao: 'UPDATE',
        modulo: 'comercial.precos', usuarioId,
        dadosAnteriores: { status: tabela.status },
        dadosNovos: { status: 'rascunho', produtosAlterados: dto.itens.map((i) => i.produtoId) },
      });
    });
    return this.detalhar(id);
  }

  /**
   * `copiar` implementa a ação "Copiar tabela anterior" do protótipo
   * (`TabelaPrecos.tsx:158-162`) com as três regras de D14: origem, sobrescrita e destino publicado.
   */
  async copiar(id: string, dto: CopiarTabelaPrecoDto, usuarioId: string) {
    await this.db.transaction(async (tx) => {
      const destino = await this.exigirTabela(tx, id);
      if (dto.origemId === id) {
        throw new BadRequestException({
          code: 'COPIA_ORIGEM_IGUAL_AO_DESTINO',
          message: 'A origem da cópia não pode ser a própria tabela.',
        });
      }
      // Sem `origemId`, a origem é a última publicada ANTERIOR à data do destino — é o
      // "Copiar tabela anterior" do protótipo, e o recorte por data também impede a tabela
      // publicada de copiar a si mesma quando é a mais recente do banco.
      const origem = dto.origemId
        ? await this.precosDaTabela(tx, dto.origemId)
        : await this.precosDaUltimaPublicada(tx, destino.data);
      if (origem.size === 0) {
        throw new ConflictException({
          code: 'SEM_TABELA_PRECO_ANTERIOR',
          message: dto.origemId
            ? 'A tabela de origem não tem linhas para copiar.'
            : 'Não existe tabela de preços publicada anterior para copiar.',
        });
      }
      // Sobrescrita por produto presente na origem, inclusive com `null` (RA-06: copiar a
      // ausência de preço é o dado real da origem). Produto do destino que a origem não tem
      // fica intacto, e produto da origem que não está na grade do destino é ignorado — a
      // grade do destino é o catálogo ativo montado em `criar` e a cópia não cria linha nova.
      for (const [produtoId, faixas] of origem) {
        await tx.update(tabelasPrecoItens)
          .set({ ...faixas, updatedAt: new Date() })
          .where(and(
            eq(tabelasPrecoItens.tabelaPrecoId, id),
            eq(tabelasPrecoItens.produtoId, produtoId),
          ));
      }
      // Destino publicado volta ao rascunho, exatamente como no protótipo
      // (`TabelaPrecos.tsx:160`) e pela mesma regra de D16 que `salvarItens` aplica.
      if (destino.status === 'publicada') {
        await tx.update(tabelasPreco)
          .set({ status: 'rascunho', publicadaPor: null, publicadaEm: null, updatedAt: new Date() })
          .where(eq(tabelasPreco.id, id));
        await tx.insert(tabelasPrecoPublicacoes).values({
          tabelaPrecoId: id, acao: 'revertida_para_rascunho', autorId: usuarioId,
          observacao: 'Cópia de tabela anterior sobre tabela publicada (D14/D16).',
        });
      }
      await this.auditoria.registrar(tx, {
        tabela: 'tabelas_preco', registroId: id, operacao: 'UPDATE',
        modulo: 'comercial.precos', usuarioId,
        dadosAnteriores: { status: destino.status },
        dadosNovos: {
          acao: 'copiar_tabela_anterior',
          origemId: dto.origemId ?? null,
          status: 'rascunho',
          produtosCopiados: [...origem.keys()],
        },
      });
    });
    // A cópia não emite evento: nada foi publicado. `detalhar` fica fora da transação
    // pela mesma razão de `criar`.
    return this.detalhar(id);
  }

  /** `publicar` valida a completude da grade antes de escrever. */
  async publicar(id: string, dto: PublicarTabelaPrecoDto, usuarioId: string) {
    const publicada = await this.db.transaction(async (tx) => {
      const tabela = await this.exigirTabela(tx, id);
      const incompletos = await tx
        .select({ codigo: produtos.codigo, nome: produtos.nome })
        .from(tabelasPrecoItens)
        .innerJoin(produtos, eq(tabelasPrecoItens.produtoId, produtos.id))
        .where(and(eq(tabelasPrecoItens.tabelaPrecoId, id), or(
          isNull(tabelasPrecoItens.precoA), isNull(tabelasPrecoItens.precoB),
          isNull(tabelasPrecoItens.precoC), isNull(tabelasPrecoItens.precoD),
        )));
      if (incompletos.length > 0) {
        throw new BadRequestException({
          code: 'PRECOS_INCOMPLETOS',
          message: 'Todos os produtos precisam das quatro faixas preenchidas para publicar.',
          produtos: incompletos,
        });
      }
      await tx.update(tabelasPreco)
        .set({ status: 'publicada', publicadaPor: usuarioId, publicadaEm: new Date(),
               updatedAt: new Date() })
        .where(eq(tabelasPreco.id, id));
      await tx.insert(tabelasPrecoPublicacoes)
        .values({ tabelaPrecoId: id, acao: 'publicada', autorId: usuarioId,
                  observacao: dto.observacao });
      await this.auditoria.registrar(tx, {
        tabela: 'tabelas_preco', registroId: id, operacao: 'UPDATE',
        modulo: 'comercial.precos', usuarioId,
        dadosAnteriores: { status: tabela.status }, dadosNovos: { status: 'publicada' },
      });
      return { id, data: tabela.data };
    });
    // Evento pós-commit com EventEmitter2 injetado — padrão real do repositório
    // (não existe RealtimeService.emitir). RA-04 / DoD-93.
    this.eventEmitter.emit(EVENTOS.TABELA_PRECO_PUBLICADA, {
      tabelaPrecoId: publicada.id, data: publicada.data, autorId: usuarioId,
    });
    return this.detalhar(id);
  }

  /** Leitura da tabela com a grade completa e o histórico. Preço ausente permanece null (RA-06). */
  async detalhar(id: string) {
    const [tabela] = await this.db.select().from(tabelasPreco)
      .where(and(eq(tabelasPreco.id, id), isNull(tabelasPreco.deletedAt)))
      .limit(1);
    if (!tabela) throw new NotFoundException('Tabela de preços não encontrada');
    const itens = await this.db
      .select({
        produtoId: produtos.id,
        codigo: produtos.codigo,
        nome: produtos.nome,
        unidadePreco: produtos.unidadePreco,
        provisorio: sql<boolean>`coalesce((${produtos.atributosJson}->>'provisorio')::boolean, false)`,
        precoA: tabelasPrecoItens.precoA, precoB: tabelasPrecoItens.precoB,
        precoC: tabelasPrecoItens.precoC, precoD: tabelasPrecoItens.precoD,
      })
      .from(tabelasPrecoItens)
      .innerJoin(produtos, eq(tabelasPrecoItens.produtoId, produtos.id))
      .where(eq(tabelasPrecoItens.tabelaPrecoId, id))
      .orderBy(asc(produtos.codigo));
    const historico = await this.db.select().from(tabelasPrecoPublicacoes)
      .where(eq(tabelasPrecoPublicacoes.tabelaPrecoId, id))
      .orderBy(desc(tabelasPrecoPublicacoes.criadoEm));
    return { ...tabela, itens, historico };
  }

  /** Preços de uma tabela específica, indexados por produto. Falha se a tabela não existe. */
  private async precosDaTabela(tx: Tx, tabelaPrecoId: string): Promise<MapaDePrecos> {
    const [origem] = await tx.select({ id: tabelasPreco.id }).from(tabelasPreco)
      .where(and(eq(tabelasPreco.id, tabelaPrecoId), isNull(tabelasPreco.deletedAt)))
      .limit(1);
    if (!origem) throw new NotFoundException('Tabela de preços de origem não encontrada');
    const linhas = await tx
      .select({
        produtoId: tabelasPrecoItens.produtoId,
        precoA: tabelasPrecoItens.precoA, precoB: tabelasPrecoItens.precoB,
        precoC: tabelasPrecoItens.precoC, precoD: tabelasPrecoItens.precoD,
      })
      .from(tabelasPrecoItens)
      .where(eq(tabelasPrecoItens.tabelaPrecoId, origem.id));
    return new Map(linhas.map((l) => [l.produtoId, {
      precoA: l.precoA, precoB: l.precoB, precoC: l.precoC, precoD: l.precoD,
    }]));
  }

  /**
   * Preços da última tabela publicada, indexados por produto. Vazio se nunca houve publicação.
   * `anteriorA` restringe a busca às tabelas com data menor — usado por `copiar`; `criar` não
   * passa nada porque a tabela do dia acabou de nascer em `rascunho`.
   */
  private async precosDaUltimaPublicada(tx: Tx, anteriorA?: string): Promise<MapaDePrecos> {
    const [ultima] = await tx.select({ id: tabelasPreco.id }).from(tabelasPreco)
      .where(and(
        eq(tabelasPreco.status, 'publicada'),
        isNull(tabelasPreco.deletedAt),
        ...(anteriorA ? [lt(tabelasPreco.data, anteriorA)] : []),
      ))
      .orderBy(desc(tabelasPreco.data))
      .limit(1);
    if (!ultima) return new Map();
    return this.precosDaTabela(tx, ultima.id);
  }

  /** Carrega a tabela sob lock de linha ou falha alto. Nunca devolve undefined mascarado. */
  private async exigirTabela(tx: Tx, id: string) {
    const [tabela] = await tx.select().from(tabelasPreco)
      .where(and(eq(tabelasPreco.id, id), isNull(tabelasPreco.deletedAt)))
      .for('update')
      .limit(1);
    if (!tabela) throw new NotFoundException('Tabela de preços não encontrada');
    return tabela;
  }
}
