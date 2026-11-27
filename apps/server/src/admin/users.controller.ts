import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { type AdminUser as AdminUserRow } from '@prisma/client';
import bcrypt from 'bcryptjs';

import {
  ADMIN_ROUTES,
  type AdminUser,
  type CreateUser,
  CreateUserSchema,
  type UpdateUser,
  UpdateUserSchema,
  type UsersResponse,
} from '@sarwa/contracts';

import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { PrismaService } from '../prisma.service';
import { type Actor, AuditService } from './audit.service';
import { AdminGuard, CurrentActor, CurrentAdmin, Roles, toAdminUser } from './auth';

@Controller()
@UseGuards(AdminGuard)
export class UsersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // Emails and roles of every admin are only for admins.
  @Get(ADMIN_ROUTES.users)
  @Roles(['ADMIN'])
  async list(): Promise<UsersResponse> {
    const rows = await this.prisma.adminUser.findMany({ orderBy: { createdAt: 'asc' } });
    return { items: rows.map(toAdminUser) };
  }

  @Post(ADMIN_ROUTES.users)
  @Roles(['ADMIN'])
  async create(
    @Body(new ZodValidationPipe(CreateUserSchema)) input: CreateUser,
    @CurrentActor() actor: Actor,
  ): Promise<AdminUser> {
    const email = input.email.toLowerCase();
    if (await this.prisma.adminUser.findUnique({ where: { email } })) {
      throw new ConflictException(`${email} already has an account`);
    }
    const passwordHash = await bcrypt.hash(input.password, 10);
    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.adminUser.create({
        data: { email, name: input.name, role: input.role, passwordHash },
      });
      await this.audit.log(
        {
          actorEmail: actor.email,
          action: 'user.create',
          entity: `User · ${email}`,
          payload: { email, role: input.role },
          ip: actor.ip,
        },
        tx,
      );
      return created;
    });
    return toAdminUser(row);
  }

  @Patch(ADMIN_ROUTES.user)
  @Roles(['ADMIN'])
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateUserSchema)) changes: UpdateUser,
    @CurrentAdmin() admin: AdminUserRow,
    @CurrentActor() actor: Actor,
  ): Promise<AdminUser> {
    if (id === admin.id) throw new BadRequestException("You can't change your own role or status");

    const target = await this.prisma.adminUser.findUniqueOrThrow({ where: { id } });
    const losesAdmin =
      target.role === 'ADMIN' &&
      target.status === 'active' &&
      (changes.role === 'VIEWER' || changes.status === 'disabled');
    if (losesAdmin) {
      const activeAdmins = await this.prisma.adminUser.count({
        where: { role: 'ADMIN', status: 'active' },
      });
      if (activeAdmins <= 1) throw new BadRequestException('At least one ADMIN must remain active');
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

    const row = await this.prisma.$transaction(async (tx) => {
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
    return toAdminUser(row);
  }
}
