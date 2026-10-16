// Campos sensíveis mascarados nos logs pino-http (cookies com JWT/refresh, Authorization, senhas).
export const logRedact = {
  paths: [
    'req.headers.cookie',
    'req.headers.authorization',
    'res.headers["set-cookie"]',
    'req.body.password',
    'req.body.senha',
    'req.body.access_token',
    'req.body.refresh_token',
  ],
  censor: '[REDACTED]',
};
