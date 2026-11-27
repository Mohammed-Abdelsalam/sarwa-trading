import { Global, Injectable, Module } from '@nestjs/common';
import { hash, hashSync, verify } from '@node-rs/argon2';
import bcrypt from 'bcryptjs';

const ARGON2ID = '$argon2id$';
const DUMMY_HASH = hashSync('not-a-real-password');

// New hashes are argon2id. Admins created before it have bcrypt hashes, upgraded at sign-in.
@Injectable()
export class PasswordHasher {
  hash(password: string): Promise<string> {
    return hash(password);
  }

  // Without a hash (an unknown email) it still does the work, so the timing reveals nothing.
  async verify(hashed: string | undefined, password: string): Promise<boolean> {
    if (hashed?.startsWith('$2')) return bcrypt.compare(password, hashed);
    try {
      const valid = await verify(hashed ?? DUMMY_HASH, password);
      return hashed !== undefined && valid;
    } catch {
      return false;
    }
  }

  needsRehash(hashed: string): boolean {
    return !hashed.startsWith(ARGON2ID);
  }
}

@Global()
@Module({ providers: [PasswordHasher], exports: [PasswordHasher] })
export class PasswordModule {}
