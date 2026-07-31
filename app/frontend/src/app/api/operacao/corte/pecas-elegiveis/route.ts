import { NextResponse } from 'next/server';
import { fetchBackend } from '@/lib/api';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const qs = url.searchParams.toString();
  const { data, error, status } = await fetchBackend(
    `/operacao/corte/pecas-elegiveis${qs ? `?${qs}` : ''}`,
  );
  if (error) return NextResponse.json({ message: error }, { status });
  return NextResponse.json(data);
}
