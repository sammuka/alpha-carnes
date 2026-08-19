import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const PUBLIC_PATHS = [
  '/login',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/refresh',
  '/_next',
  '/favicon.ico',
];

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001';

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p));
}

async function tokenValido(token: string): Promise<boolean> {
  try {
    const secret = process.env.JWT_ACCESS_SECRET;
    if (!secret) throw new Error('JWT_ACCESS_SECRET não configurado');
    await jwtVerify(token, new TextEncoder().encode(secret));
    return true;
  } catch {
    return false;
  }
}

function valorCookie(cookies: string[], nome: string): string | null {
  for (const cookie of cookies) {
    const match = cookie.match(new RegExp(`^${nome}=([^;]+)`));
    if (match) return match[1] ?? null;
  }
  return null;
}

/** Troca o refresh_token pelos novos tokens no backend; null se não deu para renovar. */
async function renovarTokens(refreshToken: string): Promise<string[] | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/auth/refresh`, {
      method: 'POST',
      headers: { Cookie: `refresh_token=${refreshToken}` },
    });
    if (!res.ok) return null;
    return res.headers.getSetCookie?.() ?? [];
  } catch {
    return null;
  }
}

function paraLogin(req: NextRequest): NextResponse {
  const response = NextResponse.redirect(new URL('/login', req.url));
  response.cookies.delete('access_token');
  response.cookies.delete('refresh_token');
  return response;
}

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;

  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  const accessToken = req.cookies.get('access_token')?.value;
  if (accessToken && (await tokenValido(accessToken))) {
    return NextResponse.next();
  }

  // access_token ausente/expirado (TTL de 15min): tenta renovar com o refresh_token
  // (TTL de 8h) antes de forçar o login — sem isto o usuário cai no login a cada
  // ~15min de uso, mesmo com sessão ainda válida.
  const refreshToken = req.cookies.get('refresh_token')?.value;
  if (!refreshToken) return paraLogin(req);

  const novosCookies = await renovarTokens(refreshToken);
  if (!novosCookies || novosCookies.length === 0) return paraLogin(req);

  const novoAccessToken = valorCookie(novosCookies, 'access_token');
  const novoRefreshToken = valorCookie(novosCookies, 'refresh_token');
  if (!novoAccessToken) return paraLogin(req);

  // Propaga os tokens renovados para a própria requisição em curso (SSR já
  // enxerga a sessão válida) e para o navegador (Set-Cookie na resposta).
  req.cookies.set('access_token', novoAccessToken);
  if (novoRefreshToken) req.cookies.set('refresh_token', novoRefreshToken);

  const response = NextResponse.next({ request: req });
  for (const cookie of novosCookies) response.headers.append('set-cookie', cookie);
  return response;
}

export const config = {
  runtime: 'nodejs',
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/auth/login|api/auth/logout|api/auth/refresh|.*\\.png$|.*\\.jpg$|.*\\.svg$|.*\\.ico$).*)',
  ],
};
