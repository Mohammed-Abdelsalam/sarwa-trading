import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';

import {
  type Account,
  ADMIN_ROUTES,
  type AdminAccountsResponse,
  AdminAccountsQuerySchema,
  type AdminOrderStats,
  type AdminOrdersResponse,
  AdminOrdersQuerySchema,
  type AdminTrading,
  type CreateHalt,
  CreateHaltSchema,
  type Halt,
  type HaltImpact,
  type ResetAccount,
  ResetAccountSchema,
  SymbolSchema,
  type UpdateTrading,
  UpdateTradingSchema,
} from '@sarwa/contracts';

import { type Actor } from '../admin/audit.service';
import { AdminGuard, CurrentActor, Roles } from '../admin/auth';
import { IdParam } from '../common/params';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { TradingConfigService } from '../trading-config/trading-config.service';
import { AdminAccountsService } from './admin-accounts.service';
import { AdminOrdersService } from './admin-orders.service';
import { HaltsService } from './halts.service';
import { StatusService } from './status.service';

@Controller()
@UseGuards(AdminGuard)
export class AdminTradingController {
  constructor(
    private readonly config: TradingConfigService,
    private readonly halts: HaltsService,
    private readonly status: StatusService,
  ) {}

  @Get(ADMIN_ROUTES.trading)
  trading(): AdminTrading {
    return this.status.admin();
  }

  @Patch(ADMIN_ROUTES.trading)
  @Roles(['ADMIN'])
  async update(
    @Body(new ZodValidationPipe(UpdateTradingSchema)) patch: UpdateTrading,
    @CurrentActor() actor: Actor,
  ): Promise<AdminTrading> {
    await this.config.update(patch, actor);
    return this.status.admin();
  }

  @Get(ADMIN_ROUTES.haltImpact)
  impact(
    @Query(new ZodValidationPipe(z.object({ symbol: SymbolSchema })))
    { symbol }: { symbol: string },
  ): Promise<HaltImpact> {
    return this.halts.impact(symbol);
  }

  @Post(ADMIN_ROUTES.halts)
  @Roles(['ADMIN'])
  halt(
    @Body(new ZodValidationPipe(CreateHaltSchema)) input: CreateHalt,
    @CurrentActor() actor: Actor,
  ): Promise<Halt> {
    return this.halts.adminHalt(input, actor);
  }

  @Post(ADMIN_ROUTES.resumeHalt)
  @Roles(['ADMIN'])
  @HttpCode(204)
  resume(
    @Param('symbol', new ZodValidationPipe(SymbolSchema)) symbol: string,
    @CurrentActor() actor: Actor,
  ): Promise<void> {
    return this.halts.adminResume(symbol, actor);
  }
}

@Controller()
@UseGuards(AdminGuard)
export class AdminOrdersController {
  constructor(private readonly orders: AdminOrdersService) {}

  @Get(ADMIN_ROUTES.orders)
  list(
    @Query(new ZodValidationPipe(AdminOrdersQuerySchema))
    query: z.output<typeof AdminOrdersQuerySchema>,
  ): Promise<AdminOrdersResponse> {
    return this.orders.list(query);
  }

  @Get(ADMIN_ROUTES.orderStats)
  stats(): Promise<AdminOrderStats> {
    return this.orders.stats();
  }
}

@Controller()
@UseGuards(AdminGuard)
export class AdminAccountsController {
  constructor(private readonly accounts: AdminAccountsService) {}

  @Get(ADMIN_ROUTES.accounts)
  list(
    @Query(new ZodValidationPipe(AdminAccountsQuerySchema))
    query: z.output<typeof AdminAccountsQuerySchema>,
  ): Promise<AdminAccountsResponse> {
    return this.accounts.list(query);
  }

  @Post(ADMIN_ROUTES.resetAccount)
  @Roles(['ADMIN'])
  @HttpCode(200)
  reset(
    @IdParam() id: string,
    @Body(new ZodValidationPipe(ResetAccountSchema)) { confirm }: ResetAccount,
    @CurrentActor() actor: Actor,
  ): Promise<Account> {
    return this.accounts.reset(id, confirm, actor);
  }
}
