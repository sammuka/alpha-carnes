import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { and, desc, eq, isNull } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { formatarQtd } from '../../../common/crud/decimal';
import { primeiroOuFalha } from '../../../common/crud/paginacao';
import type { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import * as schema from '../../../database/schema';
import {
  notasFiscaisFornecedor,
  notasFiscaisFornecedorItens,
  pedidosFornecedor,
  pedidosFornecedorItens,
  recebimentos,
} from '../../../database/schema';
import type { AtualizarNfeDto, IniciarRecebimentoDto } from './dto/recebimento.dto';
import type { RegistrarNfDto } from './dto/pedido-fornecedor.dto';

type Tx = NodePgDatabase<typeof schema>;
type NfCamposUi = Pick<
  AtualizarNfeDto,
  | 'nfeNumero'
  | 'nfeSerie'
  | 'nfeChave'
  | 'nfeDataEmissao'
  | 'nfePesoBruto'
  | 'nfePesoLiquido'
  | 'nfeVolumes'
>;

export function temCamposNfEstruturados(dto: Partial<NfCamposUi>): boolean {
  return (
    dto.nfeNumero !== undefined
    || dto.nfeSerie !== undefined
    || dto.nfeChave !== undefined
    || dto.nfeDataEmissao !== undefined
    || dto.nfePesoBruto !== undefined
    || dto.nfePesoLiquido !== undefined
    || dto.nfeVolumes !== undefined
  );
}

export function mapearCamposNfParaRegistrar(
  dto: Partial<NfCamposUi>,
  recebimentoId: string,
  itens: RegistrarNfDto['itens'],
): RegistrarNfDto {
  if (!dto.nfeNumero?.trim()) {
    throw new BadRequestException('nfeNumero é obrigatório para persistir NF estruturada');
  }
  const payload: Record<string, unknown> = {};
  if (dto.nfeVolumes !== undefined) payload.volumes = dto.nfeVolumes;
  // Preferência: peso bruto; se só líquido vier, usa líquido como total declarado.
  const pesoTotalDeclarado = dto.nfePesoBruto ?? dto.nfePesoLiquido;
  return {
    numero: dto.nfeNumero.trim(),
    serie: dto.nfeSerie,
    chave: dto.nfeChave,
    dataEmissao: dto.nfeDataEmissao,
    pesoTotalDeclarado,
    payload: Object.keys(payload).length > 0 ? payload : undefined,
    itens,
    recebimentoId,
  };
}

export async function derivarItensNfDoPedido(
  tx: Tx,
  pedidoFornecedorId: string,
): Promise<RegistrarNfDto['itens']> {
  const itens = await tx
    .select({
      itemComercialId: pedidosFornecedorItens.itemComercialId,
      quantidadePrevista: pedidosFornecedorItens.quantidadePrevista,
    })
    .from(pedidosFornecedorItens)
    .where(and(
      eq(pedidosFornecedorItens.pedidoFornecedorId, pedidoFornecedorId),
      isNull(pedidosFornecedorItens.deletedAt),
    ));
  if (!itens.length) {
    throw new ConflictException('Pedido ao fornecedor sem itens para derivar NF');
  }
  return itens.map((item) => ({
    itemComercialId: item.itemComercialId,
    quantidadeDeclarada: Number(item.quantidadePrevista),
  }));
}

async function softDeleteNfAtiva(tx: Tx, recebimentoId: string): Promise<void> {
  const existentes = await tx
    .select({ id: notasFiscaisFornecedor.id })
    .from(notasFiscaisFornecedor)
    .where(and(
      eq(notasFiscaisFornecedor.recebimentoId, recebimentoId),
      isNull(notasFiscaisFornecedor.deletedAt),
    ));
  const agora = new Date();
  for (const nf of existentes) {
    await tx
      .update(notasFiscaisFornecedorItens)
      .set({ deletedAt: agora })
      .where(and(
        eq(notasFiscaisFornecedorItens.nfId, nf.id),
        isNull(notasFiscaisFornecedorItens.deletedAt),
      ));
    await tx
      .update(notasFiscaisFornecedor)
      .set({ deletedAt: agora })
      .where(eq(notasFiscaisFornecedor.id, nf.id));
  }
}

export async function buscarNfAtivaDoRecebimento(tx: Tx, recebimentoId: string) {
  return tx
    .select()
    .from(notasFiscaisFornecedor)
    .where(and(
      eq(notasFiscaisFornecedor.recebimentoId, recebimentoId),
      isNull(notasFiscaisFornecedor.deletedAt),
    ))
    .orderBy(desc(notasFiscaisFornecedor.createdAt))
    .limit(1)
    .then((r) => r[0] ?? null);
}

export async function persistirNfEstruturadaNaTx(
  tx: Tx,
  auditoria: AuditoriaService,
  params: {
    pedidoFornecedorId: string;
    recebimentoId: string;
    dto: RegistrarNfDto;
    usuarioId: string;
  },
): Promise<typeof notasFiscaisFornecedor.$inferSelect> {
  const { pedidoFornecedorId, recebimentoId, dto, usuarioId } = params;

  const pedido = await tx
    .select()
    .from(pedidosFornecedor)
    .where(and(
      eq(pedidosFornecedor.id, pedidoFornecedorId),
      isNull(pedidosFornecedor.deletedAt),
    ))
    .then((r) => r[0] ?? null);
  if (!pedido) throw new NotFoundException('Pedido ao fornecedor não encontrado');

  const rec = await tx
    .select()
    .from(recebimentos)
    .where(and(
      eq(recebimentos.id, recebimentoId),
      eq(recebimentos.pedidoFornecedorId, pedidoFornecedorId),
      isNull(recebimentos.deletedAt),
    ))
    .then((r) => r[0] ?? null);
  if (!rec) {
    throw new NotFoundException('Recebimento não encontrado para este pedido ao fornecedor');
  }

  await softDeleteNfAtiva(tx, recebimentoId);

  const nf = primeiroOuFalha(await tx.insert(notasFiscaisFornecedor).values({
    pedidoFornecedorId: pedido.id,
    recebimentoId,
    numero: dto.numero,
    serie: dto.serie,
    chave: dto.chave,
    dataEmissao: dto.dataEmissao,
    pesoTotalDeclarado: dto.pesoTotalDeclarado === undefined
      ? null
      : formatarQtd(dto.pesoTotalDeclarado),
    payloadJson: dto.payload ?? {},
  }).returning());

  await tx.insert(notasFiscaisFornecedorItens).values(dto.itens.map((item) => ({
    nfId: nf.id,
    itemComercialId: item.itemComercialId,
    quantidadeDeclarada: formatarQtd(item.quantidadeDeclarada),
    pesoDeclarado: item.pesoDeclarado === undefined ? null : formatarQtd(item.pesoDeclarado),
  })));

  await auditoria.registrar(tx, {
    tabela: 'notas_fiscais_fornecedor',
    registroId: nf.id,
    operacao: 'INSERT',
    modulo: 'operacao',
    usuarioId,
    dadosAnteriores: {},
    dadosNovos: nf,
  });

  return nf;
}

export async function persistirNfDeCamposUiNaTx(
  tx: Tx,
  auditoria: AuditoriaService,
  params: {
    pedidoFornecedorId: string;
    recebimentoId: string;
    campos: Partial<NfCamposUi>;
    usuarioId: string;
    itens?: RegistrarNfDto['itens'];
  },
): Promise<typeof notasFiscaisFornecedor.$inferSelect> {
  const itens = params.itens ?? await derivarItensNfDoPedido(tx, params.pedidoFornecedorId);
  const dto = mapearCamposNfParaRegistrar(params.campos, params.recebimentoId, itens);
  return persistirNfEstruturadaNaTx(tx, auditoria, {
    pedidoFornecedorId: params.pedidoFornecedorId,
    recebimentoId: params.recebimentoId,
    dto,
    usuarioId: params.usuarioId,
  });
}

export type CamposNfUi = Partial<IniciarRecebimentoDto & AtualizarNfeDto>;
