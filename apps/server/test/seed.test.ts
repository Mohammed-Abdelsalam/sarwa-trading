import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const root = join(__dirname, '..');

describe('seed', () => {
  it('refuses to create admins with the public demo passwords in production', () => {
    const result = spawnSync(process.execPath, [require.resolve('tsx/cli'), 'prisma/seed.ts'], {
      cwd: root,
      encoding: 'utf8',
      env: {
        PATH: process.env.PATH,
        SystemRoot: process.env.SystemRoot,
        NODE_ENV: 'production',
        DATABASE_URL: 'file:./never-created.db',
        // Empty rather than absent: Prisma loads apps/server/.env but never overrides a set variable.
        ADMIN_EMAIL: '',
        ADMIN_PASSWORD: '',
        VIEWER_EMAIL: '',
        VIEWER_PASSWORD: '',
      },
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Set ADMIN_EMAIL to seed production');
  });
});
