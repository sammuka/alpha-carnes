import { NextRequest } from 'next/server';
import { repassarArquivo } from '@/lib/bff';

export async function GET(req: NextRequest) {
  return repassarArquivo(`/contabilidade/plano/exportar${req.nextUrl.search}`);
}
