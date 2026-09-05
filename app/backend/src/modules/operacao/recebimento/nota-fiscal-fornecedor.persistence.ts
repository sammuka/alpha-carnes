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

export function extrairPayloadNfUi(
  dto: Partial<NfCamposUi>,
  extras?: Record<string, unknown>,
): Record<string, unknown> {
  const payload: Record<string, unknown> = { ...extras };
  if (dto.nfeVolumes !== undefined) payload.volumes = dto.nfeVolumes;
  if (dto.nfePesoLiquido !== undefined) payload.pesoLiquido = dto.nfePesoLiquido;
  return payload;
}

export function mesclarPayloadNfCabecalho(
  existente: Record<string, unknown> | null | undefined,
  campos: Partial<NfCamposUi>,
  marcarCabecalhoSemItens: boolean,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...(existente ?? {}) };
  if (campos.nfeVolumes !== undefined) merged.volumes = campos.nfeVolumes;
  if (campos.nfePesoLiquido !== undefined) merged.pesoLiquido = campos.nfePesoLiquido;
  if (marcarCabecalhoSemItens) {
    merged.cabecalho_sem_itens = true;
  } else {
    delete merged.cabecalho_sem_itens;
  }
  delete merged.migracao;
  return merged;
}

export function mesclarPayloadNfCompleta(
  existente: Record<string, unknown> | null | undefined,
  novo: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...(existente ?? {}), ...(novo ?? {}) };
  delete merged.cabecalho_sem_itens;
  delete merged.migracao;
  return merged;
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
    confirmarSubstituicaoCabecalho: false,
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

async function existeOrfaoNoRecebimento(tx: Tx, recebimentoId: string): Promise<boolean> {
  const candidatas = await tx
    .select({ id: notasFiscaisFornecedor.id })
    .from(notasFiscaisFornecedor)
    .where(and(
      eq(notasFiscaisFornecedor.recebimentoId, recebimentoId),
      isNull(notasFiscaisFornecedor.deletedAt),
    ));
  for (const nf of candidatas) {
    if (await contarItensNfAtivos(tx, nf.id) === 0) return true;
  }
  return false;
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
    .orderBy(desc(notasFiscaisFornecedor.createdAt))
    .for('update'); // D6.10 — serializa concorrentes sobre o mesmo cabeçalho

  for (const nf of candidatas) {
    if (await contarItensNfAtivos(tx, nf.id) === 0) return nf;
  }
  return null;
}

async function buscarNfCabecalhoAtivaPorRecebimento(
  tx: Tx,
  recebimentoId: string,
) {
  const candidatas = await tx
    .select()
    .from(notasFiscaisFornecedor)
    .where(and(
      eq(notasFiscaisFornecedor.recebimentoId, recebimentoId),
      isNull(notasFiscaisFornecedor.deletedAt),
    ))
    .orderBy(desc(notasFiscaisFornecedor.createdAt))
    .for('update'); // D6.10 — serializa concorrentes sobre o mesmo cabeçalho

  for (const nf of candidatas) {
    if (await contarItensNfAtivos(tx, nf.id) === 0) return nf;
  }
  return null;
}

/** PATCH de cabeçalho UI: prefere NF com itens; senão órfã; nunca INSERT se já houver NF ativa. */
async function buscarNfParaAtualizarCabecalhoUi(
  tx: Tx,
  recebimentoId: string,
) {
  const candidatas = await tx
    .select()
    .from(notasFiscaisFornecedor)
    .where(and(
      eq(notasFiscaisFornecedor.recebimentoId, recebimentoId),
      isNull(notasFiscaisFornecedor.deletedAt),
    ))
    .orderBy(desc(notasFiscaisFornecedor.createdAt));

  let orfao: typeof notasFiscaisFornecedor.$inferSelect | null = null;
  for (const nf of candidatas) {
    if (await contarItensNfAtivos(tx, nf.id) > 0) return nf;
    if (!orfao) orfao = nf;
  }
  return orfao;
}

