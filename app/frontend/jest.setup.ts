import '@testing-library/jest-dom';

// jsdom não expõe Fetch API completa; NextRequest (BFF) exige Request/Headers.
if (typeof globalThis.Headers === 'undefined') {
  class JestHeaders {
    private readonly map = new Map<string, string>();
    constructor(init?: HeadersInit) {
      if (!init) return;
      if (Array.isArray(init)) {
        for (const [k, v] of init) this.map.set(String(k).toLowerCase(), String(v));
      } else if (init instanceof JestHeaders) {
        for (const [k, v] of init.map) this.map.set(k, v);
      } else {
        for (const [k, v] of Object.entries(init)) this.map.set(k.toLowerCase(), String(v));
      }
    }
    get(name: string): string | null {
      return this.map.get(name.toLowerCase()) ?? null;
    }
    set(name: string, value: string): void {
      this.map.set(name.toLowerCase(), value);
    }
    has(name: string): boolean {
      return this.map.has(name.toLowerCase());
    }
    entries(): IterableIterator<[string, string]> {
      return this.map.entries();
    }
    [Symbol.iterator](): IterableIterator<[string, string]> {
      return this.map.entries();
    }
  }
  Object.defineProperty(globalThis, 'Headers', {
    configurable: true,
    writable: true,
    value: JestHeaders,
  });
}

if (typeof globalThis.Request === 'undefined') {
  class JestRequest {
    readonly url: string;
    readonly method: string;
    readonly headers: Headers;
    constructor(input: RequestInfo | URL, init?: RequestInit) {
      this.url = typeof input === 'string' ? input : input instanceof URL ? input.href : String(input);
      this.method = init?.method ?? 'GET';
      this.headers = new Headers(init?.headers);
    }
  }
  Object.defineProperty(globalThis, 'Request', {
    configurable: true,
    writable: true,
    value: JestRequest,
  });
}

// jsdom não expõe a Fetch API; testes de BFF usam `new Response(...)`.
// Polyfill mínimo suficiente para status/json (sem puxar undici).
if (typeof globalThis.Response === 'undefined') {
  class JestResponse {
    readonly status: number;
    readonly ok: boolean;
    private readonly bodyText: string;

    constructor(body?: BodyInit | null, init?: ResponseInit) {
      this.bodyText =
        body == null
          ? ''
          : typeof body === 'string'
            ? body
            : Buffer.isBuffer(body)
              ? body.toString('utf8')
              : String(body);
      this.status = init?.status ?? 200;
      this.ok = this.status >= 200 && this.status < 300;
    }

    async json(): Promise<unknown> {
      return this.bodyText === '' ? null : JSON.parse(this.bodyText);
    }

    async text(): Promise<string> {
      return this.bodyText;
    }
  }

  (JestResponse as unknown as { json: (body: unknown, init?: ResponseInit) => JestResponse }).json = (
    body: unknown,
    init?: ResponseInit,
  ) => new JestResponse(JSON.stringify(body), init);

  Object.defineProperty(globalThis, 'Response', {
    configurable: true,
    writable: true,
    value: JestResponse,
  });
} else if (typeof (globalThis.Response as unknown as { json?: unknown }).json !== 'function') {
  const Resp = globalThis.Response;
  (Resp as unknown as { json: (body: unknown, init?: ResponseInit) => Response }).json = (
    body: unknown,
    init?: ResponseInit,
  ) => new Resp(JSON.stringify(body), init);
}
