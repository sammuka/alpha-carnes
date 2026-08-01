import { NextResponse } from 'next/server';
import { fetchBackend } from '@/lib/api';

/** BFF: reimpressão auditada da etiqueta de parte (desossa). */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ subitemId: string }> },
) {
  const { subitemId } = await params;
  const { data, error, status } = await fetchBackend(
    `/operacao/corte/subitens/${subitemId}/etiqueta/reimprimir`,
    { method: 'POST' },
  );
  if (error) return NextResponse.json({ message: error }, { status });
  return NextResponse.json(data, { status: 201 });
}
