import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { type AdminUser as AdminUserRow } from '@prisma/client';

import {
  ADMIN_ROUTES,
  type AdminUser,
  type CreateUser,
  CreateUserSchema,
  type UpdateUser,
  UpdateUserSchema,
  type UsersResponse,
} from '@sarwa/contracts';

import { IdParam } from '../common/params';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AdminUsersService } from './admin-users.service';
import { type Actor } from './audit.service';
import { AdminGuard, CurrentActor, CurrentAdmin, Roles } from './auth';

@Controller()
@UseGuards(AdminGuard)
export class UsersController {
  constructor(private readonly users: AdminUsersService) {}

  // Emails and roles of every admin are only for admins.
  @Get(ADMIN_ROUTES.users)
  @Roles(['ADMIN'])
  list(): Promise<UsersResponse> {
    return this.users.list();
  }

  @Post(ADMIN_ROUTES.users)
  @Roles(['ADMIN'])
  create(
    @Body(new ZodValidationPipe(CreateUserSchema)) input: CreateUser,
    @CurrentActor() actor: Actor,
  ): Promise<AdminUser> {
    return this.users.create(input, actor);
  }

  @Patch(ADMIN_ROUTES.user)
  @Roles(['ADMIN'])
  update(
    @IdParam() id: string,
    @Body(new ZodValidationPipe(UpdateUserSchema)) changes: UpdateUser,
    @CurrentAdmin() admin: AdminUserRow,
    @CurrentActor() actor: Actor,
  ): Promise<AdminUser> {
    return this.users.update(id, changes, admin.id, actor);
  }
}
