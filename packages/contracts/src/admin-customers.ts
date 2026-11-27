import { z } from 'zod';

import { ADMIN_REASON_LENGTH } from '@sarwa/domain';

import { AUDIT_ACTIONS, RoleSchema } from './admin';
import {
  AccountHandleSchema,
  ClientPlatformSchema,
  EmailSchema,
  NameSchema,
  NewPasswordSchema,
  SessionInfoSchema,
  SuspensionCategorySchema,
  SuspensionSchema,
} from './auth';
import { SymbolSchema } from './market';

const Timestamp = z.number().int().nonnegative();
const Count = z.number().int().nonnegative();
const Cents = z.number().int();
const Bps = z.number().int();
const Id = z.string().min(1).max(64);
// Query strings carry booleans as text; z.coerce.boolean would read "false" as true.
const QueryFlag = z.union([z.boolean(), z.stringbool()]).optional();

export const CustomerStatusSchema = z.enum(['active', 'suspended', 'deleted']);
export const CustomerStatusFilterSchema = z.enum(['all', 'active', 'suspended']);

// `email` is masked (s•••@example.com) for VIEWER by the server, so it is not validated as one.
export const CustomerRowSchema = z.object({
  id: Id,
  handle: AccountHandleSchema,
  name: z.string(),
  email: z.string(),
  status: CustomerStatusSchema,
  emailVerified: z.boolean(),
  signupPlatform: ClientPlatformSchema,
  equityCents: Cents,
  allTimeCents: Cents,
  allTimeBps: Bps,
  openOrders: Count,
  lastActiveAt: Timestamp.nullable(),
  createdAt: Timestamp,
  deletionRequestedAt: Timestamp.nullable(),
});

