import { NextRequest, NextResponse } from 'next/server';
import { fetchBackend } from '@/lib/api';
import type { AtualizarUsuarioDto, Usuario } from '@/lib/usuarios';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { data, error, status } = await fetchBackend<Usuario & { perfis: string[] }>(`/usuarios/${id}`);
  if (error) return NextResponse.json({ message: error }, { status });
  return NextResponse.json(data, { status: 200 });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = (await req.json()) as AtualizarUsuarioDto;
  const { data, error, status } = await fetchBackend<Usuario>(`/usuarios/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  if (error) return NextResponse.json({ message: error }, { status });
  return NextResponse.json(data, { status: 200 });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { data, error, status } = await fetchBackend<{ id: string }>(`/usuarios/${id}`, {
    method: 'DELETE',
  });
  if (error) return NextResponse.json({ message: error }, { status });
  return NextResponse.json(data, { status: 200 });
}
