import { createHash } from 'node:crypto';

import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { type Response } from 'express';

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

import { CurrentAccountId } from '../auth/customer.guard';
import { WritableGuard } from '../common/device';
import { IdParam } from '../common/params';
import { ValidationException, ZodValidationPipe } from '../common/zod-validation.pipe';
import { OrdersService } from './orders.service';

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
    @CurrentAccountId() accountId: string,
    @Headers(IDEMPOTENCY_KEY_HEADER) key: string | undefined,
    @Body(new ZodValidationPipe(PlaceOrderRequestSchema)) request: PlaceOrderRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<PlaceOrderResponse> {
    const receivedAt = performance.now();
    const hash = createHash('sha256').update(JSON.stringify(request)).digest('hex');
    const { order, replayed } = await this.orders.place(
      accountId,
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
    @CurrentAccountId() accountId: string,
    @Query(new ZodValidationPipe(OrdersQuerySchema)) query: OrdersQuery,
  ): Promise<OrdersResponse> {
    return this.orders.list(accountId, query);
  }

  @Get(TRADING_ROUTES.order)
  async get(
    @CurrentAccountId() accountId: string,
    @IdParam() id: string,
  ): Promise<PlaceOrderResponse> {
    return { order: await this.orders.get(accountId, id) };
  }

  @Post(TRADING_ROUTES.cancelOrder)
  @UseGuards(WritableGuard)
  @HttpCode(200)
  cancel(
    @CurrentAccountId() accountId: string,
    @IdParam() id: string,
  ): Promise<CancelOrderResponse> {
    return this.orders.cancel(accountId, id);
  }

  @Patch(TRADING_ROUTES.order)
  @UseGuards(WritableGuard)
  async modify(
    @CurrentAccountId() accountId: string,
    @IdParam() id: string,
    @Body(new ZodValidationPipe(ModifyOrderRequestSchema)) patch: ModifyOrderRequest,
  ): Promise<PlaceOrderResponse> {
    return { order: await this.orders.modify(accountId, id, patch) };
  }
}
