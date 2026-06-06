import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(_req: NextRequest) {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get('refresh_token')?.value;
  const backendUrl = process.env.BACKEND_INTERNAL_URL ?? 'http://localhost:3001';

  if (!refreshToken) {
    return NextResponse.json({ message: 'Sem refresh token' }, { status: 401 });
  }

  try {
    const backendRes = await fetch(`${backendUrl}/auth/refresh`, {
      method: 'POST',
      headers: { Cookie: `refresh_token=${refreshToken}` },
    });

    if (!backendRes.ok) {
      return NextResponse.json({ message: 'Refresh inválido' }, { status: 401 });
    }

    const data = await backendRes.json();
    const response = NextResponse.json(data, { status: 200 });
    const backendCookies = backendRes.headers.getSetCookie?.() ?? [];
    for (const cookie of backendCookies) {
      response.headers.append('Set-Cookie', cookie);
    }
    return response;
  } catch {
    return NextResponse.json({ message: 'Erro de conexão' }, { status: 503 });
  }
}
