import { z } from 'zod';

try {
  process.loadEnvFile();
} catch {
  // No .env file: use the real environment (CI, production).
}

const EXAMPLE_SECRET = 'dev-only-change-me-to-a-long-random-string';

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    DATABASE_URL: z.string().min(1),
    CORS_ORIGINS: z
      .string()
      .default('http://localhost:3000,http://localhost:3001,http://localhost:8081')
      .transform((value) => value.split(',').map((origin) => origin.trim())),
    JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
    // Which proxies may set X-Forwarded-For, in Express syntax: "loopback", a hop count or a list.
    TRUST_PROXY: z
      .string()
      .default('loopback')
      .transform((value) => (/^\d+$/.test(value) ? Number(value) : value)),
  })
  .superRefine((value, ctx) => {
    if (value.NODE_ENV !== 'production') return;
    if (value.JWT_SECRET.length < 32 || value.JWT_SECRET === EXAMPLE_SECRET) {
      ctx.addIssue({
        code: 'custom',
        path: ['JWT_SECRET'],
        message: 'Use a random JWT_SECRET of at least 32 characters in production',
      });
    }
  });

export const parseEnv = (source: NodeJS.ProcessEnv) => EnvSchema.parse(source);

export const env = parseEnv(process.env);
