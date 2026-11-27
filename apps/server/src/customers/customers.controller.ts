import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { type AdminUser as AdminUserRow } from '@prisma/client';
import { type Response } from 'express';
import { type z } from 'zod';

import {
  AccountHandleSchema,
  ADMIN_ROUTES,
  type CustomerActionResponse,
  type CustomerActivityResponse,
  type CustomerDetail,
  type CustomerKpis,
  CustomerPageQuerySchema,
  type CustomerReasonRequest,
  CustomerReasonRequestSchema,
  type CustomerRevealResponse,
  CustomersQuerySchema,
  type CustomersResponse,
  type CustomerSessionsResponse,
  OrdersQuerySchema,
  type OrdersResponse,
  type ResetCustomerAccountRequest,
  ResetCustomerAccountRequestSchema,
  type SuspendCustomerRequest,
  SuspendCustomerRequestSchema,
} from '@sarwa/contracts';

import { type Actor } from '../admin/audit.service';
import { AdminGuard, CurrentActor, CurrentAdmin, Roles } from '../admin/auth';
import { CustomerMetrics } from '../auth/customer-metrics.service';
import { piiViewOf } from '../common/pii';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AdminCustomersService } from './admin-customers.service';
import { CustomerActionsService } from './customer-actions.service';

const HandleParam = () => Param('handle', new ZodValidationPipe(AccountHandleSchema));
const viewOf = (admin: AdminUserRow) => piiViewOf(admin.role);

// Static paths (kpis, export.csv) are declared before :handle so they match first.
@Controller()
@UseGuards(AdminGuard)
export class CustomersController {
  constructor(
    private readonly customers: AdminCustomersService,
    private readonly actions: CustomerActionsService,
    private readonly metrics: CustomerMetrics,
  ) {}

  @Get(ADMIN_ROUTES.customers)
  list(
    @Query(new ZodValidationPipe(CustomersQuerySchema))
    query: z.output<typeof CustomersQuerySchema>,
    @CurrentAdmin() admin: AdminUserRow,
  ): Promise<CustomersResponse> {
    return this.customers.list(query, viewOf(admin));
  }

  @Get(ADMIN_ROUTES.customerKpis)
  kpis(): Promise<CustomerKpis> {
    return this.metrics.kpis();
  }

  @Get(ADMIN_ROUTES.customersExport)
  @Roles(['ADMIN'])
  async export(
    @Query(new ZodValidationPipe(CustomersQuerySchema))
    query: z.output<typeof CustomersQuerySchema>,
    @CurrentActor() actor: Actor,
    @Res({ passthrough: true }) response: Response,
  ): Promise<string> {
    const csv = await this.actions.exportCsv(query, actor);
    response.type('text/csv').attachment('customers.csv');
    return csv;
  }

  @Get(ADMIN_ROUTES.customer)
  detail(
    @HandleParam() handle: string,
    @CurrentAdmin() admin: AdminUserRow,
  ): Promise<CustomerDetail> {
    return this.customers.detail(handle, viewOf(admin));
  }

  @Get(ADMIN_ROUTES.customerOrders)
  orders(
    @HandleParam() handle: string,
    @Query(new ZodValidationPipe(OrdersQuerySchema))
    query: z.output<typeof OrdersQuerySchema>,
  ): Promise<OrdersResponse> {
    return this.customers.ordersOf(handle, query);
  }

  @Get(ADMIN_ROUTES.customerSessions)
  async sessions(@HandleParam() handle: string): Promise<CustomerSessionsResponse> {
    return { items: await this.customers.sessionsOf(handle) };
  }

  @Get(ADMIN_ROUTES.customerActivity)
  activity(
    @HandleParam() handle: string,
    @Query(new ZodValidationPipe(CustomerPageQuerySchema))
    query: z.output<typeof CustomerPageQuerySchema>,
    @CurrentAdmin() admin: AdminUserRow,
  ): Promise<CustomerActivityResponse> {
    return this.customers.activity(handle, query, viewOf(admin));
  }

  @Post(ADMIN_ROUTES.suspendCustomer)
  @Roles(['ADMIN'])
  @HttpCode(200)
  suspend(
    @HandleParam() handle: string,
    @Body(new ZodValidationPipe(SuspendCustomerRequestSchema)) request: SuspendCustomerRequest,
    @CurrentActor() actor: Actor,
    @CurrentAdmin() admin: AdminUserRow,
  ): Promise<CustomerActionResponse> {
    return this.actions.suspend(handle, request, actor, viewOf(admin));
  }

  @Post(ADMIN_ROUTES.reactivateCustomer)
  @Roles(['ADMIN'])
  @HttpCode(200)
  reactivate(
    @HandleParam() handle: string,
    @Body(new ZodValidationPipe(CustomerReasonRequestSchema)) { reason }: CustomerReasonRequest,
    @CurrentActor() actor: Actor,
    @CurrentAdmin() admin: AdminUserRow,
  ): Promise<CustomerActionResponse> {
    return this.actions.reactivate(handle, reason, actor, viewOf(admin));
  }

  @Post(ADMIN_ROUTES.signOutCustomer)
  @Roles(['ADMIN'])
  @HttpCode(200)
  signOutAll(
    @HandleParam() handle: string,
    @Body(new ZodValidationPipe(CustomerReasonRequestSchema)) { reason }: CustomerReasonRequest,
    @CurrentActor() actor: Actor,
    @CurrentAdmin() admin: AdminUserRow,
  ): Promise<CustomerActionResponse> {
    return this.actions.signOutAll(handle, reason, actor, viewOf(admin));
  }

  @Post(ADMIN_ROUTES.sendCustomerReset)
  @Roles(['ADMIN'])
  @HttpCode(200)
  sendPasswordReset(
    @HandleParam() handle: string,
    @Body(new ZodValidationPipe(CustomerReasonRequestSchema)) { reason }: CustomerReasonRequest,
    @CurrentActor() actor: Actor,
    @CurrentAdmin() admin: AdminUserRow,
  ): Promise<CustomerActionResponse> {
    return this.actions.sendPasswordReset(handle, reason, actor, viewOf(admin));
  }

  @Post(ADMIN_ROUTES.resetCustomerAccount)
  @Roles(['ADMIN'])
  @HttpCode(200)
  resetPaperAccount(
    @HandleParam() handle: string,
    @Body(new ZodValidationPipe(ResetCustomerAccountRequestSchema))
    request: ResetCustomerAccountRequest,
    @CurrentActor() actor: Actor,
    @CurrentAdmin() admin: AdminUserRow,
  ): Promise<CustomerActionResponse> {
    return this.actions.resetPaperAccount(handle, request, actor, viewOf(admin));
  }

  @Post(ADMIN_ROUTES.revealCustomer)
  @Roles(['ADMIN'])
  @HttpCode(200)
  reveal(
    @HandleParam() handle: string,
    @CurrentActor() actor: Actor,
  ): Promise<CustomerRevealResponse> {
    return this.actions.revealIps(handle, actor);
  }
}
