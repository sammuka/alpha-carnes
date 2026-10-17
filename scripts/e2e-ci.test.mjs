import assert from 'node:assert/strict';
import test from 'node:test';

import { lerArgumentos, nomeBancoExecucao, urlComBanco, ambienteDeTeste } from './e2e-ci.mjs';

test('separa as flags do harness dos argumentos repassados ao Playwright', () => {
  const r = lerArgumentos(['--keep-db', '--no-build', '--port-backend', '4501', '--port-frontend=4502', 'e2e/a.spec.ts', '-g', 'jornada', '--trace', 'on']);
  assert.deepEqual(r.opcoes, { keepDb: true, noBuild: true, build: false, portBackend: 4501, portFrontend: 4502 });
  assert.deepEqual(r.playwright, ['e2e/a.spec.ts', '-g', 'jornada', '--trace', 'on']);
});

test('--build força o build e porta inválida falha alto', () => {
  assert.equal(lerArgumentos(['--build']).opcoes.build, true);
  assert.throws(() => lerArgumentos(['--port-backend', 'abc']), /porta inválida/);
});

test('o banco da execução é único, minúsculo e termina em _e2e', () => {
  const a = nomeBancoExecucao(new Date('2026-10-17T12:34:56Z'), 'Ab12');
  assert.equal(a, 'alphacarnes_20261017123456_ab12_e2e');
  assert.match(a, /^[a-z0-9_]+_e2e$/);
});

test('troca só o banco da URL de conexão', () => {
  assert.equal(
    urlComBanco('postgres://u:p@localhost:15433/postgres', 'x_e2e'),
    'postgres://u:p@localhost:15433/x_e2e',
  );
});

test('defaults de teste são sobrescrevíveis pelo ambiente', () => {
  const env = ambienteDeTeste({ JWT_ACCESS_SECRET: 'meu-segredo-com-mais-de-32-caracteres!!' });
  assert.equal(env.JWT_ACCESS_SECRET, 'meu-segredo-com-mais-de-32-caracteres!!');
  assert.equal(env.NFSE_FAKE, '1');
  assert.equal(env.HARDWARE_FAKE, '1');
  assert.equal(env.THROTTLE_LOGIN_LIMIT, '100');
});
