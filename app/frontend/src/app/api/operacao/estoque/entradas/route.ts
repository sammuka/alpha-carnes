import { NextRequest } from 'next/server';
import { repassar } from '@/lib/bff';

export async function GET(req: NextRequest) {
  const qs = new URL(req.url).searchParams.toString();
  return repassar(`/estoque/entradas${qs ? `?${qs}` : ''}`);
}

export async function POST(req: NextRequest) {
  return repassar('/estoque/entradas', { method: 'POST', body: await req.text() });
}
