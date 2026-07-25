import { NextResponse } from 'next/server';
import { fetchBackend } from '@/lib/api';

export async function GET() {
  const { data, error, status } = await fetchBackend<string[]>('/representantes/canais');
  if (error) return NextResponse.json({ message: error }, { status });
  return NextResponse.json(data, { status: 200 });
}
