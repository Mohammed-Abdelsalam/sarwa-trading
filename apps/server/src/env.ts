import { z } from 'zod';

// Node ≥ 20.12 loads .env natively — no dotenv dependency needed.
try {
  process.loadEnvFile();
} catch {
  // no .env file: rely on the real environment (CI, production)
}

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:3000,http://localhost:3001,http://localhost:8081')
    .transform((value) => value.split(',').map((origin) => origin.trim())),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
});

/** Validated once at startup: a missing or invalid variable fails fast with a clear message. */
export const env = EnvSchema.parse(process.env);
