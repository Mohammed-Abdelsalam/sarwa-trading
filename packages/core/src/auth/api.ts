import {
  AUTH_ROUTES,
  type AuthSessionResponse,
  AuthSessionResponseSchema,
  type ChangePasswordRequest,
  type ChangePasswordResponse,
  ChangePasswordResponseSchema,
  type CustomerUser,
  type DeleteAccountRequest,
  type DeleteAccountResponse,
  DeleteAccountResponseSchema,
  type ForgotPasswordRequest,
  type MeSummary,
  MeResponseSchema,
  MeSummarySchema,
  type RefreshRequest,
  type ResendVerificationRequest,
  type ResetPasswordInfo,
  ResetPasswordInfoSchema,
  type ResetPasswordRequest,
  type RevokeOthersResponse,
  RevokeOthersResponseSchema,
  routePath,
  type SelfResetRequest,
  type SelfResetResponse,
  SelfResetResponseSchema,
  type SessionsResponse,
  SessionsResponseSchema,
  type SignInRequest,
  type SignUpRequest,
  type UpdateProfileRequest,
  type VerifyEmailRequest,
  type VerifyEmailResponse,
  VerifyEmailResponseSchema,
} from '@sarwa/contracts';

import { type CallOptions, type Request } from '../api';

export interface AuthApi {
  signUp(body: SignUpRequest): Promise<AuthSessionResponse>;
  signIn(body: SignInRequest): Promise<AuthSessionResponse>;
  signOut(): Promise<void>;
  refreshSession(body: RefreshRequest): Promise<AuthSessionResponse>;
  forgotPassword(body: ForgotPasswordRequest): Promise<void>;
  getResetInfo(token: string, options?: CallOptions): Promise<ResetPasswordInfo>;
  resetPassword(body: ResetPasswordRequest): Promise<AuthSessionResponse>;
  verifyEmail(body: VerifyEmailRequest): Promise<VerifyEmailResponse>;
  resendVerification(body?: ResendVerificationRequest): Promise<void>;
  getMe(options?: CallOptions): Promise<CustomerUser>;
  updateProfile(body: UpdateProfileRequest): Promise<CustomerUser>;
  changePassword(body: ChangePasswordRequest): Promise<ChangePasswordResponse>;
  getMeSummary(options?: CallOptions): Promise<MeSummary>;
  listSessions(options?: CallOptions): Promise<SessionsResponse>;
  revokeSession(id: string): Promise<void>;
  signOutOthers(): Promise<RevokeOthersResponse>;
  deleteAccount(body: DeleteAccountRequest): Promise<DeleteAccountResponse>;
  selfReset(body: SelfResetRequest): Promise<SelfResetResponse>;
}

const A = AUTH_ROUTES;
const post = (body?: unknown) => ({ method: 'POST', body, anonymous: true });

export function createAuthApi(request: Request): AuthApi {
  return {
    signUp: (body) => request(routePath(A.signUp), AuthSessionResponseSchema, post(body)),
    signIn: (body) => request(routePath(A.signIn), AuthSessionResponseSchema, post(body)),
    signOut: () => request(routePath(A.signOut), null, { method: 'POST' }),
    refreshSession: (body) => request(routePath(A.refresh), AuthSessionResponseSchema, post(body)),
    forgotPassword: (body) => request(routePath(A.forgot), null, post(body)),
    getResetInfo: (token, options) =>
      request(routePath(A.resetInfo, { token }), ResetPasswordInfoSchema, {
        ...options,
        anonymous: true,
      }),
    resetPassword: (body) => request(routePath(A.reset), AuthSessionResponseSchema, post(body)),
    verifyEmail: (body) => request(routePath(A.verify), VerifyEmailResponseSchema, post(body)),
    // From the expired-link page the email names the account; signed in, the session does.
    resendVerification: (body = {}) =>
      request(routePath(A.resendVerify), null, {
        method: 'POST',
        body,
        anonymous: body.email !== undefined,
      }),
    getMe: async (options) => (await request(routePath(A.me), MeResponseSchema, options)).user,
    updateProfile: async (body) =>
      (await request(routePath(A.profile), MeResponseSchema, { method: 'PATCH', body })).user,
    changePassword: (body) =>
      request(routePath(A.password), ChangePasswordResponseSchema, { method: 'POST', body }),
    getMeSummary: (options) => request(routePath(A.summary), MeSummarySchema, options),
    listSessions: (options) => request(routePath(A.sessions), SessionsResponseSchema, options),
    revokeSession: (id) => request(routePath(A.revokeSession, { id }), null, { method: 'DELETE' }),
    signOutOthers: () =>
      request(routePath(A.signOutOthers), RevokeOthersResponseSchema, { method: 'POST' }),
    deleteAccount: (body) =>
      request(routePath(A.deleteAccount), DeleteAccountResponseSchema, { method: 'POST', body }),
    selfReset: (body) =>
      request(routePath(A.selfReset), SelfResetResponseSchema, { method: 'POST', body }),
  };
}
