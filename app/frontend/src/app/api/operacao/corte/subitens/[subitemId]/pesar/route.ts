import { NextRequest, NextResponse } from 'next/server';
import { fetchBackend } from '@/lib/api';
import type { Subitem } from '@/lib/operacao';

export async function POST(req: NextRequest, { params }: { params: Promise<{ subitemId: string }> }) {
  const { subitemId } = await params;
  const body = await req.json();
  const { data, error, status } = await fetchBackend<Subitem>(
    `/operacao/corte/subitens/${subitemId}/pesar`,
    { method: 'POST', body: JSON.stringify(body) },
  );
  if (error) return NextResponse.json({ message: error }, { status });
  return NextResponse.json(data, { status: 201 });
}
