import { ADMIN_REASON_LENGTH } from '@sarwa/domain';

import {
  AcceptInviteRequestSchema,
  AdminReasonSchema,
  AdminSuspensionSchema,
  AUDIT_ACTIONS,
  CancelReasonSchema,
  CreateInviteRequestSchema,
  CUSTOMER_EVENT_ACTIONS,
  CustomerActionResponseSchema,
  CustomerActivityActionSchema,
  CustomerActivityResponseSchema,
  CustomerActivitySchema,
  CustomerDetailSchema,
  CustomerKpisSchema,
  CustomerPageQuerySchema,
  CustomerPositionSchema,
  CustomerReasonRequestSchema,
  CustomerRevealResponseSchema,
  CustomerRowSchema,
  CustomerSessionSchema,
  CustomerSessionsResponseSchema,
  CustomersQuerySchema,
  CustomersResponseSchema,
  CustomerStatusFilterSchema,
  CustomerStatusSchema,
  InviteInfoSchema,
  InviteResponseSchema,
  InviteRowSchema,
  InvitesResponseSchema,
  InviteStatusSchema,
  resetConfirmation,
  ResetCustomerAccountRequestSchema,
  SuspendCustomerRequestSchema,
} from '../src';

const messages = (result: { error?: { issues: { message: string }[] } }) =>
  result.error?.issues.map((i) => i.message);

const row = {
  id: 'usr_1',
  handle: 'ACC-7F2C9A',
  name: 'Sara Ali',
  email: 's•••@example.com',
  status: 'active',
  emailVerified: true,
  signupPlatform: 'ios',
  equityCents: 10_250_000,
  allTimeCents: 250_000,
  allTimeBps: 250,
  openOrders: 1,
  lastActiveAt: 2,
  createdAt: 1,
  deletionRequestedAt: null,
};

describe('CustomerRowSchema', () => {
  it('accepts a masked email for VIEWER', () => {
    expect(CustomerRowSchema.safeParse(row).success).toBe(true);
  });

  it('only knows active, suspended and deleted customers', () => {
    expect(CustomerRowSchema.safeParse({ ...row, status: 'disabled' }).success).toBe(false);
  });
});

describe('CustomersQuerySchema', () => {
  it('fills defaults', () => {
    expect(CustomersQuerySchema.parse({})).toEqual({ status: 'all', limit: 50 });
  });

  it('reads query-string flags as booleans, "false" included', () => {
    expect(
      CustomersQuerySchema.parse({ verified: 'false', hasOpenOrders: 'true', limit: '20' }),
    ).toEqual({ status: 'all', verified: false, hasOpenOrders: true, limit: 20 });
    expect(CustomersQuerySchema.parse({ verified: true }).verified).toBe(true);
  });

  it('caps the page size', () => {
    expect(CustomersQuerySchema.safeParse({ limit: '500' }).success).toBe(false);
  });
});

describe('CustomerKpisSchema', () => {
  it('keeps rates in basis points', () => {
    const kpis = {
      registered: 8_412,
      registeredWeekBps: 200,
      signedUpToday: 164,
      signedUpTodayMobileBps: 4_100,
      active24h: 3_207,
      suspended: 37,
      suspendedToday: 2,
      verifiedBps: 8_640,
      verifiedDeltaBps: 110,
      guests24h: 2_930,
      conversionBps: 610,
    };
    expect(CustomerKpisSchema.parse(kpis)).toEqual(kpis);
    expect(CustomerKpisSchema.safeParse({ ...kpis, verifiedBps: 86.4 }).success).toBe(false);
  });
});

describe('CustomerDetailSchema', () => {
  it('carries the portfolio summary and an optional suspension', () => {
    const detail = {
      customer: { ...row, status: 'suspended' },
      lastActiveDevice: 'Chrome on macOS',
      activeSessions: 0,
      suspension: { reasonCategory: 'fraud', reason: 'Card testing', at: 3, by: 'maya@x.dev' },
      portfolio: {
        equityCents: 1,
        dayCents: 0,
        cashCents: 1,
        reservedCents: 0,
        allTimeCents: 0,
        allTimeBps: 0,
        positions: [
          { symbol: 'AAPL', qtyMicros: 1_000_000, costBasisCents: 100, marketValueCents: 120 },
        ],
      },
    };
    expect(CustomerDetailSchema.safeParse(detail).success).toBe(true);
    expect(CustomerDetailSchema.safeParse({ ...detail, suspension: null }).success).toBe(true);
  });
});

