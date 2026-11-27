import { z } from 'zod';

import {
  ADMIN_REASON_LENGTH,
  type AuthFieldError,
  checkPassword,
  NAME_MAX_LENGTH,
  PASSWORD_POLICY,
  type PasswordIssue,
  SUSPENSION_CATEGORIES,
} from '@sarwa/domain';

import { ErrorCode, ProblemSchema } from './api';
import { CLIENT_PLATFORMS, DELETE_CONFIRM, RESET_CONFIRM } from './constants';
import { AccountSchema } from './trading';

const Timestamp = z.number().int().nonnegative();
const Count = z.number().int().nonnegative();
const Id = z.string().min(1).max(64);
const Token = z.string().min(16).max(256);

// Field errors carry a code, not a sentence: each client renders it from @sarwa/i18n.
const issue = (code: AuthFieldError) => ({ error: code });

const PASSWORD_FIELD_ERRORS = {
  TOO_SHORT: 'PASSWORD_TOO_SHORT',
  TOO_LONG: 'PASSWORD_TOO_LONG',
  COMMON: 'PASSWORD_COMMON',
} as const satisfies Record<PasswordIssue, AuthFieldError>;

export const ClientPlatformSchema = z.enum(CLIENT_PLATFORMS);
export const AccountHandleSchema = AccountSchema.shape.handle;
export const SuspensionCategorySchema = z.enum(SUSPENSION_CATEGORIES);

export const EmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, issue('EMAIL_INVALID'))
  .pipe(z.email(issue('EMAIL_INVALID')));

export const NameSchema = z
  .string()
  .trim()
  .min(1, issue('NAME_REQUIRED'))
  .max(NAME_MAX_LENGTH, issue('NAME_TOO_LONG'));

// A password being chosen: the shared policy, so forms and server refuse exactly the same ones.
export const NewPasswordSchema = z.string().superRefine((password, ctx) => {
  for (const problem of checkPassword(password))
    ctx.addIssue({ code: 'custom', message: PASSWORD_FIELD_ERRORS[problem] });
});

// A password being checked: never reveal the policy on sign-in.
export const CurrentPasswordSchema = z
  .string()
  .min(1, issue('PASSWORD_REQUIRED'))
  .max(PASSWORD_POLICY.maxLength, issue('PASSWORD_TOO_LONG'));

const KeepSignedIn = z.boolean().default(false);
// Mobile names the phone ("iPhone 15"); the web label comes from the user agent on the server.
const DeviceModel = z.string().trim().min(1).max(64).optional();

export const SignUpRequestSchema = z.object({
  name: NameSchema,
  email: EmailSchema,
  password: NewPasswordSchema,
  keepSignedIn: KeepSignedIn,
  terms: z.literal(true, issue('TERMS_REQUIRED')),
  deviceModel: DeviceModel,
});

export const SignInRequestSchema = z.object({
  email: EmailSchema,
  password: CurrentPasswordSchema,
  keepSignedIn: KeepSignedIn,
  // From a 409 GUEST_DATA_PRESENT: sending it back confirms discarding this device's guest data.
  guestTicket: z.string().min(1).max(256).optional(),
  deviceModel: DeviceModel,
});

// Web sends an empty body (the refresh cookie); mobile sends the token from SecureStore.
export const RefreshRequestSchema = z.object({
  refreshToken: z.string().min(1).max(512).optional(),
});

export const ForgotPasswordRequestSchema = z.object({ email: EmailSchema });

export const ResetPasswordInfoSchema = z.object({ email: z.email() });

export const ResetPasswordRequestSchema = z.object({
  token: Token,
  password: NewPasswordSchema,
  keepSignedIn: KeepSignedIn,
  deviceModel: DeviceModel,
});

export const VerifyEmailRequestSchema = z.object({ token: Token });
export const VerifyEmailResponseSchema = z.object({ email: z.email() });

// Signed in, the session's email is used; from an expired link page, the email it showed.
export const ResendVerificationRequestSchema = z.object({ email: EmailSchema.optional() });

export const ChangePasswordRequestSchema = z.object({
  current: CurrentPasswordSchema,
  next: NewPasswordSchema,
});

export const UpdateProfileRequestSchema = z.object({ name: NameSchema });

export const DeleteAccountRequestSchema = z.object({
  password: CurrentPasswordSchema,
  confirm: z.literal(DELETE_CONFIRM, issue('CONFIRMATION_MISMATCH')),
});

export const SelfResetRequestSchema = z.object({
  confirm: z.literal(RESET_CONFIRM, issue('CONFIRMATION_MISMATCH')),
});

export const CustomerUserSchema = z.object({
  id: Id,
  email: z.email(),
  name: z.string().min(1).max(NAME_MAX_LENGTH),
  emailVerified: z.boolean(),
  createdAt: Timestamp,
  passwordChangedAt: Timestamp.nullable(),
  account: z.object({ id: Id, handle: AccountHandleSchema }),
});

export const GuestDataCountsSchema = z.object({
  positions: Count,
  openOrders: Count,
  watchlist: Count,
});

export const AuthSessionResponseSchema = z.object({
  user: CustomerUserSchema,
  // Mobile only: the web gets both tokens as httpOnly cookies.
  accessToken: z.string().min(1).optional(),
  refreshToken: z.string().min(1).optional(),
  accessExpiresAt: Timestamp,
  // Sign-up moved this device's guest portfolio into the new account.
  claimed: GuestDataCountsSchema.optional(),
  // Signing in during the deletion grace period canceled the deletion.
  deletionCanceled: z.boolean().optional(),
  // A password reset ended every other session.
  sessionsRevoked: Count.optional(),
});

