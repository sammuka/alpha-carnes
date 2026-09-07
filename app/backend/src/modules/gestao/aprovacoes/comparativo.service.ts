import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq, inArray } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { subtrairQtd } from '../../../common/crud/decimal';
import { DRIZZLE } from '../../../database/database.module';
import * as schema from '../../../database/schema';
import {
  conclusoesConferencia,
  produtos,
  ocorrenciasFornecedor,
  usuarios,
} from '../../../database/schema';

interface QuadroItem {
  produtoId: string;
  qtdPedido: string;
  qtdNf: string;
  qtdApurada: string;
  pesoNf: string | null;
  pesoApurado: string | null;
  situacao: string;
}

@Injectable()
export class ComparativoService {
  constructor(
    @Inject(DRIZZLE)
    private readonly drizzle: { db: NodePgDatabase<typeof schema> },
  ) {}

  private get db() {
    return this.drizzle.db;
  }

  async doOcorrencia(ocorrenciaId: string) {
    const ocorrencia = await this.db.select().from(ocorrenciasFornecedor)
      .where(eq(ocorrenciasFornecedor.id, ocorrenciaId))
      .then((r) => r[0]);
    if (!ocorrencia) throw new NotFoundException('Ocorrência não encontrada');
    if (!ocorrencia.conclusaoConferenciaId) {
      throw new NotFoundException({
        codigo: 'CONCLUSAO_INEXISTENTE',
        mensagem: 'Ocorrência sem conferência tripla concluída; não há comparativo histórico.',
      });
    }

    const conclusao = await this.db.select({
      id: conclusoesConferencia.id,
      quadroJson: conclusoesConferencia.quadroJson,
      resultado: conclusoesConferencia.resultado,
      concluidaEm: conclusoesConferencia.concluidaEm,
      concluidaPorNome: usuarios.nome,
    })
      .from(conclusoesConferencia)
      .leftJoin(usuarios, eq(usuarios.id, conclusoesConferencia.concluidaPorId))
      .where(eq(conclusoesConferencia.id, ocorrencia.conclusaoConferenciaId))
      .then((r) => r[0]);
    if (!conclusao) throw new NotFoundException('Conclusão de conferência não encontrada');

    const itens = conclusao.quadroJson as QuadroItem[];
    const catalogo = await this.db.select({
      id: produtos.id, codigo: produtos.codigo, descricao: produtos.nome,
    }).from(produtos)
      .where(inArray(produtos.id, itens.map((i) => i.produtoId)));

    return {
      conclusaoId: conclusao.id,
      imutavel: true,
      resultado: conclusao.resultado,
      concluidaEm: conclusao.concluidaEm.toISOString(),
      concluidaPorNome: conclusao.concluidaPorNome ?? null,
      itens: itens.map((i) => {
        const produto = catalogo.find((c) => c.id === i.produtoId) ?? null;
        return {
          produtoId: i.produtoId,
          codigo: produto?.codigo ?? null,
          descricao: produto?.descricao ?? null,
          qtdPedido: i.qtdPedido,
          qtdNf: i.qtdNf,
          qtdApurada: i.qtdApurada,
          pesoNf: i.pesoNf,
          pesoApurado: i.pesoApurado,
          difQtd: subtrairQtd(i.qtdApurada, i.qtdNf),
          difPeso: i.pesoNf !== null && i.pesoApurado !== null
            ? subtrairQtd(i.pesoApurado, i.pesoNf) : null,
          situacao: i.situacao,
        };
      }),
    };
  }
}
