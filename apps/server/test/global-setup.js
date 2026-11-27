const { execFileSync } = require('node:child_process');
const { rmSync } = require('node:fs');
const { join } = require('node:path');

// Builds a throwaway test database; dev.db is never touched.
module.exports = () => {
  const root = join(__dirname, '..');
  rmSync(join(root, 'prisma', 'test.db'), { force: true });
  for (const suffix of ['-journal', '-wal', '-shm']) {
    rmSync(join(root, 'prisma', `test.db${suffix}`), { force: true });
  }

  const options = {
    cwd: root,
    env: { ...process.env, DATABASE_URL: 'file:./test.db' },
    stdio: 'pipe',
  };
  execFileSync(
    process.execPath,
    [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'],
    options,
  );
  execFileSync(process.execPath, [require.resolve('tsx/cli'), 'prisma/seed.ts'], options);
};
