import type { NextRequest } from 'next/server';
import { repassar } from '@/lib/bff';

export function GET(req: NextRequest) {
  return repassar(`/fiscal/estabelecimentos/contagens${req.nextUrl.search}`);
}
