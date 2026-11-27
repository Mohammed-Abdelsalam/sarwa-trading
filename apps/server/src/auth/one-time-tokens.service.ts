import { GoneException, Injectable } from '@nestjs/common';

import { AUTH_TTL_MS, ErrorCode } from '@sarwa/contracts';

import { Clock } from '../common/clock';
import { PrismaService } from '../prisma.service';
import { newSecret, sha256 } from './secrets';

export type TokenKind = 'passwordReset' | 'emailVerify';

interface TokenRow {
  userId: string;
  expiresAt: Date;
  usedAt: Date | null;
  user: { email: string };
}

interface TokenTable {
  create(args: {
    data: { userId: string; tokenHash: string; createdAt: Date; expiresAt: Date };
  }): Promise<unknown>;
  findUnique(args: {
    where: { tokenHash: string };
    include: { user: { select: { email: true } } };
  }): Promise<TokenRow | null>;
  updateMany(args: {
    where: { tokenHash: string; usedAt: null; expiresAt: { gt: Date } };
    data: { usedAt: Date };
  }): Promise<{ count: number }>;
}

// Single-use emailed links: the raw token only travels in the email; the database keeps its hash.
@Injectable()
export class OneTimeTokens {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
  ) {}

  async issue(kind: TokenKind, userId: string): Promise<string> {
    const token = newSecret();
    const now = this.clock.now();
    const ttl = kind === 'passwordReset' ? AUTH_TTL_MS.passwordReset : AUTH_TTL_MS.emailVerify;
    await this.table(kind).create({
      data: {
        userId,
        tokenHash: sha256(token),
        createdAt: new Date(now),
        expiresAt: new Date(now + ttl),
      },
    });
    return token;
  }

  // Who the link is for, without using it up (the reset page shows the email first).
  async peek(kind: TokenKind, token: string): Promise<{ userId: string; email: string }> {
    const row = await this.find(kind, token);
    return { userId: row.userId, email: row.user.email };
  }

  async consume(kind: TokenKind, token: string): Promise<{ userId: string; email: string }> {
    const row = await this.find(kind, token);
    const { count } = await this.table(kind).updateMany({
      where: {
        tokenHash: sha256(token),
        usedAt: null,
        expiresAt: { gt: new Date(this.clock.now()) },
      },
      data: { usedAt: new Date(this.clock.now()) },
    });
    if (count === 0) throw expired(row.user.email);
    return { userId: row.userId, email: row.user.email };
  }

  private async find(kind: TokenKind, token: string): Promise<TokenRow> {
    const row = await this.table(kind).findUnique({
      where: { tokenHash: sha256(token) },
      include: { user: { select: { email: true } } },
    });
    if (!row) throw expired();
    if (row.usedAt || row.expiresAt.getTime() <= this.clock.now()) throw expired(row.user.email);
    return row;
  }

  private table(kind: TokenKind): TokenTable {
    return kind === 'passwordReset'
      ? this.prisma.passwordResetToken
      : this.prisma.emailVerificationToken;
  }
}

export const expired = (email?: string) =>
  new GoneException({
    code: ErrorCode.TokenExpired,
    message: 'This link has expired',
    ...(email && { email }),
  });
