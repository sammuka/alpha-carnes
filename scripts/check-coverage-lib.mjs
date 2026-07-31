import { execFileSync } from 'node:child_process';
import { env } from 'node:process';

export const resolveCoverageBase = (environment = env) => {
  const exactBase = environment.COVERAGE_BASE_SHA?.trim();
  return exactBase || 'HEAD^';
};

export const listChangedServices = (
  baseRef,
  { execute = execFileSync } = {},
) => execute(
  'git',
  [
    'diff',
    '--diff-filter=ACMR',
    '--name-only',
    `${baseRef}...HEAD`,
    '--',
    ':(glob)app/backend/src/**/*.service.ts',
    ':(glob)app/backend/src/**/*.persistence.ts',
  ],
  { encoding: 'utf8' },
).trim().split(/\r?\n/).filter(Boolean);
