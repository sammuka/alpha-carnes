// Hooks e2e criam fixtures via argon2 (deliberadamente lento) + init do Nest.
// Aumenta o timeout padrão para acomodar setup de múltiplos usuários nos testes de integração.
jest.setTimeout(30000);
