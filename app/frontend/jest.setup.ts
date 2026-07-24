import '@testing-library/jest-dom';

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

  Object.defineProperty(globalThis, 'Response', {
    configurable: true,
    writable: true,
    value: JestResponse,
  });
}
