import { NextRequest, NextResponse } from 'next/server';
import { fetchBackend } from '@/lib/api';
import type { CriarUsuarioDto, Usuario } from '@/lib/usuarios';

export async function GET() {
  const { data, error, status } = await fetchBackend<Usuario[]>('/usuarios');
  if (error) return NextResponse.json({ message: error }, { status });
  return NextResponse.json(data, { status: 200 });
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as CriarUsuarioDto;
  const { data, error, status } = await fetchBackend<Usuario>('/usuarios', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (error) return NextResponse.json({ message: error }, { status });
  return NextResponse.json(data, { status: 201 });
}
