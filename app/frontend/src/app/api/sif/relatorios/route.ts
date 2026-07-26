import { NextRequest } from 'next/server';
import { repassar } from '@/lib/bff';

export async function GET(req: NextRequest) {
  return repassar(`/sif/relatorios${req.nextUrl.search}`);
}
