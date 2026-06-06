/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.(e2e-)?spec\\.ts$',
  transform: { '^.+\\.(t|j)s$': 'ts-jest' },
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
  maxWorkers: 1,
};
