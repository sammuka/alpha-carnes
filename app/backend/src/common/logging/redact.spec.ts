import { createServer } from 'http';
import { AddressInfo } from 'net';
import pinoHttp from 'pino-http';
import { Writable } from 'stream';
import { logRedact } from './redact';

describe('logRedact', () => {
  it('não vaza cookie, authorization nem set-cookie no log HTTP', async () => {
    let saida = '';
    const stream = new Writable({
      write(chunk, _enc, cb) {
        saida += chunk.toString();
        cb();
      },
    });
    const logger = pinoHttp({ redact: logRedact }, stream);
    const server = createServer((req, res) => {
      logger(req, res);
      res.setHeader('set-cookie', 'refresh_token=SEGREDO_REFRESH');
      res.statusCode = 500;
      res.end();
    });
    await new Promise<void>((r) => server.listen(0, r));
    const { port } = server.address() as AddressInfo;
    await fetch(`http://localhost:${port}/x`, {
      headers: { cookie: 'access_token=SEGREDO_JWT', authorization: 'Bearer SEGREDO_BEARER' },
    });
    await new Promise((r) => setTimeout(r, 50));
    server.close();

    expect(saida).toContain('[REDACTED]');
    expect(saida).not.toMatch(/SEGREDO/);
  });
});
