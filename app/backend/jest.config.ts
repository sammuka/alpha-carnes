import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  transform: { '^.+\\.(t|j)s$': 'ts-jest' },
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.module.ts', '!src/main.ts', '!src/database/migrate.ts', '!src/database/seed.ts'],
  coverageDirectory: 'coverage',
  coverageReporters: ['json-summary', 'lcov', 'text'],
  coverageThreshold: {
    global: { lines: 80, branches: 80 },
  },
  testEnvironment: 'node',
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  runInBand: true,
};

export default config;
