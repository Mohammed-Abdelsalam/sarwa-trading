import { BadRequestException, Injectable } from '@nestjs/common';

import { type AdminUser, type UpdateUser, type UsersResponse } from '@sarwa/contracts';

import { PrismaService } from '../prisma.service';
import { AdminGateway } from './admin.gateway';
import { type Actor, AuditService } from './audit.service';
import { toAdminUser } from './auth';

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly gateway: AdminGateway,
  ) {}

  async list(): Promise<UsersResponse> {
    const rows = await this.prisma.adminUser.findMany({ orderBy: { createdAt: 'asc' } });
    return { items: rows.map(toAdminUser) };
  }

  async update(id: string, changes: UpdateUser, adminId: string, actor: Actor): Promise<AdminUser> {
    if (id === adminId) throw new BadRequestException("You can't change your own role or status");

    // The check and the change share one transaction, so two concurrent demotions can't both pass.
    const row = await this.prisma.$transaction(async (tx) => {
      const target = await tx.adminUser.findUniqueOrThrow({ where: { id } });
      const losesAdmin =
        target.role === 'ADMIN' &&
        target.status === 'active' &&
        (changes.role === 'VIEWER' || changes.status === 'disabled');
      if (losesAdmin) {
        const activeAdmins = await tx.adminUser.count({
          where: { role: 'ADMIN', status: 'active' },
        });
        if (activeAdmins <= 1) {
          throw new BadRequestException('At least one ADMIN must remain active');
        }
      }

      const entries = [
        changes.role && changes.role !== target.role
          ? {
              action: 'user.role' as const,
              payload: { before: { role: target.role }, after: { role: changes.role } },
            }
          : null,
        changes.status && changes.status !== target.status
          ? {
              action: 'user.status' as const,
              payload: { before: { status: target.status }, after: { status: changes.status } },
            }
          : null,
      ].filter((entry) => entry !== null);

      const updated = await tx.adminUser.update({ where: { id }, data: changes });
      for (const { action, payload } of entries) {
        await this.audit.log(
          {
            actorEmail: actor.email,
            action,
            entity: `User · ${updated.email}`,
            payload,
            ip: actor.ip,
          },
          tx,
        );
      }
      return updated;
    });
    // A live dashboard socket was only checked at connect; it reconnects with the new role, if any.
    if (changes.role !== undefined || changes.status !== undefined) this.gateway.dropAdmin(id);
    return toAdminUser(row);
  }
}
