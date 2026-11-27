import { Injectable, NotFoundException } from '@nestjs/common';
import { type Prisma } from '@prisma/client';
import { type z } from 'zod';

import {
  type ClientPlatform,
  type CustomerActivity,
  type CustomerActivityResponse,
  type CustomerDetail,
  type CustomerPageQuerySchema,
  type CustomerRow,
  type CustomersQuerySchema,
  type CustomersResponse,
  type CustomerSession,
  type CustomerStatus,
  type OrdersQuerySchema,
  type OrdersResponse,
  type SuspensionCategory,
} from '@sarwa/contracts';

import { customerEntity, type UserWithAccount } from '../auth/customer-user';
import { liveSession, toSessionInfo } from '../auth/sessions.service';
import { Clock } from '../common/clock';
import { maskDeep, maskEmail, type PiiView } from '../common/pii';
import { PrismaService } from '../prisma.service';
import { WORKING_STATUSES } from '../trading/mappers';
import { OrdersService } from '../trading/orders.service';
import { PortfolioService } from '../trading/portfolio.service';

type CustomersQuery = z.output<typeof CustomersQuerySchema>;
type PageQuery = z.output<typeof CustomerPageQuerySchema>;
type OrdersQuery = z.output<typeof OrdersQuerySchema>;
export type Customer = UserWithAccount & { account: { id: string; handle: string } };

const BATCH_SIZE = 500;
const working = { status: { in: [...WORKING_STATUSES] } };
const withAccount = { account: { select: { id: true, handle: true } } } as const;

