import { cookies } from 'next/headers';

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export async function fetchBackend<T>(
  path: string,
  options: RequestInit = {},
): Promise<{ data: T | null; error: string | null; status: number }> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('access_token')?.value;
  const refreshToken = cookieStore.get('refresh_token')?.value;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (accessToken) {
    const cookieHeader = [
      accessToken ? `access_token=${accessToken}` : '',
      refreshToken ? `refresh_token=${refreshToken}` : '',
    ]
      .filter(Boolean)
      .join('; ');
    headers['Cookie'] = cookieHeader;
  }

  try {
    const res = await fetch(`${BACKEND_URL}${path}`, {
      ...options,
      headers,
      cache: 'no-store',
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({ message: 'Erro desconhecido' }));
      return { data: null, error: (body as { message?: string }).message ?? 'Erro', status: res.status };
    }

    const data = await res.json();
    return { data, error: null, status: res.status };
  } catch {
    return { data: null, error: 'Erro de conexão', status: 503 };
  }
}
