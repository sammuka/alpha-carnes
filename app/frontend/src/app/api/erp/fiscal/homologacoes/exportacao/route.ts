import { NextResponse, type NextRequest } from 'next/server';
import { apiFetch } from '@/lib/api';

export async function GET(req: NextRequest) {
  const resposta = await apiFetch(`/fiscal/homologacoes/exportacao${req.nextUrl.search}`, { method: 'GET' });
  const bytes = await resposta.arrayBuffer();
  const headers = new Headers();
  const tipo = resposta.headers.get('content-type');
  if (tipo) headers.set('Content-Type', tipo);
  const disposicao = resposta.headers.get('content-disposition');
  if (disposicao) headers.set('Content-Disposition', disposicao);
  return new NextResponse(bytes, { status: resposta.status, headers });
}
