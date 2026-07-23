import { NextResponse } from 'next/server';
import { fetchBackend } from '@/lib/api';
import type { ItemEstoqueConsulta } from '@/lib/estoque';

export async function GET() {
  const { data, error, status } = await fetchBackend<ItemEstoqueConsulta[]>('/estoque/consulta');
  if (error) return NextResponse.json({ message: error }, { status });
  return NextResponse.json(data, { status: 200 });
}
