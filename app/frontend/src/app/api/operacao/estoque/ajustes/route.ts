import { NextRequest } from 'next/server';
import { repassar } from '@/lib/bff';

export async function GET(req: NextRequest) {
  const qs = new URL(req.url).searchParams.toString();
  return repassar(`/estoque/ajustes${qs ? `?${qs}` : ''}`);
}

export async function POST(req: NextRequest) {
  return repassar('/estoque/ajustes', { method: 'POST', body: await req.text() });
}
