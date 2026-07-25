import { createRequire } from 'node:module';

const require = createRequire(__filename);

it('jest exige 80 por cento de linha e de branch', () => {
  const config = require('../../jest.config.cjs') as {
    coverageThreshold?: { global?: { lines?: number; branches?: number } };
  };
  expect(config.coverageThreshold?.global?.lines).toBeGreaterThanOrEqual(80);
  expect(config.coverageThreshold?.global?.branches).toBeGreaterThanOrEqual(80);
});