export const MeResponseSchema = z.object({ user: CustomerUserSchema });

// The counts the delete-account dialog spells out.
export const MeSummarySchema = z.object({
  equityCents: z.number().int(),
  openOrders: Count,
  watchlist: Count,
  alerts: Count,
});

export const ChangePasswordResponseSchema = z.object({ sessionsRevoked: Count });
export const DeleteAccountResponseSchema = z.object({ purgeAt: Timestamp });
export const SelfResetResponseSchema = z.object({ account: AccountSchema });

export const SessionInfoSchema = z.object({
  id: Id,
  // "Chrome on macOS" or "Mini Trading for iOS · iPhone 15", built by the server.
  label: z.string().min(1).max(120),
  platform: ClientPlatformSchema,
  browser: z.string().max(64).optional(),
  os: z.string().max(64).optional(),
  model: z.string().max(64).optional(),
  ipMasked: z.string().max(64),
  lastActiveAt: Timestamp,
  createdAt: Timestamp,
  current: z.boolean(),
});

export const SessionsResponseSchema = z.object({ items: z.array(SessionInfoSchema) });

export const RevokeOthersResponseSchema = z.object({
  revoked: Count,
  labels: z.array(z.string()),
});

export const SuspensionSchema = z.object({
  reasonCategory: SuspensionCategorySchema,
  reason: z.string().min(1).max(ADMIN_REASON_LENGTH.max),
  at: Timestamp,
  accountHandle: AccountHandleSchema,
});

export const SESSION_REVOKED_REASONS = [
  'signed_out',
  'password_changed',
  'suspended',
  'revoked',
  'deleted',
] as const;
export const SessionRevokedReasonSchema = z.enum(SESSION_REVOKED_REASONS);

// Problems that carry more than the standard fields. Parse with these once the code matches.
export const GuestDataPresentProblemSchema = ProblemSchema.extend({
  code: z.literal(ErrorCode.GuestDataPresent),
  ticket: z.string().min(1).max(256),
  ...GuestDataCountsSchema.shape,
});

export const AccountSuspendedProblemSchema = ProblemSchema.extend({
  code: z.literal(ErrorCode.AccountSuspended),
  suspension: SuspensionSchema,
});

export const TokenExpiredProblemSchema = ProblemSchema.extend({
  code: z.literal(ErrorCode.TokenExpired),
  // Lets the expired-link page offer "send a fresh one to {email}".
  email: z.email().optional(),
});

export const RateLimitedProblemSchema = ProblemSchema.extend({
  code: z.literal(ErrorCode.RateLimited),
  // Mirrors the Retry-After header.
  retryAfterSeconds: z.number().int().positive(),
});

export type ClientPlatform = z.infer<typeof ClientPlatformSchema>;
export type SuspensionCategory = z.infer<typeof SuspensionCategorySchema>;
export type SignUpRequest = z.input<typeof SignUpRequestSchema>;
export type SignInRequest = z.input<typeof SignInRequestSchema>;
export type RefreshRequest = z.infer<typeof RefreshRequestSchema>;
export type ForgotPasswordRequest = z.infer<typeof ForgotPasswordRequestSchema>;
export type ResetPasswordInfo = z.infer<typeof ResetPasswordInfoSchema>;
export type ResetPasswordRequest = z.input<typeof ResetPasswordRequestSchema>;
export type VerifyEmailRequest = z.infer<typeof VerifyEmailRequestSchema>;
export type VerifyEmailResponse = z.infer<typeof VerifyEmailResponseSchema>;
export type ResendVerificationRequest = z.infer<typeof ResendVerificationRequestSchema>;
export type ChangePasswordRequest = z.infer<typeof ChangePasswordRequestSchema>;
export type UpdateProfileRequest = z.infer<typeof UpdateProfileRequestSchema>;
export type DeleteAccountRequest = z.infer<typeof DeleteAccountRequestSchema>;
export type SelfResetRequest = z.infer<typeof SelfResetRequestSchema>;
export type CustomerUser = z.infer<typeof CustomerUserSchema>;
export type GuestDataCounts = z.infer<typeof GuestDataCountsSchema>;
export type AuthSessionResponse = z.infer<typeof AuthSessionResponseSchema>;
export type MeResponse = z.infer<typeof MeResponseSchema>;
export type MeSummary = z.infer<typeof MeSummarySchema>;
export type ChangePasswordResponse = z.infer<typeof ChangePasswordResponseSchema>;
export type DeleteAccountResponse = z.infer<typeof DeleteAccountResponseSchema>;
export type SelfResetResponse = z.infer<typeof SelfResetResponseSchema>;
export type SessionInfo = z.infer<typeof SessionInfoSchema>;
export type SessionsResponse = z.infer<typeof SessionsResponseSchema>;
export type RevokeOthersResponse = z.infer<typeof RevokeOthersResponseSchema>;
export type Suspension = z.infer<typeof SuspensionSchema>;
export type SessionRevokedReason = z.infer<typeof SessionRevokedReasonSchema>;
export type GuestDataPresentProblem = z.infer<typeof GuestDataPresentProblemSchema>;
export type AccountSuspendedProblem = z.infer<typeof AccountSuspendedProblemSchema>;
export type TokenExpiredProblem = z.infer<typeof TokenExpiredProblemSchema>;
export type RateLimitedProblem = z.infer<typeof RateLimitedProblemSchema>;
