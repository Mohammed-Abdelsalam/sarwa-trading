import { createHash, randomBytes } from 'node:crypto';

// Opaque tokens (refresh, reset, verify, invite, CSRF) are random; only their sha256 is stored.
export const newSecret = (): string => randomBytes(32).toString('base64url');

export const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');
