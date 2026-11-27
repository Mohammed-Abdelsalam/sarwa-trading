import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { type AdminInvite as InviteRow, Prisma } from '@prisma/client';

import {
  type AcceptInviteRequest,
  AUTH_TTL_MS,
  type CreateInviteRequest,
  type InviteInfo,
  type InviteRow as Invite,
  type Role,
} from '@sarwa/contracts';

import { Mailer } from '../auth/mailer';
import { expired } from '../auth/one-time-tokens.service';
import { newSecret, sha256 } from '../auth/secrets';
import { Clock } from '../common/clock';
import { PasswordHasher } from '../common/password-hasher';
import { env } from '../env';
import { PrismaService } from '../prisma.service';
import { AdminAuthService, type SignedIn } from './admin-auth.service';
import { type Actor, AuditService } from './audit.service';

const alreadyAdmin = (email: string) => new ConflictException(`${email} already has an account`);

// Admins join by a 48-hour, single-use emailed link; nobody sets a password for someone else.
@Injectable()
export class AdminInvitesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly hasher: PasswordHasher,
    private readonly mailer: Mailer,
    private readonly audit: AuditService,
    private readonly auth: AdminAuthService,
  ) {}

  // A new invite replaces any earlier one for the same email.
  async create({ email, role }: CreateInviteRequest, actor: Actor): Promise<Invite> {
    if (await this.prisma.adminUser.findUnique({ where: { email } })) throw alreadyAdmin(email);
    const token = newSecret();
    const now = this.clock.now();
    const invite = await this.prisma.$transaction(async (tx) => {
      await tx.adminInvite.updateMany({
        where: { email, acceptedAt: null, revokedAt: null },
        data: { revokedAt: new Date(now) },
      });
      const created = await tx.adminInvite.create({
        data: {
          email,
          role,
          tokenHash: sha256(token),
          invitedBy: actor.email,
          createdAt: new Date(now),
          expiresAt: new Date(now + AUTH_TTL_MS.adminInvite),
        },
      });
      await this.audit.log(
        {
          actorEmail: actor.email,
          action: 'user.invite',
          entity: `User · ${email}`,
          payload: { email, role },
          ip: actor.ip,
        },
        tx,
      );
      return created;
    });
    await this.mailer.send({
      to: email,
      kind: 'admin_invite',
      subject: 'You are invited to the Mini Trading admin',
      link: `${env.ADMIN_URL}/invite/${token}`,
    });
    return this.toInvite(invite);
  }

  async list(): Promise<Invite[]> {
    const rows = await this.prisma.adminInvite.findMany({
      where: { acceptedAt: null, revokedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => this.toInvite(row));
  }

  // A fresh link and a full 48 hours; create() revokes the old link.
  async resend(id: string, actor: Actor): Promise<Invite> {
    const invite = await this.prisma.adminInvite.findFirst({
      where: { id, acceptedAt: null, revokedAt: null },
    });
    if (!invite) throw new NotFoundException('Invite not found');
    return this.create({ email: invite.email, role: invite.role as Role }, actor);
  }

  async revoke(id: string): Promise<void> {
    const { count } = await this.prisma.adminInvite.updateMany({
      where: { id, acceptedAt: null, revokedAt: null },
      data: { revokedAt: new Date(this.clock.now()) },
    });
    if (count === 0) throw new NotFoundException('Invite not found');
  }

  async info(token: string): Promise<InviteInfo> {
    const invite = await this.usable(token);
    return {
      email: invite.email,
      role: invite.role as Role,
      expiresAt: invite.expiresAt.toISOString(),
    };
  }

  // Creates the admin and signs them in, in the same step.
  async accept({ token, name, password }: AcceptInviteRequest, ip?: string): Promise<SignedIn> {
    const invite = await this.usable(token);
    const passwordHash = await this.hasher.hash(password);
    const now = new Date(this.clock.now());
    const user = await this.prisma
      .$transaction(async (tx) => {
        const { count } = await tx.adminInvite.updateMany({
          where: { id: invite.id, acceptedAt: null, revokedAt: null },
          data: { acceptedAt: now },
        });
        if (count === 0) throw expired();
        const created = await tx.adminUser.create({
          data: { email: invite.email, name, role: invite.role, passwordHash, lastActiveAt: now },
        });
        await this.audit.log(
          {
            actorEmail: invite.email,
            action: 'user.invite_accepted',
            entity: `User · ${invite.email}`,
            payload: { role: invite.role, invitedBy: invite.invitedBy },
            ip,
          },
          tx,
        );
        return created;
      })
      .catch((error: unknown) => {
        const taken =
          error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
        throw taken ? alreadyAdmin(invite.email) : error;
      });
    return this.auth.issue(user, false);
  }

  private async usable(token: string): Promise<InviteRow> {
    const invite = await this.prisma.adminInvite.findUnique({
      where: { tokenHash: sha256(token) },
    });
    const open =
      invite &&
      !invite.acceptedAt &&
      !invite.revokedAt &&
      invite.expiresAt.getTime() > this.clock.now();
    if (!open) throw expired();
    return invite;
  }

  private toInvite(row: InviteRow): Invite {
    return {
      id: row.id,
      email: row.email,
      role: row.role as Role,
      invitedBy: row.invitedBy,
      status: row.expiresAt.getTime() > this.clock.now() ? 'pending' : 'expired',
      createdAt: row.createdAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
    };
  }
}
