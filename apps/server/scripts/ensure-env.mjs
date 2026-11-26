// First-run helper: create .env from .env.example so `pnpm dev` works right after cloning.
import { copyFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const env = join(root, '.env');

if (!existsSync(env)) {
  copyFileSync(join(root, '.env.example'), env);
  console.log('[server] created .env from .env.example');
}
