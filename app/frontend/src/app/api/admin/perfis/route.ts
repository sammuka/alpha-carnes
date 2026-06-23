import { NextResponse } from 'next/server';
import { fetchBackend } from '@/lib/api';
import type { PerfilComPermissoes } from '@/lib/usuarios';

export async function GET() {
  const { data, error, status } = await fetchBackend<PerfilComPermissoes[]>('/perfis');
  if (error) return NextResponse.json({ message: error }, { status });
  return NextResponse.json(data, { status: 200 });
}