describe('admin customer actions', () => {
  it('needs a category and a 10–280 character reason to suspend', () => {
    expect(
      SuspendCustomerRequestSchema.safeParse({
        reasonCategory: 'abuse',
        reason: 'Automated trading scripts',
      }).success,
    ).toBe(true);
    const short = SuspendCustomerRequestSchema.safeParse({
      reasonCategory: 'abuse',
      reason: 'bot',
    });
    expect(short.error?.issues.map((i) => i.message)).toEqual(['REASON_LENGTH']);
    expect(
      SuspendCustomerRequestSchema.safeParse({ reasonCategory: 'abuse', reason: 'x'.repeat(281) })
        .success,
    ).toBe(false);
    expect(
      SuspendCustomerRequestSchema.safeParse({ reasonCategory: 'spam', reason: 'x'.repeat(20) })
        .success,
    ).toBe(false);
  });

  it('confirms an account reset by typing RESET and the handle', () => {
    const request = ResetCustomerAccountRequestSchema.parse({
      reason: 'Customer asked for a fresh start',
      confirm: ' RESET ACC-7F2C9A ',
    });
    expect(request.confirm).toBe(resetConfirmation('ACC-7F2C9A'));
  });

  it('shows audit actions and the customer’s own trading events in activity', () => {
    expect(CustomerActivityActionSchema.options).toEqual(
      expect.arrayContaining([...AUDIT_ACTIONS, 'order.filled', 'email.verified']),
    );
  });
});

describe('admin invites', () => {
  it('invites by email and role only', () => {
    expect(
      CreateInviteRequestSchema.parse({ email: ' Sam@MiniTrading.dev ', role: 'VIEWER' }),
    ).toEqual({ email: 'sam@minitrading.dev', role: 'VIEWER' });
    expect(CreateInviteRequestSchema.safeParse({ email: 'sam', role: 'ADMIN' }).success).toBe(
      false,
    );
  });

  it('accepts with a name and a password that passes the policy', () => {
    const token = 'b'.repeat(43);
    expect(
      AcceptInviteRequestSchema.safeParse({ token, name: 'Sam', password: 'violet-harbor-42' })
        .success,
    ).toBe(true);
    expect(
      AcceptInviteRequestSchema.safeParse({ token, name: 'Sam', password: 'password1' }).success,
    ).toBe(false);
  });
});

describe('CancelReasonSchema', () => {
  it('knows orders canceled by a suspension', () => {
    expect(CancelReasonSchema.safeParse('account_suspended').success).toBe(true);
  });
});

describe('customer status', () => {
  it('filters the list by live statuses only', () => {
    expect(CustomerStatusSchema.options).toEqual(['active', 'suspended', 'deleted']);
    expect(CustomerStatusFilterSchema.safeParse('all').success).toBe(true);
    expect(CustomerStatusFilterSchema.safeParse('deleted').success).toBe(false);
  });
});

describe('CustomersResponseSchema', () => {
  it('pages with a cursor and counts every match', () => {
    expect(
      CustomersResponseSchema.safeParse({ items: [row], nextCursor: 'usr_2', total: 120 }).success,
    ).toBe(true);
    expect(CustomersResponseSchema.safeParse({ items: [row], nextCursor: null }).success).toBe(
      false,
    );
  });
});

describe('AdminSuspensionSchema', () => {
  it('names the admin instead of repeating the handle', () => {
    const suspension = { reasonCategory: 'fraud', reason: 'Card testing', at: 3, by: null };
    expect(AdminSuspensionSchema.parse({ ...suspension, accountHandle: 'ACC-7F2C9A' })).toEqual(
      suspension,
    );
    expect(AdminSuspensionSchema.safeParse({ ...suspension, by: undefined }).success).toBe(false);
  });
});

describe('CustomerPositionSchema', () => {
  it('only lists positions the customer still holds', () => {
    const position = { symbol: 'AAPL', qtyMicros: 1, costBasisCents: 100, marketValueCents: 90 };
    expect(CustomerPositionSchema.safeParse(position).success).toBe(true);
    expect(CustomerPositionSchema.safeParse({ ...position, qtyMicros: 0 }).success).toBe(false);
  });
});

describe('customer sessions', () => {
  const session = {
    id: 's1',
    label: 'Chrome on macOS',
    platform: 'web',
    ipMasked: '41.32.•.•',
    lastActiveAt: 2,
    createdAt: 1,
  };

  it('has no current session from the admin side', () => {
    expect(CustomerSessionSchema.parse({ ...session, current: true })).toEqual(session);
    expect(CustomerSessionsResponseSchema.safeParse({ items: [session] }).success).toBe(true);
    expect(CustomerSessionsResponseSchema.safeParse({ items: [{ id: 's1' }] }).success).toBe(false);
  });

  it('reveals each session ip, or null when none was kept', () => {
    expect(
      CustomerRevealResponseSchema.safeParse({
        items: [
          { sessionId: 's1', ip: '41.32.10.7' },
          { sessionId: 's2', ip: null },
        ],
      }).success,
    ).toBe(true);
    expect(CustomerRevealResponseSchema.safeParse({ items: [{ sessionId: '' }] }).success).toBe(
      false,
    );
  });
});

