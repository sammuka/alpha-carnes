// Testes usam os gateways de hardware FAKE (ADR-009/ADR-010): definido antes de
// qualquer import de módulo para que o HardwareModule resolva os fakes.
process.env.HARDWARE_FAKE = '1';
process.env.NFSE_FAKE = '1'; // NfseModule resolve FakeNfseGateway em CI/testes (ADR-011)

/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.(e2e-)?spec\\.ts$',
  transform: { '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: './tsconfig.test.json' }] },
  collectCoverageFrom: [
    'src/**/*.ts',
    // Arquivos declarativos sem lógica testável
    '!src/**/*.module.ts',
    '!src/main.ts',
    '!src/database/migrate.ts',
    '!src/database/seed.ts',
    '!src/database/schema/**',
    '!src/common/rbac/permissoes.ts',
    '!src/common/rbac/require-permissoes.decorator.ts',
    '!src/common/decorators/**',
    '!src/config/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['json-summary', 'lcov', 'text'],
  coverageThreshold: { global: { lines: 80, branches: 80 } },
  testEnvironment: 'node',
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  setupFilesAfterEnv: ['<rootDir>/test/jest-setup.ts'],
  maxWorkers: 1,
  // Nest+pino acumula workers de log no processo único; reciclar evita OOM no suite local.
  workerIdleMemoryLimit: '384MB',
};
