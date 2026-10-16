// Campos sensíveis mascarados nos logs pino-http (cookies com JWT/refresh, Authorization, senhas).
export const logRedact = {
  paths: [
    'req.headers.cookie',
    'req.headers.authorization',
    'req.headers["proxy-authorization"]',
    'req.headers["x-access-token"]',
    'req.headers["x-api-key"]',
    'res.headers["set-cookie"]',
    // Defesa em profundidade: pino-http não loga o corpo hoje, estes caminhos ficam inertes.
    'req.body.password',
    'req.body.senha',
    'req.body.access_token',
    'req.body.refresh_token',
  ],
  censor: '[REDACTED]',
};

/** Seam de teste: quando definido, o logger HTTP escreve neste stream (sem pino-pretty). */
export const logTestSink: { stream?: import('stream').Writable } = {};