// What admins read about customers. Emails are masked for VIEWER here, before they leave.
@Injectable()
export class AdminCustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly portfolio: PortfolioService,
    private readonly orders: OrdersService,
  ) {}

  async find(handle: string): Promise<Customer> {
    const user = await this.prisma.user.findFirst({
      where: { account: { is: { handle } } },
      include: withAccount,
    });
    if (!user?.account) throw new NotFoundException('Customer not found');
    return user as Customer;
  }

  // Newest first, paged by cursor; the total counts every page of the current filters.
  async list(query: CustomersQuery, view: PiiView): Promise<CustomersResponse> {
    const where = this.where(query);
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: withAccount,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: query.limit + 1,
        ...(query.cursor && { cursor: { id: query.cursor }, skip: 1 }),
      }),
      this.prisma.user.count({ where }),
    ]);
    const page = users.slice(0, query.limit) as Customer[];
    return {
      items: await this.rows(page, view),
      nextCursor: users.length > query.limit ? (page.at(-1)?.id ?? null) : null,
      total,
    };
  }

  // Every match, a batch at a time, for the CSV export.
  async *all(query: CustomersQuery): AsyncGenerator<CustomerRow[]> {
    let cursor: string | undefined;
    do {
      const { items, nextCursor } = await this.list(
        { ...query, limit: BATCH_SIZE, cursor },
        'full',
      );
      yield items;
      cursor = nextCursor ?? undefined;
    } while (cursor);
  }

  async row(customer: Customer, view: PiiView): Promise<CustomerRow> {
    const [row] = await this.rows([customer], view);
    if (!row) throw new NotFoundException('Customer not found');
    return row;
  }

  async detail(handle: string, view: PiiView): Promise<CustomerDetail> {
    const customer = await this.find(handle);
    const [row, { books, summary }, sessions] = await Promise.all([
      this.row(customer, view),
      this.portfolio.snapshot(customer.account.id),
      this.prisma.session.findMany({
        where: { ...liveSession(this.clock.now()), userId: customer.id },
        orderBy: { lastUsedAt: 'desc' },
        select: { label: true },
      }),
    ]);
    const valued = new Map(summary.positions.map((p) => [p.symbol, p.marketValueCents]));
    return {
      customer: row,
      lastActiveDevice: sessions[0]?.label ?? null,
      activeSessions: sessions.length,
      suspension:
        customer.status === 'suspended'
          ? {
              reasonCategory: (customer.suspensionCategory ?? 'other') as SuspensionCategory,
              reason: customer.suspensionReason ?? '',
              at: customer.suspendedAt?.getTime() ?? 0,
              by:
                customer.suspendedBy &&
                (view === 'full' ? customer.suspendedBy : maskEmail(customer.suspendedBy)),
            }
          : null,
      portfolio: {
        equityCents: summary.equityCents,
        dayCents: summary.todayCents,
        cashCents: summary.cashCents,
        reservedCents: summary.reservedCents,
        allTimeCents: summary.allTimeCents,
        allTimeBps: summary.allTimeBps,
        positions: books.positions.map((p) => ({
          symbol: p.symbol,
          qtyMicros: p.qtyMicros,
          costBasisCents: p.costBasisCents,
          marketValueCents: valued.get(p.symbol) ?? p.costBasisCents,
        })),
      },
    };
  }

  // Every order, including those from before a paper-account reset.
  async ordersOf(handle: string, query: OrdersQuery): Promise<OrdersResponse> {
    const customer = await this.find(handle);
    return this.orders.list(customer.account.id, query, 'all');
  }

  // IPs stay masked here for every role; revealing them is its own audited action.
  async sessionsOf(handle: string): Promise<CustomerSession[]> {
    const customer = await this.find(handle);
    const rows = await this.prisma.session.findMany({
      where: { ...liveSession(this.clock.now()), userId: customer.id },
      orderBy: { lastUsedAt: 'desc' },
    });
    return rows.map(toSessionInfo);
  }

  // The audit trail merged with the customer's own trading events, newest first. The cursor is
  // a timestamp, so events sharing the boundary millisecond may be skipped between pages.
  async activity(
    handle: string,
    { cursor, limit }: PageQuery,
    view: PiiView,
  ): Promise<CustomerActivityResponse> {
    const customer = await this.find(handle);
    const { id: accountId, handle: accountHandle } = customer.account;
    const before = cursor && /^\d+$/.test(cursor) ? new Date(Number(cursor)) : undefined;
    const time = before ? { lt: before } : undefined;
    const take = limit + 1;
    const [audits, placed, closed, alerts] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: {
          entity: { in: [customerEntity(accountHandle), `Account · ${accountHandle}`] },
          createdAt: time,
        },
        orderBy: { createdAt: 'desc' },
        take,
      }),
      this.prisma.order.findMany({
        where: { accountId, createdAt: time },
        orderBy: { createdAt: 'desc' },
        take,
      }),
      this.prisma.order.findMany({
        where: {
          accountId,
          status: { in: ['filled', 'canceled'] },
          closedAt: { not: null, ...time },
        },
        orderBy: { closedAt: 'desc' },
        take,
      }),
      this.prisma.alert.findMany({
        where: { accountId, createdAt: time },
        orderBy: { createdAt: 'desc' },
        take,
      }),
    ]);
    const customerActor = { kind: 'customer' as const, email: null };
    const order = (o: (typeof placed)[number]) => ({
      orderId: o.id,
      symbol: o.symbol,
      side: o.side,
      type: o.type,
    });
    const verifiedAt = customer.emailVerifiedAt;
    const items: CustomerActivity[] = [
      ...audits.map((row): CustomerActivity => {
        const payload = JSON.parse(row.payload) as Record<string, unknown>;
        return {
          id: row.id,
          at: row.createdAt.getTime(),
          actor: actorOf(row.actorEmail, customer.email, view),
          action: row.action as CustomerActivity['action'],
          detail: view === 'full' ? payload : (maskDeep(payload) as Record<string, unknown>),
        };
      }),
      ...placed.map((o): CustomerActivity => ({
        id: `placed:${o.id}`,
        at: o.createdAt.getTime(),
        actor: customerActor,
        action: 'order.placed',
        detail: order(o),
      })),
      ...closed.map((o): CustomerActivity => ({
        id: `${o.status}:${o.id}`,
        at: o.closedAt?.getTime() ?? 0,
        actor: customerActor,
        action: o.status === 'filled' ? 'order.filled' : 'order.canceled',
        detail: { ...order(o), cancelReason: o.cancelReason },
      })),
      ...alerts.map((a): CustomerActivity => ({
        id: `alert:${a.id}`,
        at: a.createdAt.getTime(),
        actor: customerActor,
        action: 'alert.created',
        detail: { alertId: a.id, symbol: a.symbol, condition: a.condition },
      })),
      ...(verifiedAt && (!before || verifiedAt < before)
        ? [
            {
              id: `verified:${customer.id}`,
              at: verifiedAt.getTime(),
              actor: customerActor,
              action: 'email.verified' as const,
              detail: {},
            },
          ]
        : []),
    ].sort((a, b) => b.at - a.at);
    const page = items.slice(0, limit);
    return {
      items: page,
      nextCursor: items.length > limit ? String(page.at(-1)?.at ?? '') : null,
    };
  }

  // Batched: one valuation pass and one count query for the whole page.
  private async rows(customers: readonly Customer[], view: PiiView): Promise<CustomerRow[]> {
    const ids = customers.map((c) => c.account.id);
    const [summaries, open] = await Promise.all([
      this.portfolio.summaries(ids.map((id) => ({ id }))),
      this.prisma.order.groupBy({
        by: ['accountId'],
        where: { accountId: { in: ids }, ...working },
        orderBy: { accountId: 'asc' },
        _count: { _all: true },
      }),
    ]);
    const openOf = new Map(open.map((g) => [g.accountId, g._count._all]));
    return customers.map((c) => {
      const summary = summaries.get(c.account.id);
      return {
        id: c.id,
        handle: c.account.handle,
        name: c.name,
        email: view === 'full' ? c.email : maskEmail(c.email),
        status: c.status as CustomerStatus,
        emailVerified: c.emailVerifiedAt !== null,
        signupPlatform: c.signupPlatform as ClientPlatform,
        equityCents: summary?.equityCents ?? 0,
        allTimeCents: summary?.allTimeCents ?? 0,
        allTimeBps: summary?.allTimeBps ?? 0,
        openOrders: openOf.get(c.account.id) ?? 0,
        lastActiveAt: c.lastActiveAt?.getTime() ?? null,
        createdAt: c.createdAt.getTime(),
        deletionRequestedAt: c.deletionRequestedAt?.getTime() ?? null,
      };
    });
  }

  private where({ q, status, verified, hasOpenOrders }: CustomersQuery): Prisma.UserWhereInput {
    const search = q?.trim();
    return {
      AND: [
        { account: { isNot: null } },
        status === 'all' ? {} : { status },
        verified === undefined ? {} : { emailVerifiedAt: verified ? { not: null } : null },
        hasOpenOrders === undefined
          ? {}
          : {
              account: {
                is: { orders: hasOpenOrders ? { some: working } : { none: working } },
              },
            },
        search
          ? {
              OR: [
                { email: { contains: search.toLowerCase() } },
                { name: { contains: search } },
                { account: { is: { handle: { contains: search.toUpperCase() } } } },
              ],
            }
          : {},
      ],
    };
  }
}

function actorOf(
  actorEmail: string,
  customerEmail: string,
  view: PiiView,
): CustomerActivity['actor'] {
  if (actorEmail === 'system') return { kind: 'system', email: null };
  if (actorEmail === customerEmail) return { kind: 'customer', email: null };
  return { kind: 'admin', email: view === 'full' ? actorEmail : maskEmail(actorEmail) };
}
