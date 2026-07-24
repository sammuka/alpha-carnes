import { cookies } from 'next/headers';
import { extrairMensagemErro } from './error-message';

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001';

async function backendHeaders(extra?: HeadersInit): Promise<Record<string, string>> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('access_token')?.value;
  const refreshToken = cookieStore.get('refresh_token')?.value;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(extra as Record<string, string> | undefined),
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

  return headers;
}

/** Fetch bruto ao backend — preserva status/body (ex.: challenge 409). */
export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const headers = await backendHeaders(options.headers);
  return fetch(`${BACKEND_URL}${path}`, {
    ...options,
    headers,
    cache: 'no-store',
  });
}

export async function fetchBackend<T>(
  path: string,
  options: RequestInit = {},
): Promise<{ data: T | null; error: string | null; status: number }> {
  try {
    const res = await apiFetch(path, options);

    if (!res.ok) {
      const body = await res.json().catch(() => ({ message: 'Erro desconhecido' }));
      return { data: null, error: extrairMensagemErro(body, 'Erro'), status: res.status };
    }

    const data = await res.json();
    return { data, error: null, status: res.status };
  } catch {
    return { data: null, error: 'Erro de conexão', status: 503 };
  }
}