export interface CabecalhoOrfaoEncontrado {
  nf: typeof notasFiscaisFornecedor.$inferSelect;
  /** true quando o órfão foi achado pelo recebimento, com numero diferente do informado. */
  numeroDivergente: boolean;
}

async function buscarCabecalhoParaCompletar(
  tx: Tx,
  recebimentoId: string,
  numero: string,
): Promise<CabecalhoOrfaoEncontrado | null> {
  const porNumero = await buscarNfCabecalhoAtivaPorNumero(tx, recebimentoId, numero);
  if (porNumero) return { nf: porNumero, numeroDivergente: false };
  const porRecebimento = await buscarNfCabecalhoAtivaPorRecebimento(tx, recebimentoId);
  if (!porRecebimento) return null;
  return { nf: porRecebimento, numeroDivergente: porRecebimento.numero !== numero };
}

export function montarPatchCabecalhoUi(
  campos: Partial<NfCamposUi>,
  existente?: typeof notasFiscaisFornecedor.$inferSelect,
): Partial<typeof notasFiscaisFornecedor.$inferInsert> {
  const patch: Partial<typeof notasFiscaisFornecedor.$inferInsert> = {};
  if (campos.nfeSerie !== undefined) patch.serie = campos.nfeSerie;
  if (campos.nfeChave !== undefined) patch.chave = campos.nfeChave;
  if (campos.nfeDataEmissao !== undefined) patch.dataEmissao = campos.nfeDataEmissao;
  if (campos.nfePesoBruto !== undefined) {
    patch.pesoTotalDeclarado = formatarQtd(campos.nfePesoBruto);
  } else if (existente) {
    patch.pesoTotalDeclarado = existente.pesoTotalDeclarado;
  }
  return patch;
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

async function completarCabecalhoComItensNaTx(
  tx: Tx,
  auditoria: AuditoriaService,
  params: {
    existente: typeof notasFiscaisFornecedor.$inferSelect;
    dto: RegistrarNfDto;
    usuarioId: string;
  },
): Promise<typeof notasFiscaisFornecedor.$inferSelect> {
  const { existente, dto, usuarioId } = params;

  const patch: Partial<typeof notasFiscaisFornecedor.$inferInsert> = {
    numero: dto.numero,
    payloadJson: mesclarPayloadNfCompleta(
      existente.payloadJson as Record<string, unknown> | null,
      dto.payload,
    ),
  };
  if (dto.serie !== undefined) patch.serie = dto.serie;
  if (dto.chave !== undefined) patch.chave = dto.chave;
  if (dto.dataEmissao !== undefined) patch.dataEmissao = dto.dataEmissao;
  if (dto.pesoTotalDeclarado !== undefined) {
    patch.pesoTotalDeclarado = formatarQtd(dto.pesoTotalDeclarado);
  } else {
    patch.pesoTotalDeclarado = existente.pesoTotalDeclarado;
  }

  const atualizada = primeiroOuFalha(await tx.update(notasFiscaisFornecedor)
    .set(patch)
    .where(eq(notasFiscaisFornecedor.id, existente.id))
    .returning());

  await tx.insert(notasFiscaisFornecedorItens).values(dto.itens.map((item) => ({
    nfId: existente.id,
    produtoId: item.produtoId,
    quantidadeDeclarada: formatarQtd(item.quantidadeDeclarada),
    pesoDeclarado: item.pesoDeclarado === undefined ? null : formatarQtd(item.pesoDeclarado),
  })));

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

  // D6.10 — snapshot sem lock, tirado ANTES de competir pelo FOR UPDATE abaixo: se
  // havia órfão visível aqui mas a busca com lock não encontra mais nenhum, uma
  // transação concorrente venceu a corrida e já o consumiu (ver guard após o if).
  // Sem essa distinção, cairíamos no INSERT e criaríamos uma 2ª NF ativa para o
  // mesmo recebimento; mas se nunca houve órfão, múltiplas NFs completas no mesmo
  // recebimento são um fluxo legítimo (não é corrida) e devem seguir para o INSERT.
  const orfaoExistiaAntesDoLock = await existeOrfaoNoRecebimento(tx, recebimentoId);

  const cabecalhoOrfao = await buscarCabecalhoParaCompletar(tx, recebimentoId, dto.numero);
  if (cabecalhoOrfao) {
    if (cabecalhoOrfao.numeroDivergente && !dto.confirmarSubstituicaoCabecalho) {
      throw new ConflictException({
        codigo: 'CABECALHO_ORFAO_DIVERGENTE',
        message:
          `A NF ${dto.numero} não corresponde ao cabeçalho ${cabecalhoOrfao.nf.numero} já aberto `
          + 'neste recebimento. Confirme a substituição para renumerar.',
        numeroInformado: dto.numero,
        numeroCabecalhoExistente: cabecalhoOrfao.nf.numero,
      });
    }
    if (cabecalhoOrfao.numeroDivergente) {
      await auditoria.registrar(tx, {
        tabela: 'notas_fiscais_fornecedor',
        registroId: cabecalhoOrfao.nf.id,
        operacao: 'UPDATE',
        modulo: 'operacao',
        usuarioId,
        dadosAnteriores: { evento: 'NF_CABECALHO_RENUMERADO', numero: cabecalhoOrfao.nf.numero },
        dadosNovos: { evento: 'NF_CABECALHO_RENUMERADO', numero: dto.numero },
      });
    }
    return completarCabecalhoComItensNaTx(tx, auditoria, {
      existente: cabecalhoOrfao.nf,
      dto,
      usuarioId,
    });
  }

  // Corrida perdida: havia órfão antes do lock, mas já não há nenhum agora — uma
  // transação concorrente venceu e o consumiu. Trata como o mesmo conflito que
  // trataria se esta transação tivesse vencido a corrida pelo lock.
  if (orfaoExistiaAntesDoLock && !dto.confirmarSubstituicaoCabecalho) {
    const nfAtivaAgora = await buscarNfAtivaDoRecebimento(tx, recebimentoId);
    if (nfAtivaAgora && nfAtivaAgora.numero !== dto.numero) {
      throw new ConflictException({
        codigo: 'CABECALHO_ORFAO_DIVERGENTE',
        message:
          `A NF ${dto.numero} não corresponde ao cabeçalho ${nfAtivaAgora.numero} já aberto `
          + 'neste recebimento. Confirme a substituição para renumerar.',
        numeroInformado: dto.numero,
        numeroCabecalhoExistente: nfAtivaAgora.numero,
      });
    }
  }

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
    produtoId: item.produtoId,
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

  const existente = await buscarNfParaAtualizarCabecalhoUi(tx, recebimentoId);
  if (existente) {
    const patch = montarPatchCabecalhoUi(campos, existente);
    patch.numero = numero;
    const itensAtivos = await contarItensNfAtivos(tx, existente.id);
    patch.payloadJson = mesclarPayloadNfCabecalho(
      existente.payloadJson as Record<string, unknown> | null,
      campos,
      itensAtivos === 0,
    );

    const atualizada = primeiroOuFalha(await tx.update(notasFiscaisFornecedor)
      .set(patch)
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

  // Cabeçalho recém-criado nasce sem item; a contagem é zero por construção.
  const payloadJson = mesclarPayloadNfCabecalho(null, campos, /* itensAtivos === 0 */ true);
  const valores: typeof notasFiscaisFornecedor.$inferInsert = {
    pedidoFornecedorId: pedido.id,
    recebimentoId,
    numero,
    payloadJson,
    pesoTotalDeclarado: campos.nfePesoBruto === undefined
      ? null
      : formatarQtd(campos.nfePesoBruto),
  };
  if (campos.nfeSerie !== undefined) valores.serie = campos.nfeSerie;
  if (campos.nfeChave !== undefined) valores.chave = campos.nfeChave;
  if (campos.nfeDataEmissao !== undefined) valores.dataEmissao = campos.nfeDataEmissao;

  const nf = primeiroOuFalha(await tx.insert(notasFiscaisFornecedor).values(valores).returning());

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
