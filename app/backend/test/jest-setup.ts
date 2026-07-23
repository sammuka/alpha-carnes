// Hooks e2e criam fixtures via argon2 (deliberadamente lento) + init do Nest +
// sincronização do catálogo RBAC (ensurePermissoes). Com a suíte F3 a carga
// acumulada de setup por suíte cresceu; 30s ficava no limite e estourava sob
// I/O concorrente. 60s dá folga sem mascarar travas reais.
jest.setTimeout(60000);

// Gateways de hardware FAKE nos testes (ADR-009/ADR-010). Definido aqui (worker)
// antes de o arquivo de teste — e portanto o AppModule/HardwareModule — ser importado.
process.env.HARDWARE_FAKE = '1';
// Suíte e2e completa pode levar >15min; evita 401 por expiração do access token no meio dos testes.
process.env.JWT_ACCESS_TTL = process.env.JWT_ACCESS_TTL ?? '8h';
