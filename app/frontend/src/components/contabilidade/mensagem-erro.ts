/** Issue do Zod como o ZodValidationPipe devolve em `{ message: 'Validação falhou', errors }`. */
type Issue = { path?: unknown; code?: unknown; message?: unknown };

/** "Validação falhou" não diz o que falta: uma frase por campo, com o rótulo da tela. */
function porCampo(errors: unknown, rotulos: Record<string, string>): string {
  if (!Array.isArray(errors)) return '';
  const frases = (errors as Issue[]).map((issue) => {
    const chave = Array.isArray(issue.path) ? String(issue.path[0] ?? '') : '';
    const rotulo = rotulos[chave] ?? chave;
    if (!rotulo) return typeof issue.message === 'string' ? issue.message : '';
    if (issue.code === 'too_small' || issue.code === 'invalid_type') return `Informe ${rotulo.toLowerCase()}.`;
    if (issue.code === 'too_big') return `${rotulo}: excede o tamanho máximo.`;
    if ((issue.code === 'custom' || issue.code === 'invalid_format') && typeof issue.message === 'string') {
      return `${rotulo}: ${issue.message}`;
    }
    return `${rotulo} inválido.`;
  });
  return [...new Set(frases.filter(Boolean))].join(' ');
}

function textoMensagem(message: unknown, rotulos: Record<string, string>): string {
  if (typeof message === 'string') return message;
  if (Array.isArray(message)) return message.map(String).join(' ');
  if (message && typeof message === 'object') {
    const detalhe = porCampo((message as { errors?: unknown }).errors, rotulos);
    if (detalhe) return detalhe;
    if ('message' in message) return textoMensagem((message as { message: unknown }).message, rotulos);
  }
  return '';
}

/** Texto do erro da API para a tela; `rotulos` traduz o campo do DTO para o rótulo visível. */
export async function lerMensagem(resposta: Response, rotulos: Record<string, string> = {}): Promise<string> {
  const texto = await resposta.text();
  if (!texto) return '';
  try {
    const corpo = JSON.parse(texto) as { message?: unknown };
    return textoMensagem(corpo.message, rotulos);
  } catch {
    return texto;
  }
}
