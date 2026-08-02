import { NextRequest } from 'next/server';
import { repassar } from '@/lib/bff';

export async function POST(req: NextRequest) {
  return repassar('/estoque/destinar', { method: 'POST', body: await req.text() });
}
