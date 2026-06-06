import type { Config } from 'jest';

const config: Config = {
  testEnvironment: 'jsdom',
  testPathIgnorePatterns: ['/node_modules/', '/.next/'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', { tsconfig: './tsconfig.json' }],
  },
  // Executa @testing-library/jest-dom após o framework de teste estar instalado
  setupFilesAfterFramework: ['<rootDir>/jest.setup.ts'],
  passWithNoTests: true,
};

export default config;
