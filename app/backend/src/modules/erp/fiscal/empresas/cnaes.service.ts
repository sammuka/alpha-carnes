import { and, eq, isNull } from 'drizzle-orm';
import { AuditoriaService } from '../../../../common/auditoria/auditoria.service';
import { estabelecimentoCnaes } from '../../../../database/schema';
import type { CnaeItemDto } from './dto/cnae.dto';
import {
  MODULO_AUDITORIA,
  regraViolada,
  type Tx,
} from './fiscal-comum';

export interface AlvoCnae {
  estabelecimentoId: string;
  empresaId: string;
}

function chaveCnae(item: { codigo: string; tipo: string; descricao: string }): string {
  return `${item.codigo}|${item.tipo}|${item.descricao}`;
}

/** Valida principal único e código repetido antes de qualquer escrita (D21, AD-24 (3)). */
export function validarListaCnaes(lista: CnaeItemDto[]): void {
  let principais = 0;
  const codigos = new Set<string>();
  for (const item of lista) {
    if (item.tipo === 'PRINCIPAL') principais += 1;
    if (codigos.has(item.codigo)) {
      regraViolada('CNAE_DUPLICADO', 'CNAE repetido na lista.', { cnae: item.codigo });
    }
    codigos.add(item.codigo);
  }
  if (principais > 1) {
    regraViolada('CNAE_PRINCIPAL_UNICO', 'Informe apenas um CNAE principal.');
  }
}

/**
 * Aplica a lista por diferença: soft delete do que saiu, insert do que entrou.
 * Linhas idênticas permanecem. A ordem evita violar o índice do principal.
 */
export async function substituirCnaes(
  tx: Tx,
  auditoria: AuditoriaService,
  alvo: AlvoCnae,
  lista: CnaeItemDto[],
  usuarioId: string,
  justificativa: string,
): Promise<void> {
  validarListaCnaes(lista);
  const vigentes = await tx
    .select()
    .from(estabelecimentoCnaes)
    .where(and(
      eq(estabelecimentoCnaes.estabelecimentoId, alvo.estabelecimentoId),
      isNull(estabelecimentoCnaes.deletedAt),
    ));

  const desejadas = new Set(lista.map(chaveCnae));
  const agora = new Date();

  for (const vigente of vigentes) {
    if (desejadas.has(chaveCnae(vigente))) continue;
    const [removida] = await tx
      .update(estabelecimentoCnaes)
      .set({ deletedAt: agora, atualizadoPorId: usuarioId, updatedAt: agora })
      .where(eq(estabelecimentoCnaes.id, vigente.id))
      .returning();
    await auditoria.registrar(tx, {
      tabela: 'estabelecimento_cnaes',
      registroId: vigente.id,
      operacao: 'DELETE',
      modulo: MODULO_AUDITORIA,
      usuarioId,
      dadosAnteriores: vigente,
      dadosNovos: removida,
      justificativa,
    });
  }

  const mantidas = new Set(
    vigentes.filter((vigente) => desejadas.has(chaveCnae(vigente))).map(chaveCnae),
  );
  for (const item of lista) {
    if (mantidas.has(chaveCnae(item))) continue;
    const [criada] = await tx
      .insert(estabelecimentoCnaes)
      .values({
        estabelecimentoId: alvo.estabelecimentoId,
        empresaId: alvo.empresaId,
        codigo: item.codigo,
        descricao: item.descricao,
        tipo: item.tipo,
        criadoPorId: usuarioId,
        atualizadoPorId: usuarioId,
      })
      .returning();
    if (!criada) throw new Error('Falha ao gravar CNAE');
    await auditoria.registrar(tx, {
      tabela: 'estabelecimento_cnaes',
      registroId: criada.id,
      operacao: 'INSERT',
      modulo: MODULO_AUDITORIA,
      usuarioId,
      dadosNovos: criada,
      justificativa,
    });
  }
}