// `q` matches email, name or the ACC- handle.
export const CustomersQuerySchema = z.object({
  q: z.string().trim().max(64).optional(),
  status: CustomerStatusFilterSchema.default('all'),
  verified: QueryFlag,
  hasOpenOrders: QueryFlag,
  cursor: Id.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const CustomersResponseSchema = z.object({
  items: z.array(CustomerRowSchema),
  nextCursor: Id.nullable(),
  // Matches for the current filters, across every page.
  total: Count,
});

// Rates are basis points: 4_100 = 41%. Deltas compare with the same figure 7 days ago.
export const CustomerKpisSchema = z.object({
  registered: Count,
  registeredWeekBps: Bps,
  signedUpToday: Count,
  signedUpTodayMobileBps: Count,
  active24h: Count,
  suspended: Count,
  suspendedToday: Count,
  verifiedBps: Count,
  verifiedDeltaBps: Bps,
  guests24h: Count,
  conversionBps: Count,
});

export const AdminSuspensionSchema = SuspensionSchema.omit({ accountHandle: true }).extend({
  by: z.string().nullable(),
});

export const CustomerPositionSchema = z.object({
  symbol: SymbolSchema,
  qtyMicros: z.number().int().positive(),
  costBasisCents: Cents,
  marketValueCents: Cents,
});

export const CustomerDetailSchema = z.object({
  customer: CustomerRowSchema,
  lastActiveDevice: z.string().nullable(),
  activeSessions: Count,
  suspension: AdminSuspensionSchema.nullable(),
  portfolio: z.object({
    equityCents: Cents,
    dayCents: Cents,
    cashCents: Cents,
    reservedCents: Cents,
    allTimeCents: Cents,
    allTimeBps: Bps,
    positions: z.array(CustomerPositionSchema),
  }),
});

export const CustomerSessionSchema = SessionInfoSchema.omit({ current: true });
export const CustomerSessionsResponseSchema = z.object({ items: z.array(CustomerSessionSchema) });

export const CustomerRevealResponseSchema = z.object({
  items: z.array(z.object({ sessionId: Id, ip: z.string().nullable() })),
});

// The activity tab merges the audit log with the customer's own trading events.
export const CUSTOMER_EVENT_ACTIONS = [
  'order.placed',
  'order.filled',
  'order.canceled',
  'alert.created',
  'email.verified',
] as const;
export const CustomerActivityActionSchema = z.enum([...AUDIT_ACTIONS, ...CUSTOMER_EVENT_ACTIONS]);

export const CustomerActivitySchema = z.object({
  id: Id,
  at: Timestamp,
  actor: z.object({
    kind: z.enum(['customer', 'admin', 'system']),
    // The admin's email (masked for VIEWER); null for the customer and the system.
    email: z.string().nullable(),
  }),
  action: CustomerActivityActionSchema,
  detail: z.record(z.string(), z.unknown()),
});

export const CustomerPageQuerySchema = z.object({
  cursor: Id.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const CustomerActivityResponseSchema = z.object({
  items: z.array(CustomerActivitySchema),
  nextCursor: Id.nullable(),
});

export const AdminReasonSchema = z
  .string()
  .trim()
  .min(ADMIN_REASON_LENGTH.min, { error: 'REASON_LENGTH' })
  .max(ADMIN_REASON_LENGTH.max, { error: 'REASON_LENGTH' });

export const SuspendCustomerRequestSchema = z.object({
  reasonCategory: SuspensionCategorySchema,
  // Shown to the customer on the suspended screen.
  reason: AdminReasonSchema,
});

// Reactivate, sign out all devices and send a password reset.
export const CustomerReasonRequestSchema = z.object({ reason: AdminReasonSchema });

// `confirm` must equal resetConfirmation(handle): "RESET ACC-7F2K9Q".
export const ResetCustomerAccountRequestSchema = z.object({
  reason: AdminReasonSchema,
  confirm: z.string().trim().min(1),
});

export const CustomerActionResponseSchema = z.object({
  customer: CustomerRowSchema,
  sessionsRevoked: Count.optional(),
  ordersCanceled: Count.optional(),
});

export const InviteStatusSchema = z.enum(['pending', 'expired']);

export const CreateInviteRequestSchema = z.object({ email: EmailSchema, role: RoleSchema });

export const InviteRowSchema = z.object({
  id: Id,
  email: z.string(),
  role: RoleSchema,
  invitedBy: z.string(),
  status: InviteStatusSchema,
  createdAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
});

export const InviteResponseSchema = z.object({ invite: InviteRowSchema });
export const InvitesResponseSchema = z.object({ items: z.array(InviteRowSchema) });

// What the public accept page shows before the invitee picks a password.
export const InviteInfoSchema = z.object({
  email: z.email(),
  role: RoleSchema,
  expiresAt: z.iso.datetime(),
});

// Answered with the admin SessionResponse: accepting signs the new admin in.
export const AcceptInviteRequestSchema = z.object({
  token: z.string().min(16).max(256),
  name: NameSchema,
  password: NewPasswordSchema,
});

export type CustomerStatus = z.infer<typeof CustomerStatusSchema>;
export type CustomerStatusFilter = z.infer<typeof CustomerStatusFilterSchema>;
export type CustomerRow = z.infer<typeof CustomerRowSchema>;
export type CustomersQuery = z.input<typeof CustomersQuerySchema>;
export type CustomersResponse = z.infer<typeof CustomersResponseSchema>;
export type CustomerKpis = z.infer<typeof CustomerKpisSchema>;
export type AdminSuspension = z.infer<typeof AdminSuspensionSchema>;
export type CustomerPosition = z.infer<typeof CustomerPositionSchema>;
export type CustomerDetail = z.infer<typeof CustomerDetailSchema>;
export type CustomerSession = z.infer<typeof CustomerSessionSchema>;
export type CustomerSessionsResponse = z.infer<typeof CustomerSessionsResponseSchema>;
export type CustomerRevealResponse = z.infer<typeof CustomerRevealResponseSchema>;
export type CustomerActivityAction = z.infer<typeof CustomerActivityActionSchema>;
export type CustomerActivity = z.infer<typeof CustomerActivitySchema>;
export type CustomerPageQuery = z.input<typeof CustomerPageQuerySchema>;
export type CustomerActivityResponse = z.infer<typeof CustomerActivityResponseSchema>;
export type SuspendCustomerRequest = z.infer<typeof SuspendCustomerRequestSchema>;
export type CustomerReasonRequest = z.infer<typeof CustomerReasonRequestSchema>;
export type ResetCustomerAccountRequest = z.infer<typeof ResetCustomerAccountRequestSchema>;
export type CustomerActionResponse = z.infer<typeof CustomerActionResponseSchema>;
export type InviteStatus = z.infer<typeof InviteStatusSchema>;
export type CreateInviteRequest = z.infer<typeof CreateInviteRequestSchema>;
export type InviteRow = z.infer<typeof InviteRowSchema>;
export type InviteResponse = z.infer<typeof InviteResponseSchema>;
export type InvitesResponse = z.infer<typeof InvitesResponseSchema>;
export type InviteInfo = z.infer<typeof InviteInfoSchema>;
export type AcceptInviteRequest = z.infer<typeof AcceptInviteRequestSchema>;
