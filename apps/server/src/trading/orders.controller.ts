import { createHash } from 'node:crypto';

import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Injectable,
  Param,
  Patch,
  type PipeTransform,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { type Account as AccountRow } from '@prisma/client';
import { type Response } from 'express';
import { z } from 'zod';

import {
  type CancelOrderResponse,
  IDEMPOTENCY_KEY_HEADER,
  IdempotencyKeySchema,
  type ModifyOrderRequest,
  ModifyOrderRequestSchema,
  type OrdersQuery,
  OrdersQuerySchema,
  type OrdersResponse,
  type PlaceOrderRequest,
  PlaceOrderRequestSchema,
  type PlaceOrderResponse,
  TRADING_ROUTES,
} from '@sarwa/contracts';

import { DeviceId, WritableGuard } from '../common/device';
import { ValidationException, ZodValidationPipe } from '../common/zod-validation.pipe';
import { AccountsService } from './accounts.service';
import { OrdersService } from './orders.service';

// Resolves the X-Device-Id header to its account, opening one on first use.
@Injectable()
export class AccountPipe implements PipeTransform<string, Promise<AccountRow>> {
  constructor(private readonly accounts: AccountsService) {}

  transform(deviceId: string): Promise<AccountRow> {
    return this.accounts.forDevice(deviceId);
  }
}

export const DeviceAccount = () => DeviceId(AccountPipe);

const IdParam = () => Param('id', new ZodValidationPipe(z.string().min(1).max(64)));

function idempotencyKey(value: string | undefined): string {
  const parsed = IdempotencyKeySchema.safeParse(value);
  if (!parsed.success) {
    throw new ValidationException({
      'Idempotency-Key': [parsed.error.issues[0]?.message ?? 'Idempotency-Key header is required'],
    });
  }
  return parsed.data;
}

@Controller()
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  // A retried request with the same key returns the original order instead of placing another.
  @Post(TRADING_ROUTES.orders)
  @UseGuards(WritableGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async place(
    @DeviceAccount() account: AccountRow,
    @Headers(IDEMPOTENCY_KEY_HEADER) key: string | undefined,
    @Body(new ZodValidationPipe(PlaceOrderRequestSchema)) request: PlaceOrderRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<PlaceOrderResponse> {
    const receivedAt = performance.now();
    const hash = createHash('sha256').update(JSON.stringify(request)).digest('hex');
    const { order, replayed } = await this.orders.place(
      account,
      idempotencyKey(key),
      hash,
      request,
      receivedAt,
    );
    response.status(replayed ? 200 : 201);
    return { order };
  }

  @Get(TRADING_ROUTES.orders)
  list(
    @DeviceAccount() account: AccountRow,
    @Query(new ZodValidationPipe(OrdersQuerySchema)) query: OrdersQuery,
  ): Promise<OrdersResponse> {
    return this.orders.list(account, query);
  }

  @Get(TRADING_ROUTES.order)
  async get(
    @DeviceAccount() account: AccountRow,
    @IdParam() id: string,
  ): Promise<PlaceOrderResponse> {
    return { order: await this.orders.get(account, id) };
  }

  @Post(TRADING_ROUTES.cancelOrder)
  @UseGuards(WritableGuard)
  @HttpCode(200)
  cancel(
    @DeviceAccount() account: AccountRow,
    @IdParam() id: string,
  ): Promise<CancelOrderResponse> {
    return this.orders.cancel(account, id);
  }

  @Patch(TRADING_ROUTES.order)
  @UseGuards(WritableGuard)
  async modify(
    @DeviceAccount() account: AccountRow,
    @IdParam() id: string,
    @Body(new ZodValidationPipe(ModifyOrderRequestSchema)) patch: ModifyOrderRequest,
  ): Promise<PlaceOrderResponse> {
    return { order: await this.orders.modify(account, id, patch) };
  }
}
