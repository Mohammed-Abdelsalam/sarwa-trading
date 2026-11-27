import bcrypt from 'bcryptjs';

import { PasswordHasher } from '../../src/common/password-hasher';

describe('PasswordHasher', () => {
  const hasher = new PasswordHasher();

  it('hashes new passwords with argon2id', async () => {
    const hashed = await hasher.hash('correct horse battery');

    expect(hashed.startsWith('$argon2id$')).toBe(true);
    await expect(hasher.verify(hashed, 'correct horse battery')).resolves.toBe(true);
    await expect(hasher.verify(hashed, 'wrong horse battery')).resolves.toBe(false);
    expect(hasher.needsRehash(hashed)).toBe(false);
  });

  it('still verifies the bcrypt hashes admins were created with, and asks to upgrade them', async () => {
    const legacy = await bcrypt.hash('admin12345', 4);

    await expect(hasher.verify(legacy, 'admin12345')).resolves.toBe(true);
    await expect(hasher.verify(legacy, 'admin54321')).resolves.toBe(false);
    expect(hasher.needsRehash(legacy)).toBe(true);
  });

  it('never accepts a password when there is no hash to check it against', async () => {
    await expect(hasher.verify(undefined, 'not-a-real-password')).resolves.toBe(false);
  });

  it('treats a corrupt hash as a mismatch rather than a crash', async () => {
    await expect(hasher.verify('$argon2id$garbage', 'x')).resolves.toBe(false);
  });
});
