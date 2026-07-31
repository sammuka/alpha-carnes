import assert from 'node:assert/strict';
import test from 'node:test';

import {
  listChangedServices,
  resolveCoverageBase,
} from './check-coverage-lib.mjs';

test('usa o SHA exato fornecido pelo workflow e não depende de origin/<base>', () => {
  assert.equal(
    resolveCoverageBase({ COVERAGE_BASE_SHA: ' 0123456789abcdef ' }),
    '0123456789abcdef',
  );
  assert.equal(resolveCoverageBase({}), 'HEAD^');
});

test('considera apenas services presentes no resultado ACMR do diff', () => {
  let invocation;
  const services = listChangedServices('base-sha', {
    execute(command, args, options) {
      invocation = { command, args, options };
      return [
        'app/backend/src/pedidos/pedidos.service.ts',
        'app/backend/src/estoque/estoque.service.ts',
        '',
      ].join('\n');
    },
  });

  assert.deepEqual(services, [
    'app/backend/src/pedidos/pedidos.service.ts',
    'app/backend/src/estoque/estoque.service.ts',
  ]);
  assert.equal(invocation.command, 'git');
  assert.deepEqual(invocation.args, [
    'diff',
    '--diff-filter=ACMR',
    '--name-only',
    'base-sha...HEAD',
    '--',
    ':(glob)app/backend/src/**/*.service.ts',
    ':(glob)app/backend/src/**/*.persistence.ts',
  ]);
  assert.deepEqual(invocation.options, { encoding: 'utf8' });
});

test('glob de cobertura por arquivo inclui persistence.ts', () => {
  let invocation;
  listChangedServices('base-sha', {
    execute(command, args, options) {
      invocation = { command, args, options };
      return 'app/backend/src/modules/operacao/recebimento/nota-fiscal-fornecedor.persistence.ts\n';
    },
  });
  assert.ok(invocation.args.includes(':(glob)app/backend/src/**/*.service.ts'));
  assert.ok(invocation.args.includes(':(glob)app/backend/src/**/*.persistence.ts'));
});
