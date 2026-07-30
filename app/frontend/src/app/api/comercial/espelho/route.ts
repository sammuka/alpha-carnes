import { NextRequest, NextResponse } from 'next/server';
import { apiFetch, fetchBackend } from '@/lib/api';
import type { EspelhoResposta } from '@/lib/espelho';

export async function GET(req: NextRequest) {
  const qs = req.nextUrl.searchParams.toString();
  const path = `/comercial/espelho${qs ? `?${qs}` : ''}`;

  if (req.nextUrl.searchParams.get('formato') === 'csv') {
    const response = await apiFetch(path);
    const headers = new Headers();
    const contentType = response.headers.get('content-type');
    const disposition = response.headers.get('content-disposition');
    if (contentType) headers.set('content-type', contentType);
    if (disposition) headers.set('content-disposition', disposition);
    return new NextResponse(response.body, { status: response.status, headers });
  }

  const { data, error, status } = await fetchBackend<EspelhoResposta>(path);
  if (error) return NextResponse.json({ message: error }, { status });
  return NextResponse.json(data, { status: 200 });
}
