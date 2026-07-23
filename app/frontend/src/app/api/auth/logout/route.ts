import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(_req: NextRequest) {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get('refresh_token')?.value;
  const backendUrl = process.env.BACKEND_INTERNAL_URL ?? 'http://localhost:4001';

  if (refreshToken) {
    await fetch(`${backendUrl}/auth/logout`, {
      method: 'POST',
      headers: { Cookie: `refresh_token=${refreshToken}` },
    }).catch(() => {}); // best-effort
  }

  const response = NextResponse.json({ message: 'Logout realizado' });
  response.cookies.delete('access_token');
  response.cookies.delete('refresh_token');
  return response;
}