describe('customer activity', () => {
  const event = {
    id: 'evt_1',
    at: 1,
    actor: { kind: 'customer', email: null },
    action: 'order.filled',
    detail: { symbol: 'AAPL' },
  };

  it('adds the customer’s own events to the audit actions', () => {
    expect(CUSTOMER_EVENT_ACTIONS).toEqual([
      'order.placed',
      'order.filled',
      'order.canceled',
      'alert.created',
      'email.verified',
    ]);
    const audited = new Set<string>(AUDIT_ACTIONS);
    expect(CUSTOMER_EVENT_ACTIONS.filter((action) => audited.has(action))).toEqual([]);
  });

  it('accepts a customer, admin or system event', () => {
    expect(CustomerActivitySchema.safeParse(event).success).toBe(true);
    expect(
      CustomerActivitySchema.safeParse({
        ...event,
        actor: { kind: 'admin', email: 'm•••@sarwa.dev' },
        action: 'customer.suspend',
      }).success,
    ).toBe(true);
    expect(
      CustomerActivitySchema.safeParse({ ...event, actor: { kind: 'bot', email: null } }).success,
    ).toBe(false);
  });

  it('pages activity with a cursor', () => {
    expect(CustomerPageQuerySchema.parse({})).toEqual({ limit: 50 });
    expect(CustomerPageQuerySchema.parse({ cursor: 'evt_9', limit: '10' })).toEqual({
      cursor: 'evt_9',
      limit: 10,
    });
    expect(CustomerPageQuerySchema.safeParse({ limit: '0' }).success).toBe(false);
    expect(
      CustomerActivityResponseSchema.safeParse({ items: [event], nextCursor: null }).success,
    ).toBe(true);
    expect(CustomerActivityResponseSchema.safeParse({ items: [event] }).success).toBe(false);
  });
});

describe('AdminReasonSchema', () => {
  it('trims, then needs 10–280 characters', () => {
    expect(AdminReasonSchema.parse('  Chargeback dispute  ')).toBe('Chargeback dispute');
    expect(
      AdminReasonSchema.safeParse(` ${'x'.repeat(ADMIN_REASON_LENGTH.min - 1)} `).success,
    ).toBe(false);
    expect(AdminReasonSchema.safeParse('x'.repeat(ADMIN_REASON_LENGTH.max)).success).toBe(true);
  });

  it('is all a reactivate or sign-out-all request needs', () => {
    expect(CustomerReasonRequestSchema.parse({ reason: 'Identity confirmed' })).toEqual({
      reason: 'Identity confirmed',
    });
    expect(messages(CustomerReasonRequestSchema.safeParse({ reason: 'ok' }))).toEqual([
      'REASON_LENGTH',
    ]);
  });
});

describe('CustomerActionResponseSchema', () => {
  it('returns the updated row with what the action ended', () => {
    expect(
      CustomerActionResponseSchema.safeParse({
        customer: { ...row, status: 'suspended' },
        sessionsRevoked: 2,
        ordersCanceled: 1,
      }).success,
    ).toBe(true);
    expect(CustomerActionResponseSchema.safeParse({ customer: row }).success).toBe(true);
    expect(
      CustomerActionResponseSchema.safeParse({ customer: row, ordersCanceled: -1 }).success,
    ).toBe(false);
  });
});

describe('invite lists', () => {
  const invite = {
    id: 'inv_1',
    email: 'sam@minitrading.dev',
    role: 'VIEWER',
    invitedBy: 'maya@minitrading.dev',
    status: 'pending',
    createdAt: '2026-11-25T10:00:00.000Z',
    expiresAt: '2026-11-27T10:00:00.000Z',
  };

  it('shows pending and expired invites only', () => {
    expect(InviteStatusSchema.options).toEqual(['pending', 'expired']);
    expect(InviteRowSchema.safeParse(invite).success).toBe(true);
    expect(InviteRowSchema.safeParse({ ...invite, status: 'accepted' }).success).toBe(false);
  });

  it('wraps one invite or a list of them', () => {
    expect(InviteResponseSchema.safeParse({ invite }).success).toBe(true);
    expect(InviteResponseSchema.safeParse(invite).success).toBe(false);
    expect(InvitesResponseSchema.safeParse({ items: [invite] }).success).toBe(true);
    expect(
      InvitesResponseSchema.safeParse({ items: [{ ...invite, expiresAt: 'in 2 days' }] }).success,
    ).toBe(false);
  });

  it('shows the invitee their email and role before they accept', () => {
    const info = { email: invite.email, role: 'ADMIN', expiresAt: invite.expiresAt };
    expect(InviteInfoSchema.parse(info)).toEqual(info);
    expect(InviteInfoSchema.safeParse({ ...info, role: 'OWNER' }).success).toBe(false);
  });
});
