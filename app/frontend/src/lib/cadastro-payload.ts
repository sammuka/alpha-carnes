import type { CadastroConfig, CampoConfig } from '@/lib/cadastros-config';

export type FormValor = string | boolean;
export type FormState = Record<string, FormValor>;

export function chaveFormulario(campo: CampoConfig): string {
  return campo.jsonCampo ? `${campo.jsonCampo}.${campo.nome}` : campo.nome;
}

function valorJsonParaPayload(campo: CampoConfig, valor: FormValor): unknown | undefined {
  if (campo.tipo === 'checkbox') return valor === true;
  const str = typeof valor === 'string' ? valor.trim() : '';
  if (str === '') return undefined;
  if (campo.tipo === 'number') {
    const n = Number(str);
    return Number.isFinite(n) ? n : str;
  }
  return str;
}

/**
 * Monta o body de PATCH/POST a partir do estado plano do master-detail.
 * Campos JSON opcionais vazios são omitidos; números deixam de ir como string —
 * o Zod do backend rejeita `""` e `z.number()` não aceita `"18000"`.
 */
export function montarPayload(
  config: Omit<CadastroConfig, 'schema'>,
  form: FormState,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  const jsonBuckets = new Map<string, Record<string, unknown>>();

  for (const campo of config.campos) {
    const chave = chaveFormulario(campo);
    const valor = form[chave];

    if (campo.jsonCampo) {
      if (!jsonBuckets.has(campo.jsonCampo)) {
        jsonBuckets.set(campo.jsonCampo, {});
      }
      const convertido = valorJsonParaPayload(campo, valor ?? '');
      if (convertido !== undefined) {
        jsonBuckets.get(campo.jsonCampo)![campo.nome] = convertido;
      }
      continue;
    }

    if (campo.tipo === 'checkbox') {
      payload[campo.nome] = valor === true;
    } else {
      const str = typeof valor === 'string' ? valor : String(valor ?? '');
      if (campo.nome === 'representanteId' && str.trim() === '') {
        continue;
      }
      payload[campo.nome] = str;
    }
  }

  for (const [jsonCampo, obj] of jsonBuckets) {
    payload[jsonCampo] = obj;
  }

  return payload;
}
