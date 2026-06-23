import { NextRequest, NextResponse } from 'next/server';
import { fetchBackend } from '@/lib/api';
import type { PerfilComPermissoes } from '@/lib/usuarios';

export async function GET() {
  const { data, error, status } = await fetchBackend<PerfilComPermissoes[]>('/perfis');
  if (error) return NextResponse.json({ message: error }, { status });
  return NextResponse.json(data, { status: 200 });
}

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = (await req.json()) as { perfis: string[] };
  const { data, error, status } = await fetchBackend<{ id: string; perfis: string[] }>(
    `/usuarios/${id}/perfis`,
    { method: 'PUT', body: JSON.stringify(body) },
  );
  if (error) return NextResponse.json({ message: error }, { status });
  return NextResponse.json(data, { status: 200 });
}
