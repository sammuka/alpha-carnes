import { z } from 'zod';

export const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('8h'),
  COOKIE_SECURE: z.string().default('false').transform((v) => v === 'true'),
  THROTTLE_LOGIN_LIMIT: z.coerce.number().int().positive().default(5),
  THROTTLE_LOGIN_TTL: z.coerce.number().int().positive().default(60000),
  CORS_ORIGIN: z.string().url().default('http://localhost:4000'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  PORT: z.coerce.number().int().positive().default(3001),
});

export type Env = z.infer<typeof envSchema>;
