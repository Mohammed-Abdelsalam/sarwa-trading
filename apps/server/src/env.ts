import { z } from 'zod';

try {
  process.loadEnvFile();
} catch {
  // No .env file: use the real environment (CI, production).
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

export const env = EnvSchema.parse(process.env);
