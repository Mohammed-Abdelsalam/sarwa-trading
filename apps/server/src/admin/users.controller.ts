import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { type AdminUser as AdminUserRow } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { type Request } from 'express';

import {
  type AdminUser,
  type CreateUser,
  CreateUserSchema,
  type UpdateUser,
  UpdateUserSchema,
  type UsersResponse,
} from '@sarwa/contracts';

import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { PrismaService } from '../prisma.service';
import { AuditService } from './audit.service';
import { AdminGuard, CurrentAdmin, Roles, toAdminUser } from './auth';

@Controller('admin/users')
@UseGuards(AdminGuard)
export class UsersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  async list(): Promise<UsersResponse> {
    const rows = await this.prisma.adminUser.findMany({ orderBy: { createdAt: 'asc' } });
    return { items: rows.map(toAdminUser) };
  }

  @Post()
  @Roles(['ADMIN'])
  async create(
    @Body(new ZodValidationPipe(CreateUserSchema)) input: CreateUser,
    @CurrentAdmin() admin: AdminUserRow,
    @Req() request: Request,
  ): Promise<AdminUser> {
    const email = input.email.toLowerCase();
    if (await this.prisma.adminUser.findUnique({ where: { email } })) {
      throw new ConflictException(`${email} already has an account`);
    }
    const row = await this.prisma.adminUser.create({
      data: {
        email,
        name: input.name,
        role: input.role,
        passwordHash: await bcrypt.hash(input.password, 10),
      },
    });
    await this.audit.log({
      actorEmail: admin.email,
      action: 'user.create',
      entity: `User · ${email}`,
      payload: { email, role: input.role },
      ip: request.ip,
    });
    return toAdminUser(row);
  }

  /**
   * Change role or enable/disable. Guard rails from the design: you can't change your own
   * account, and at least one active ADMIN must remain.
   */
  @Patch(':id')
  @Roles(['ADMIN'])
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateUserSchema)) changes: UpdateUser,
    @CurrentAdmin() admin: AdminUserRow,
    @Req() request: Request,
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

    const row = await this.prisma.adminUser.update({ where: { id }, data: changes });
    await this.audit.log({
      actorEmail: admin.email,
      action: changes.role ? 'user.role' : 'user.status',
      entity: `User · ${row.email}`,
      payload: {
        ...(changes.role && { role: { from: target.role, to: changes.role } }),
        ...(changes.status && { status: { from: target.status, to: changes.status } }),
      },
      ip: request.ip,
    });
    return toAdminUser(row);
  }
}
