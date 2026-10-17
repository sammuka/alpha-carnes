import { z } from 'zod';
import { contarVisiveis, normalizarJustificativa } from '../../common/validators/justificativa';

const NUL = String.fromCharCode(0);
const semNul = (valor: string) => !valor.includes(NUL);
const MENSAGEM_NUL = 'Texto contém caractere inválido.';

/** Texto livre aparado, sem byte NUL (o PostgreSQL recusa NUL em text e responderia 500). */
export const textoContabil = (min: number, max: number) =>
  z.string().trim().min(min).max(max).refine(semNul, { message: MENSAGEM_NUL });

/** Código de negócio: letras e dígitos ASCII em segmentos separados por ponto ou hífen, sem segmento vazio. */
export const codigoContabil = z.string().trim().min(1).max(32)
  .regex(/^[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*$/, { message: 'Use letras, números, ponto ou hífen, sem separador no início, no fim ou repetido.' });

/** Código vindo de outra fatia (conta, centro, política): só sem NUL; a existência é conferida no serviço. */
export const codigoReferencia = textoContabil(1, 32);

/** Código no caminho da URL: só sem NUL (código inexistente segue 404). */
export const codigoParamSchema = textoContabil(1, 200);

/** Justificativa (normalizador da E01, AD-32): pontas aparadas, ao menos 3 caracteres visíveis, sem NUL. */
export const motivoContabil = z.string().transform(normalizarJustificativa).pipe(
  z.string().max(2000)
    .refine((valor) => contarVisiveis(valor) >= 3, { message: 'Informe ao menos 3 caracteres visíveis.' })
    .refine(semNul, { message: MENSAGEM_NUL }),
);
