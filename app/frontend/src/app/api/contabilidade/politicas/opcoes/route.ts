import { repassar } from '@/lib/bff';

export async function GET() {
  return repassar('/contabilidade/politicas/opcoes');
}
