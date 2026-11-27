import { ConflictException, Injectable } from '@nestjs/common';
import { type z } from 'zod';

import {
  type CustomerActionResponse,
  type CustomerRevealResponse,
  type CustomerRow,
  type CustomersQuerySchema,
  type SuspendCustomerRequest,
} from '@sarwa/contracts';

import { type Actor, AuditService } from '../admin/audit.service';
import { customerEntity } from '../auth/customer-user';
import { RecoveryService } from '../auth/recovery.service';
import { liveSession, SessionsService } from '../auth/sessions.service';
import { Clock } from '../common/clock';
import { type PiiView } from '../common/pii';
import { PrismaService } from '../prisma.service';
import { AccountLifecycleService } from '../trading/account-lifecycle.service';
import { AdminAccountsService } from '../trading/admin-accounts.service';
import { AdminCustomersService, type Customer } from './admin-customers.service';

// What an admin may do to a customer. Every action has a reason and lands in the audit log;
// none of them can see a password, trade for the customer or edit a balance.
@Injectable()
export class CustomerActionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly customers: AdminCustomersService,
    private readonly sessions: SessionsService,
    private readonly lifecycle: AccountLifecycleService,
    private readonly accounts: AdminAccountsService,
    private readonly recovery: RecoveryService,
    private readonly audit: AuditService,
  ) {}

  // Signs the customer out everywhere within seconds and cancels their working orders; the
  // portfolio itself is kept.
  async suspend(
    handle: string,
    { reasonCategory, reason }: SuspendCustomerRequest,
    actor: Actor,
    view: PiiView,
  ): Promise<CustomerActionResponse> {
    const customer = await this.customers.find(handle);
    if (customer.status !== 'active')
      throw new ConflictException('Only an active customer can be suspended');
    const at = new Date(this.clock.now());
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: customer.id },
        data: {
          status: 'suspended',
          suspensionCategory: reasonCategory,
          suspensionReason: reason,
          suspendedAt: at,
          suspendedBy: actor.email,
        },
      });
      await this.log(
        customer,
        'customer.suspend',
        actor,
        {
          reasonCategory,
          reason,
          before: { status: customer.status },
          after: { status: 'suspended' },
        },
        tx,
      );
    });
    const revoked = await this.sessions.revoke(customer.id, { all: true }, 'suspended', {
      reasonCategory,
      reason,
      at: at.getTime(),
      accountHandle: handle,
    });
    await this.log(
      customer,
      'customer.signout_all',
      { email: 'system' },
      {
        sessionsRevoked: revoked.length,
        trigger: 'suspend',
      },
    );
    const ordersCanceled = await this.lifecycle.cancelWorking(
      customer.account.id,
      'account_suspended',
    );
    return {
      customer: await this.reloaded(handle, view),
      sessionsRevoked: revoked.length,
      ordersCanceled,
    };
  }

  async reactivate(
    handle: string,
    reason: string,
    actor: Actor,
    view: PiiView,
  ): Promise<CustomerActionResponse> {
    const customer = await this.customers.find(handle);
    if (customer.status !== 'suspended')
      throw new ConflictException('This customer is not suspended');
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: customer.id },
        data: {
          status: 'active',
          suspensionCategory: null,
          suspensionReason: null,
          suspendedAt: null,
          suspendedBy: null,
        },
      });
      await this.log(
        customer,
        'customer.reactivate',
        actor,
        {
          reason,
          before: { status: 'suspended' },
          after: { status: 'active' },
        },
        tx,
      );
    });
    return { customer: await this.reloaded(handle, view) };
  }

  async signOutAll(
    handle: string,
    reason: string,
    actor: Actor,
    view: PiiView,
  ): Promise<CustomerActionResponse> {
    const customer = await this.customers.find(handle);
    const revoked = await this.sessions.revoke(customer.id, { all: true }, 'revoked');
    await this.log(customer, 'customer.signout_all', actor, {
      reason,
      sessionsRevoked: revoked.length,
      trigger: 'admin',
    });
    return { customer: await this.customers.row(customer, view), sessionsRevoked: revoked.length };
  }

  // The customer picks the new password themselves from the emailed link.
  async sendPasswordReset(
    handle: string,
    reason: string,
    actor: Actor,
    view: PiiView,
  ): Promise<CustomerActionResponse> {
    const customer = await this.customers.find(handle);
    if (customer.status !== 'active')
      throw new ConflictException('Only an active customer can reset a password');
    await this.recovery.sendReset(customer.id, customer.email);
    await this.log(customer, 'customer.reset_password_sent', actor, {
      reason,
      requestedBy: 'admin',
    });
    return { customer: await this.customers.row(customer, view) };
  }

  async resetPaperAccount(
    handle: string,
    { reason, confirm }: { reason: string; confirm: string },
    actor: Actor,
    view: PiiView,
  ): Promise<CustomerActionResponse> {
    const customer = await this.customers.find(handle);
    await this.accounts.reset(customer.account.id, confirm, actor, { reason });
    return { customer: await this.customers.row(customer, view) };
  }

  async revealIps(handle: string, actor: Actor): Promise<CustomerRevealResponse> {
    const customer = await this.customers.find(handle);
    const rows = await this.prisma.session.findMany({
      where: { ...liveSession(this.clock.now()), userId: customer.id },
      orderBy: { lastUsedAt: 'desc' },
      select: { familyId: true, ip: true },
    });
    await this.log(customer, 'customer.pii_viewed', actor, {
      field: 'session.ip',
      sessions: rows.length,
    });
    return { items: rows.map((row) => ({ sessionId: row.familyId, ip: row.ip })) };
  }

  // Customer data leaving the system: ADMIN only, and the export itself is audited.
  async exportCsv(query: z.output<typeof CustomersQuerySchema>, actor: Actor): Promise<string> {
    const lines = [CSV_COLUMNS.join(',')];
    for await (const rows of this.customers.all(query)) {
      for (const row of rows)
        lines.push(CSV_COLUMNS.map((column) => csvCell(row[column])).join(','));
    }
    const { q, status, verified, hasOpenOrders } = query;
    await this.audit.log({
      actorEmail: actor.email,
      action: 'customer.export',
      entity: 'Customers',
      payload: { rows: lines.length - 1, filters: { q, status, verified, hasOpenOrders } },
      ip: actor.ip,
    });
    return `${lines.join('\r\n')}\r\n`;
  }

  private async reloaded(handle: string, view: PiiView) {
    return this.customers.row(await this.customers.find(handle), view);
  }

  private log(
    customer: Customer,
    action: Parameters<AuditService['log']>[0]['action'],
    actor: Actor,
    payload: Record<string, unknown>,
    tx?: Parameters<AuditService['log']>[1],
  ): Promise<void> {
    return this.audit.log(
      {
        actorEmail: actor.email,
        action,
        entity: customerEntity(customer.account.handle),
        payload,
        ip: actor.ip,
      },
      tx,
    );
  }
}

const CSV_COLUMNS = [
  'handle',
  'name',
  'email',
  'status',
  'emailVerified',
  'signupPlatform',
  'equityCents',
  'allTimeCents',
  'openOrders',
  'lastActiveAt',
  'createdAt',
] as const satisfies readonly (keyof CustomerRow)[];

// Quoted when needed; a leading = + - @ is defused so a spreadsheet never runs a customer's name.
function csvCell(value: string | number | boolean | null): string {
  if (value === null) return '';
  const text = String(value);
  const safe = typeof value === 'string' && /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}
