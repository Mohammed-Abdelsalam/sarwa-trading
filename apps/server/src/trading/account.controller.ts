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
import { type Account as AccountRow } from '@prisma/client';
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

import { WritableGuard } from '../common/device';
import { IdParam } from '../common/params';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AlertsService } from './alerts.service';
import { toAccount } from './mappers';
import { NotificationsService } from './notifications.service';
import { DeviceAccount } from './orders.controller';
import { PortfolioService } from './portfolio.service';
import { StatusService } from './status.service';

@Controller()
export class AccountController {
  constructor(
    private readonly portfolio: PortfolioService,
    private readonly status: StatusService,
  ) {}

  @Get(TRADING_ROUTES.account)
  account(@DeviceAccount() account: AccountRow): Account {
    return toAccount(account);
  }

  @Get(TRADING_ROUTES.portfolio)
  books(@DeviceAccount() account: AccountRow): Promise<PortfolioResponse> {
    return this.portfolio.books(account);
  }

  @Get(TRADING_ROUTES.equity)
  equity(
    @DeviceAccount() account: AccountRow,
    @Query(new ZodValidationPipe(EquityQuerySchema)) { period }: z.output<typeof EquityQuerySchema>,
  ): Promise<EquityResponse> {
    return this.portfolio.equity(account, period);
  }

  @Get(TRADING_ROUTES.tradingStatus)
  tradingStatus(): TradingStatus {
    return this.status.status();
  }
}

@Controller()
export class AlertsController {
  constructor(private readonly alerts: AlertsService) {}

  @Get(TRADING_ROUTES.alerts)
  list(@DeviceAccount() account: AccountRow): Promise<AlertsResponse> {
    return this.alerts.list(account);
  }

  @Post(TRADING_ROUTES.alerts)
  @UseGuards(WritableGuard)
  async create(
    @DeviceAccount() account: AccountRow,
    @Body(new ZodValidationPipe(CreateAlertRequestSchema)) request: CreateAlertRequest,
  ): Promise<AlertResponse> {
    return { alert: await this.alerts.create(account, request) };
  }

  @Patch(TRADING_ROUTES.alert)
  @UseGuards(WritableGuard)
  async update(
    @DeviceAccount() account: AccountRow,
    @IdParam() id: string,
    @Body(new ZodValidationPipe(UpdateAlertRequestSchema)) patch: UpdateAlertRequest,
  ): Promise<AlertResponse> {
    return { alert: await this.alerts.update(account, id, patch) };
  }

  @Delete(TRADING_ROUTES.alert)
  @UseGuards(WritableGuard)
  @HttpCode(204)
  remove(@DeviceAccount() account: AccountRow, @IdParam() id: string): Promise<void> {
    return this.alerts.remove(account, id);
  }
}

@Controller()
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get(TRADING_ROUTES.notifications)
  list(
    @DeviceAccount() account: AccountRow,
    @Query(new ZodValidationPipe(NotificationsQuerySchema)) query: NotificationsQuery,
  ): Promise<NotificationsResponse> {
    return this.notifications.list(account.id, query);
  }

  @Post(TRADING_ROUTES.notificationsReadAll)
  @UseGuards(WritableGuard)
  @HttpCode(204)
  readAll(@DeviceAccount() account: AccountRow): Promise<void> {
    return this.notifications.markAllRead(account.id);
  }

  @Post(TRADING_ROUTES.notificationRead)
  @UseGuards(WritableGuard)
  @HttpCode(204)
  read(@DeviceAccount() account: AccountRow, @IdParam() id: string): Promise<void> {
    return this.notifications.markRead(account.id, id);
  }

  @Post(TRADING_ROUTES.pushTokens)
  @UseGuards(WritableGuard)
  @HttpCode(204)
  async registerToken(
    @DeviceAccount() account: AccountRow,
    @Body(new ZodValidationPipe(PushTokenRequestSchema)) request: PushTokenRequest,
  ): Promise<void> {
    await this.notifications.registerToken(account.deviceId, request);
  }
}
