#!/usr/bin/env node
/** Roda todos os lints de achados recorrentes (AD-41). `--warn`: allowlist vira aviso; `--gerar-allowlist`: regrava. */
import { executar } from './lint-lib.mjs';
import { regra as csv } from './lint-csv.mjs';
import { regra as dto } from './lint-dto-zod.mjs';
import { regra as paginacao } from './lint-paginacao.mjs';
import { regra as ilike } from './lint-ilike.mjs';
import { regra as envio } from './lint-envio-em-voo.mjs';
import { regra as forUpdate } from './lint-for-update.mjs';

process.exitCode = executar([csv, dto, paginacao, ilike, envio, forUpdate]);
