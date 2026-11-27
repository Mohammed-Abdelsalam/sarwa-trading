import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';

import {
  type Account,
  type AlertResponse,
  type AlertsResponse,
  type CreateAlertRequest,
  CreateAlertRequestSchema,
  type EquityResponse,
  EquityQuerySchema,
  type NotificationsQuery,
  NotificationsQuerySchema,
  type NotificationsResponse,
  type PortfolioResponse,
  type PushTokenRequest,
  PushTokenRequestSchema,
  type TradingStatus,
  TRADING_ROUTES,
  type UpdateAlertRequest,
  UpdateAlertRequestSchema,
} from '@sarwa/contracts';

import { CurrentAccountId, Public } from '../auth/customer.guard';
import { WritableGuard } from '../common/device';
import { IdParam } from '../common/params';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AccountsService } from './accounts.service';
import { AlertsService } from './alerts.service';
import { toAccount } from './mappers';
import { NotificationsService } from './notifications.service';
import { PortfolioService } from './portfolio.service';
import { StatusService } from './status.service';

@Controller()
export class AccountController {
  constructor(
    private readonly accounts: AccountsService,
    private readonly portfolio: PortfolioService,
    private readonly status: StatusService,
  ) {}

  @Get(TRADING_ROUTES.account)
  async account(@CurrentAccountId() accountId: string): Promise<Account> {
    return toAccount(await this.accounts.get(accountId));
  }

  @Get(TRADING_ROUTES.portfolio)
  books(@CurrentAccountId() accountId: string): Promise<PortfolioResponse> {
    return this.portfolio.books(accountId);
  }

  @Get(TRADING_ROUTES.equity)
  equity(
    @CurrentAccountId() accountId: string,
    @Query(new ZodValidationPipe(EquityQuerySchema)) { period }: z.output<typeof EquityQuerySchema>,
  ): Promise<EquityResponse> {
    return this.portfolio.equity(accountId, period);
  }

  @Get(TRADING_ROUTES.tradingStatus)
  @Public()
  tradingStatus(): TradingStatus {
    return this.status.status();
  }
}

@Controller()
export class AlertsController {
  constructor(private readonly alerts: AlertsService) {}

  @Get(TRADING_ROUTES.alerts)
  list(@CurrentAccountId() accountId: string): Promise<AlertsResponse> {
    return this.alerts.list(accountId);
  }

  @Post(TRADING_ROUTES.alerts)
  @UseGuards(WritableGuard)
  async create(
    @CurrentAccountId() accountId: string,
    @Body(new ZodValidationPipe(CreateAlertRequestSchema)) request: CreateAlertRequest,
  ): Promise<AlertResponse> {
    return { alert: await this.alerts.create(accountId, request) };
  }

  @Patch(TRADING_ROUTES.alert)
  @UseGuards(WritableGuard)
  async update(
    @CurrentAccountId() accountId: string,
    @IdParam() id: string,
    @Body(new ZodValidationPipe(UpdateAlertRequestSchema)) patch: UpdateAlertRequest,
  ): Promise<AlertResponse> {
    return { alert: await this.alerts.update(accountId, id, patch) };
  }

  @Delete(TRADING_ROUTES.alert)
  @UseGuards(WritableGuard)
  @HttpCode(204)
  remove(@CurrentAccountId() accountId: string, @IdParam() id: string): Promise<void> {
    return this.alerts.remove(accountId, id);
  }
}

@Controller()
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get(TRADING_ROUTES.notifications)
  list(
    @CurrentAccountId() accountId: string,
    @Query(new ZodValidationPipe(NotificationsQuerySchema)) query: NotificationsQuery,
  ): Promise<NotificationsResponse> {
    return this.notifications.list(accountId, query);
  }

  @Post(TRADING_ROUTES.notificationsReadAll)
  @UseGuards(WritableGuard)
  @HttpCode(204)
  readAll(@CurrentAccountId() accountId: string): Promise<void> {
    return this.notifications.markAllRead(accountId);
  }

  @Post(TRADING_ROUTES.notificationRead)
  @UseGuards(WritableGuard)
  @HttpCode(204)
  read(@CurrentAccountId() accountId: string, @IdParam() id: string): Promise<void> {
    return this.notifications.markRead(accountId, id);
  }

  @Post(TRADING_ROUTES.pushTokens)
  @UseGuards(WritableGuard)
  @HttpCode(204)
  async registerToken(
    @CurrentAccountId() accountId: string,
    @Body(new ZodValidationPipe(PushTokenRequestSchema)) request: PushTokenRequest,
  ): Promise<void> {
    await this.notifications.registerToken(accountId, request);
  }
}
