// Hooks e2e criam fixtures via argon2 (deliberadamente lento) + init do Nest +
// sincronização do catálogo RBAC (ensurePermissoes). Com a suíte F3 a carga
// acumulada de setup por suíte cresceu; 30s ficava no limite e estourava sob
// I/O concorrente. 60s dá folga sem mascarar travas reais.
jest.setTimeout(60000);
