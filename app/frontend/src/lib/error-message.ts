/** Normaliza payload de erro da API (NestJS + AllExceptionsFilter) para texto exibível. */
export function extrairMensagemErro(body: unknown, fallback = 'Erro'): string {
  if (body == null || typeof body !== 'object') return fallback;

  const msg = (body as { message?: unknown }).message;

  if (typeof msg === 'string' && msg.trim()) return msg;

  if (Array.isArray(msg)) {
    const partes = msg.filter((m): m is string => typeof m === 'string' && m.trim().length > 0);
    if (partes.length > 0) return partes.join('. ');
  }

  if (typeof msg === 'object' && msg !== null) {
    const nested = (msg as { message?: unknown }).message;
    if (typeof nested === 'string' && nested.trim()) return nested;
    if (Array.isArray(nested)) {
      const partes = nested.filter((m): m is string => typeof m === 'string' && m.trim().length > 0);
      if (partes.length > 0) return partes.join('. ');
    }
  }

  return fallback;
}

/** Extrai o código estável de erro, inclusive do envelope aninhado do AllExceptionsFilter. */
export function extrairCodigoErro(body: unknown): string | null {
  if (body == null || typeof body !== 'object') return null;

  const codigo = (body as { codigo?: unknown }).codigo;
  if (typeof codigo === 'string' && codigo.trim()) return codigo;

  const message = (body as { message?: unknown }).message;
  if (message != null && typeof message === 'object') {
    return extrairCodigoErro(message);
  }

  return null;
}

/** Lê o corpo de uma resposta de erro e devolve o texto exibível ao usuário. */
export async function mensagemDeErro(res: Response, fallback = 'Falha na operação'): Promise<string> {
  const body: unknown = await res.json().catch(() => null);
  return extrairMensagemErro(body, fallback);
}
