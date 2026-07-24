import { BadRequestException, NotFoundException } from '@nestjs/common';
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

function extrairPayloadNfUi(
  dto: Partial<NfCamposUi>,
  extras?: Record<string, unknown>,
): Record<string, unknown> {
  const payload: Record<string, unknown> = { ...extras };
  if (dto.nfeVolumes !== undefined) payload.volumes = dto.nfeVolumes;
  if (dto.nfePesoLiquido !== undefined) payload.pesoLiquido = dto.nfePesoLiquido;
  return payload;
}

export function mapearCamposNfParaRegistrar(
  dto: Partial<NfCamposUi>,
  recebimentoId: string,
  itens: RegistrarNfDto['itens'],
): RegistrarNfDto {
  if (!dto.nfeNumero?.trim()) {
    throw new BadRequestException('nfeNumero é obrigatório para persistir NF estruturada');
  }
  const payload = extrairPayloadNfUi(dto);
  return {
    numero: dto.nfeNumero.trim(),
    serie: dto.nfeSerie,
    chave: dto.nfeChave,
    dataEmissao: dto.nfeDataEmissao,
    pesoTotalDeclarado: dto.nfePesoBruto,
    payload: Object.keys(payload).length > 0 ? payload : undefined,
    itens,
    recebimentoId,
  };
}

async function validarPedidoRecebimento(
  tx: Tx,
  pedidoFornecedorId: string,
  recebimentoId: string,
) {
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
  return { pedido, rec };
}

async function contarItensNfAtivos(tx: Tx, nfId: string): Promise<number> {
  const itens = await tx
    .select({ id: notasFiscaisFornecedorItens.id })
    .from(notasFiscaisFornecedorItens)
    .where(and(
      eq(notasFiscaisFornecedorItens.nfId, nfId),
      isNull(notasFiscaisFornecedorItens.deletedAt),
    ));
  return itens.length;
}

async function buscarNfCabecalhoAtivaPorNumero(
  tx: Tx,
  recebimentoId: string,
  numero: string,
) {
  const candidatas = await tx
    .select()
    .from(notasFiscaisFornecedor)
    .where(and(
      eq(notasFiscaisFornecedor.recebimentoId, recebimentoId),
      eq(notasFiscaisFornecedor.numero, numero),
      isNull(notasFiscaisFornecedor.deletedAt),
    ))
    .orderBy(desc(notasFiscaisFornecedor.createdAt));

  for (const nf of candidatas) {
    if (await contarItensNfAtivos(tx, nf.id) === 0) return nf;
  }
  return null;
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

  if (!dto.itens.length) {
    throw new BadRequestException('NF estruturada exige ao menos um item');
  }

  const { pedido } = await validarPedidoRecebimento(tx, pedidoFornecedorId, recebimentoId);

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

async function persistirNfCabecalhoUiNaTx(
  tx: Tx,
  auditoria: AuditoriaService,
  params: {
    pedidoFornecedorId: string;
    recebimentoId: string;
    campos: Partial<NfCamposUi>;
    usuarioId: string;
  },
): Promise<typeof notasFiscaisFornecedor.$inferSelect> {
  const { pedidoFornecedorId, recebimentoId, campos, usuarioId } = params;

  if (!campos.nfeNumero?.trim()) {
    throw new BadRequestException('nfeNumero é obrigatório para persistir NF estruturada');
  }

  const numero = campos.nfeNumero.trim();
  const { pedido } = await validarPedidoRecebimento(tx, pedidoFornecedorId, recebimentoId);

  const payloadJson = extrairPayloadNfUi(campos, {
    cabecalho_sem_itens: true,
    migracao: 'legado_sem_itens_nf',
  });

  const valores = {
    serie: campos.nfeSerie,
    chave: campos.nfeChave,
    dataEmissao: campos.nfeDataEmissao,
    pesoTotalDeclarado: campos.nfePesoBruto === undefined
      ? null
      : formatarQtd(campos.nfePesoBruto),
    payloadJson,
  };

  const existente = await buscarNfCabecalhoAtivaPorNumero(tx, recebimentoId, numero);
  if (existente) {
    const atualizada = primeiroOuFalha(await tx.update(notasFiscaisFornecedor)
      .set(valores)
      .where(eq(notasFiscaisFornecedor.id, existente.id))
      .returning());

    await auditoria.registrar(tx, {
      tabela: 'notas_fiscais_fornecedor',
      registroId: existente.id,
      operacao: 'UPDATE',
      modulo: 'operacao',
      usuarioId,
      dadosAnteriores: existente,
      dadosNovos: atualizada,
    });

    return atualizada;
  }

  const nf = primeiroOuFalha(await tx.insert(notasFiscaisFornecedor).values({
    pedidoFornecedorId: pedido.id,
    recebimentoId,
    numero,
    ...valores,
  }).returning());

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
  if (params.itens?.length) {
    const dto = mapearCamposNfParaRegistrar(params.campos, params.recebimentoId, params.itens);
    return persistirNfEstruturadaNaTx(tx, auditoria, {
      pedidoFornecedorId: params.pedidoFornecedorId,
      recebimentoId: params.recebimentoId,
      dto,
      usuarioId: params.usuarioId,
    });
  }

  return persistirNfCabecalhoUiNaTx(tx, auditoria, {
    pedidoFornecedorId: params.pedidoFornecedorId,
    recebimentoId: params.recebimentoId,
    campos: params.campos,
    usuarioId: params.usuarioId,
  });
}

export type CamposNfUi = Partial<IniciarRecebimentoDto & AtualizarNfeDto>;
