/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'jsdom',
  testPathIgnorePatterns: ['/node_modules/', '/.next/', '/e2e/'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', { tsconfig: './tsconfig.test.json' }],
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  maxWorkers: 2,
  passWithNoTests: true,
  // userEvent + drawers saturam o CPU no suite completo (Windows/CI); 15s flakava no GitHub Actions.
  testTimeout: 30_000,
};
