import { NextResponse } from 'next/server';
import { apiFetch } from '@/lib/api';

/**
 * Repassa a chamada ao backend preservando status e corpo — inclusive os de erro.
 * `fetchBackend` não serve aqui: ele reduz o erro a `{ message }` e descarta o
 * `impacto` do challenge 409 (D5.31) e as `pendencias` do 409 do SIF (D5.25).
 */
export async function repassar(
  caminho: string,
  init: { method?: string; body?: string } = {},
): Promise<NextResponse> {
  const resposta = await apiFetch(caminho, {
    method: init.method ?? 'GET',
    ...(init.body === undefined ? {} : { body: init.body }),
  });
  const texto = await resposta.text();
  return new NextResponse(texto === '' ? null : texto, {
    status: resposta.status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Como `repassar`, mas para arquivo: no sucesso repassa os bytes (arrayBuffer, nunca text(), que descarta o BOM UTF-8) com Content-Type e Content-Disposition do backend; no erro segue como JSON. */
export async function repassarArquivo(caminho: string): Promise<NextResponse> {
  const resposta = await apiFetch(caminho, { method: 'GET' });
  if (!resposta.ok) {
    const texto = await resposta.text();
    return new NextResponse(texto === '' ? null : texto, { status: resposta.status, headers: { 'Content-Type': 'application/json' } });
  }
  const headers: Record<string, string> = { 'Content-Type': resposta.headers.get('content-type') ?? 'text/csv; charset=utf-8' };
  const disposicao = resposta.headers.get('content-disposition');
  if (disposicao) headers['Content-Disposition'] = disposicao;
  return new NextResponse(await resposta.arrayBuffer(), { status: resposta.status, headers });
}
