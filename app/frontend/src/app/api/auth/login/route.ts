import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const backendUrl = process.env.BACKEND_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001';

  try {
    const backendRes = await fetch(`${backendUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await backendRes.json().catch(() => ({}));

    if (!backendRes.ok) {
      return NextResponse.json(data, { status: backendRes.status });
    }

    // Repassar cookies httpOnly do backend para o browser
    const response = NextResponse.json(data, { status: 200 });
    const backendCookies = backendRes.headers.getSetCookie?.() ?? [];
    for (const cookie of backendCookies) {
      response.headers.append('Set-Cookie', cookie);
    }

    return response;
  } catch {
    return NextResponse.json({ message: 'Erro de conexão com o servidor' }, { status: 503 });
  }
}
