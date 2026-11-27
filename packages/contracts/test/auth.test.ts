import {
  AccountSuspendedProblemSchema,
  API_PREFIX,
  AUTH_LIMITS,
  AUTH_ROUTES,
  AUTH_TTL_MS,
  AuthSessionResponseSchema,
  ChangePasswordRequestSchema,
  ChangePasswordResponseSchema,
  CLIENT_PLATFORM_HEADER,
  CSRF_COOKIE,
  CSRF_HEADER,
  CurrentPasswordSchema,
  CUSTOMER_ACCESS_COOKIE,
  CUSTOMER_REFRESH_COOKIE,
  CUSTOMER_REFRESH_COOKIE_PATH,
  CustomerUserSchema,
  DeleteAccountRequestSchema,
  DeleteAccountResponseSchema,
  EmailSchema,
  ErrorCode,
  ForgotPasswordRequestSchema,
  GuestDataCountsSchema,
  GuestDataPresentProblemSchema,
  MeResponseSchema,
  MeSummarySchema,
  NameSchema,
  NewPasswordSchema,
  ProblemSchema,
  RateLimitedProblemSchema,
  RefreshRequestSchema,
  ResendVerificationRequestSchema,
  ResetPasswordInfoSchema,
  ResetPasswordRequestSchema,
  RevokeOthersResponseSchema,
  routePath,
  SESSION_REVOKED_REASONS,
  SelfResetRequestSchema,
  SelfResetResponseSchema,
  SessionInfoSchema,
  SessionRevokedEventSchema,
  SessionRevokedReasonSchema,
  SessionsResponseSchema,
  SignInRequestSchema,
  SignUpRequestSchema,
  SocketAuthSchema,
  TokenExpiredProblemSchema,
  UpdateProfileRequestSchema,
  VerifyEmailRequestSchema,
  VerifyEmailResponseSchema,
} from '../src';

const messages = (result: { error?: { issues: { message: string }[] } }) =>
  result.error?.issues.map((i) => i.message);

const user = {
  id: 'usr_1',
  email: 'sara@example.com',
  name: 'Sara Ali',
  emailVerified: false,
  createdAt: 1,
  passwordChangedAt: null,
  account: { id: 'acc_1', handle: 'ACC-7F2C9A' },
};
const suspension = {
  reasonCategory: 'abuse',
  reason: 'Automated trading scripts',
  at: 1,
  accountHandle: 'ACC-7F2C9A',
};
const token = 'a'.repeat(43);

describe('EmailSchema', () => {
  it('trims and lower-cases, so one address is one account', () => {
    expect(EmailSchema.parse('  Sara@Example.COM ')).toBe('sara@example.com');
  });

  it('answers with a code the forms translate', () => {
    expect(messages(EmailSchema.safeParse('sara@'))).toEqual(['EMAIL_INVALID']);
  });
});

describe('NameSchema', () => {
  it('requires a name and caps its length', () => {
    expect(messages(NameSchema.safeParse('  '))).toEqual(['NAME_REQUIRED']);
    expect(messages(NameSchema.safeParse('x'.repeat(81)))).toEqual(['NAME_TOO_LONG']);
    expect(NameSchema.parse(' Sara ')).toBe('Sara');
  });
});

describe('NewPasswordSchema', () => {
  it('applies the shared password policy', () => {
    expect(messages(NewPasswordSchema.safeParse('short'))).toEqual(['PASSWORD_TOO_SHORT']);
    expect(messages(NewPasswordSchema.safeParse('password123'))).toEqual(['PASSWORD_COMMON']);
    expect(messages(NewPasswordSchema.safeParse('x'.repeat(129)))).toEqual(['PASSWORD_TOO_LONG']);
    expect(NewPasswordSchema.safeParse('violet-harbor-42').success).toBe(true);
  });
});

describe('SignUpRequestSchema', () => {
  const valid = {
    name: 'Sara Ali',
    email: 'sara@example.com',
    password: 'violet-harbor-42',
    terms: true,
  };

  it('defaults keepSignedIn to off', () => {
    expect(SignUpRequestSchema.parse(valid).keepSignedIn).toBe(false);
  });

  it('reports every field the form shows at once', () => {
    const result = SignUpRequestSchema.safeParse({
      name: '',
      email: 'sara',
      password: 'qwertyuiop',
      terms: false,
    });
    expect(messages(result)).toEqual([
      'NAME_REQUIRED',
      'EMAIL_INVALID',
      'PASSWORD_COMMON',
      'TERMS_REQUIRED',
    ]);
  });
});

describe('SignInRequestSchema', () => {
  it('never applies the new-password policy to a sign-in', () => {
    expect(
      SignInRequestSchema.safeParse({ email: 'sara@example.com', password: 'short' }).success,
    ).toBe(true);
    expect(
      messages(SignInRequestSchema.safeParse({ email: 'sara@example.com', password: '' })),
    ).toEqual(['PASSWORD_REQUIRED']);
  });

  it('carries the guest ticket that confirms discarding guest data', () => {
    expect(
      SignInRequestSchema.parse({ email: 'a@b.co', password: 'x', guestTicket: 't1' }).guestTicket,
    ).toBe('t1');
  });
});

describe('token requests', () => {
  it('accepts a link token and rejects a truncated one', () => {
    expect(VerifyEmailRequestSchema.safeParse({ token }).success).toBe(true);
    expect(VerifyEmailRequestSchema.safeParse({ token: 'abc' }).success).toBe(false);
    expect(
      ResetPasswordRequestSchema.safeParse({ token, password: 'violet-harbor-42' }).success,
    ).toBe(true);
  });

  it('lets web refresh with the cookie and mobile with the body', () => {
    expect(RefreshRequestSchema.parse({})).toEqual({});
    expect(RefreshRequestSchema.parse({ refreshToken: 'r1' })).toEqual({ refreshToken: 'r1' });
  });

  it('resends verification with or without an email', () => {
    expect(ResendVerificationRequestSchema.safeParse({}).success).toBe(true);
    expect(ResendVerificationRequestSchema.safeParse({ email: 'nope' }).success).toBe(false);
  });
});

describe('account requests', () => {
  it('checks the new password but not the current one', () => {
    expect(
      messages(ChangePasswordRequestSchema.safeParse({ current: 'x', next: 'short' })),
    ).toEqual(['PASSWORD_TOO_SHORT']);
  });

  it('needs DELETE and RESET typed exactly', () => {
    expect(DeleteAccountRequestSchema.safeParse({ password: 'x', confirm: 'DELETE' }).success).toBe(
      true,
    );
    expect(
      messages(DeleteAccountRequestSchema.safeParse({ password: 'x', confirm: 'delete' })),
    ).toEqual(['CONFIRMATION_MISMATCH']);
    expect(SelfResetRequestSchema.safeParse({ confirm: 'RESET' }).success).toBe(true);
    expect(SelfResetRequestSchema.safeParse({ confirm: 'RESET ' }).success).toBe(false);
  });

  it('edits the name only', () => {
    expect(UpdateProfileRequestSchema.parse({ name: 'Sara', handle: '@sara' })).toEqual({
      name: 'Sara',
    });
  });
});

describe('AuthSessionResponseSchema', () => {
  it('accepts the web shape without tokens and the mobile shape with them', () => {
    expect(AuthSessionResponseSchema.safeParse({ user, accessExpiresAt: 2 }).success).toBe(true);
    expect(
      AuthSessionResponseSchema.parse({
        user,
        accessToken: 'jwt',
        refreshToken: 'opaque',
        accessExpiresAt: 2,
        claimed: { positions: 2, openOrders: 1, watchlist: 7 },
      }).claimed,
    ).toEqual({ positions: 2, openOrders: 1, watchlist: 7 });
  });

  it('rejects a user without an ACC handle', () => {
    expect(
      AuthSessionResponseSchema.safeParse({
        user: { ...user, account: { id: 'acc_1', handle: '@sara' } },
        accessExpiresAt: 2,
      }).success,
    ).toBe(false);
  });
});

describe('SessionInfoSchema', () => {
  it('describes a device without any location', () => {
    const session = SessionInfoSchema.parse({
      id: 's1',
      label: 'Chrome on macOS',
      platform: 'web',
      browser: 'Chrome',
      os: 'macOS',
      ipMasked: '41.32.•.•',
      lastActiveAt: 2,
      createdAt: 1,
      current: true,
      city: 'Cairo',
    });
    expect(session).not.toHaveProperty('city');
    expect(SessionInfoSchema.shape.platform.options).toEqual(['web', 'ios', 'android']);
  });
});

describe('problems with extras', () => {
  const base = { type: 'about:blank', title: 'x', status: 409 };

  it('keeps the guest ticket and counts', () => {
    const problem = GuestDataPresentProblemSchema.parse({
      ...base,
      code: 'GUEST_DATA_PRESENT',
      ticket: 't1',
      positions: 3,
      openOrders: 1,
      watchlist: 7,
    });
    expect(problem).toMatchObject({ ticket: 't1', positions: 3 });
  });

  it('keeps the suspension for the suspended screen', () => {
    expect(
      AccountSuspendedProblemSchema.parse({
        ...base,
        status: 403,
        code: 'ACCOUNT_SUSPENDED',
        suspension,
      }).suspension.reasonCategory,
    ).toBe('abuse');
  });

  it('matches only its own code', () => {
    expect(
      TokenExpiredProblemSchema.safeParse({ ...base, status: 410, code: 'TOKEN_EXPIRED' }).success,
    ).toBe(true);
    expect(
      RateLimitedProblemSchema.safeParse({ ...base, code: 'CONFLICT', retryAfterSeconds: 4 })
        .success,
    ).toBe(false);
  });

  it('parses every new auth code in a plain problem', () => {
    for (const code of [
      ErrorCode.InvalidCredentials,
      ErrorCode.InvalidCurrentPassword,
      ErrorCode.EmailInUse,
      ErrorCode.WeakPassword,
      ErrorCode.TokenExpired,
      ErrorCode.AccountSuspended,
      ErrorCode.SessionRevoked,
      ErrorCode.GuestDataPresent,
      ErrorCode.CsrfFailed,
    ])
      expect(ProblemSchema.parse({ ...base, code }).code).toBe(code);
  });
});

describe('session sockets', () => {
  it('sends the revoke reason and, when suspended, the suspension', () => {
    expect(SessionRevokedEventSchema.safeParse({ v: 1, reason: 'password_changed' }).success).toBe(
      true,
    );
    expect(
      SessionRevokedEventSchema.parse({ v: 1, reason: 'suspended', suspension }).suspension,
    ).toEqual(suspension);
    expect(SessionRevokedEventSchema.safeParse({ v: 1, reason: 'expired' }).success).toBe(false);
  });

  it('accepts an access token next to the device id', () => {
    const deviceId = '0b6b5f8e-6f1c-4c7e-9a52-3f0f1d6c2b11';
    expect(SocketAuthSchema.parse({ deviceId, token: 'jwt' })).toEqual({ deviceId, token: 'jwt' });
    expect(SocketAuthSchema.safeParse({ deviceId }).success).toBe(true);
  });
});

describe('AUTH_TTL_MS', () => {
  it('matches the session model', () => {
    const minute = 60_000;
    const day = 24 * 60 * minute;
    expect(AUTH_TTL_MS).toEqual({
      access: 15 * minute,
      refreshKeepSignedIn: 30 * day,
      refresh: day,
      passwordReset: 30 * minute,
      emailVerify: day,
      adminInvite: 2 * day,
      guestTicket: 2 * minute,
      authIntent: 10 * minute,
      deletionGrace: 7 * day,
    });
  });
});

describe('CurrentPasswordSchema', () => {
  it('accepts any stored password but still bounds its length', () => {
    expect(CurrentPasswordSchema.safeParse('short').success).toBe(true);
    expect(messages(CurrentPasswordSchema.safeParse(''))).toEqual(['PASSWORD_REQUIRED']);
    expect(messages(CurrentPasswordSchema.safeParse('x'.repeat(129)))).toEqual([
      'PASSWORD_TOO_LONG',
    ]);
  });
});

describe('ForgotPasswordRequestSchema', () => {
  it('normalizes the email like sign-in does', () => {
    expect(ForgotPasswordRequestSchema.parse({ email: ' Sara@Example.com ' })).toEqual({
      email: 'sara@example.com',
    });
    expect(messages(ForgotPasswordRequestSchema.safeParse({ email: 'sara' }))).toEqual([
      'EMAIL_INVALID',
    ]);
  });
});

describe('link pages', () => {
  it('show the email the reset or verify link belongs to', () => {
    expect(ResetPasswordInfoSchema.safeParse({ email: 'sara@example.com' }).success).toBe(true);
    expect(ResetPasswordInfoSchema.safeParse({ email: 'sara' }).success).toBe(false);
    expect(VerifyEmailResponseSchema.safeParse({ email: 'sara@example.com' }).success).toBe(true);
    expect(VerifyEmailResponseSchema.safeParse({}).success).toBe(false);
  });
});

describe('CustomerUserSchema', () => {
  it('accepts the signed-in user and rejects a blank name', () => {
    expect(CustomerUserSchema.parse(user)).toEqual(user);
    expect(CustomerUserSchema.safeParse({ ...user, name: '' }).success).toBe(false);
    expect(CustomerUserSchema.safeParse({ ...user, email: 's•••@example.com' }).success).toBe(
      false,
    );
  });

  it('wraps the user in the me response', () => {
    expect(MeResponseSchema.safeParse({ user }).success).toBe(true);
    expect(MeResponseSchema.safeParse(user).success).toBe(false);
  });
});

describe('GuestDataCountsSchema', () => {
  it('counts what a sign-up claims from the guest', () => {
    expect(
      GuestDataCountsSchema.safeParse({ positions: 0, openOrders: 0, watchlist: 3 }).success,
    ).toBe(true);
    expect(
      GuestDataCountsSchema.safeParse({ positions: -1, openOrders: 0, watchlist: 0 }).success,
    ).toBe(false);
  });
});

describe('MeSummarySchema', () => {
  it('lets equity go negative but never a count', () => {
    const summary = { equityCents: -500, openOrders: 2, watchlist: 4, alerts: 1 };
    expect(MeSummarySchema.parse(summary)).toEqual(summary);
    expect(MeSummarySchema.safeParse({ ...summary, alerts: 1.5 }).success).toBe(false);
  });
});

describe('account responses', () => {
  const account = {
    id: 'acc_1',
    handle: 'ACC-7F2C9A',
    cashCents: 10_000_000,
    startingCashCents: 10_000_000,
    createdAt: 1,
    resetAt: 2,
  };

  it('reports how many sessions a password change ended', () => {
    expect(ChangePasswordResponseSchema.parse({ sessionsRevoked: 2 })).toEqual({
      sessionsRevoked: 2,
    });
    expect(ChangePasswordResponseSchema.safeParse({ sessionsRevoked: -1 }).success).toBe(false);
  });

  it('tells the customer when a deleted account is purged', () => {
    expect(DeleteAccountResponseSchema.safeParse({ purgeAt: 1_700_000_000_000 }).success).toBe(
      true,
    );
    expect(DeleteAccountResponseSchema.safeParse({ purgeAt: 'next week' }).success).toBe(false);
  });

  it('returns the fresh account after a self reset', () => {
    expect(SelfResetResponseSchema.parse({ account }).account.resetAt).toBe(2);
    expect(
      SelfResetResponseSchema.safeParse({ account: { ...account, handle: 'acc-1' } }).success,
    ).toBe(false);
  });
});

describe('session lists', () => {
  const session = {
    id: 's1',
    label: 'Mini Trading for iOS · iPhone 15',
    platform: 'ios',
    model: 'iPhone 15',
    ipMasked: '41.32.•.•',
    lastActiveAt: 2,
    createdAt: 1,
    current: false,
  };

  it('lists the customer’s sessions', () => {
    expect(SessionsResponseSchema.safeParse({ items: [session] }).success).toBe(true);
    expect(
      SessionsResponseSchema.safeParse({ items: [{ ...session, platform: 'desktop' }] }).success,
    ).toBe(false);
  });

  it('names the devices a revoke-others signed out', () => {
    expect(
      RevokeOthersResponseSchema.safeParse({ revoked: 1, labels: ['Chrome on macOS'] }).success,
    ).toBe(true);
    expect(RevokeOthersResponseSchema.safeParse({ revoked: 1 }).success).toBe(false);
  });
});

describe('SESSION_REVOKED_REASONS', () => {
  it('covers every way the server ends a session', () => {
    expect(SessionRevokedReasonSchema.options).toEqual([...SESSION_REVOKED_REASONS]);
    expect(SESSION_REVOKED_REASONS).toEqual([
      'signed_out',
      'password_changed',
      'suspended',
      'revoked',
      'deleted',
    ]);
  });
});

describe('customer auth wire constants', () => {
  it('names the cookies and headers the web and server share', () => {
    expect({
      CUSTOMER_ACCESS_COOKIE,
      CUSTOMER_REFRESH_COOKIE,
      CSRF_COOKIE,
      CSRF_HEADER,
      CLIENT_PLATFORM_HEADER,
    }).toEqual({
      CUSTOMER_ACCESS_COOKIE: 'sarwa_access',
      CUSTOMER_REFRESH_COOKIE: 'sarwa_refresh',
      CSRF_COOKIE: 'sarwa_csrf',
      CSRF_HEADER: 'x-csrf-token',
      CLIENT_PLATFORM_HEADER: 'x-client-platform',
    });
  });

  it('sends the refresh cookie to the auth routes only', () => {
    const fullPath = (route: string) => `/${API_PREFIX}${route}`;
    expect(CUSTOMER_REFRESH_COOKIE_PATH).toBe('/api/v1/auth');
    expect(fullPath(routePath(AUTH_ROUTES.refresh))).toMatch(
      new RegExp(`^${CUSTOMER_REFRESH_COOKIE_PATH}/`),
    );
    expect(fullPath(routePath(AUTH_ROUTES.signOut))).toMatch(
      new RegExp(`^${CUSTOMER_REFRESH_COOKIE_PATH}/`),
    );
    expect(fullPath(routePath(AUTH_ROUTES.me))).not.toMatch(
      new RegExp(`^${CUSTOMER_REFRESH_COOKIE_PATH}`),
    );
  });
});

describe('AUTH_LIMITS', () => {
  it('locks sign-in after 5 failures in 15 minutes and throttles email sends', () => {
    const minute = 60_000;
    expect(AUTH_LIMITS).toEqual({
      signInFailures: 5,
      signInWindowMs: 15 * minute,
      signInLockMs: 15 * minute,
      forgotPerHour: 3,
      signUpPerHour: 10,
      resendCooldownMs: minute,
    });
  });

  it('lets a resend arrive well before the verify link expires', () => {
    expect(AUTH_LIMITS.resendCooldownMs).toBeLessThan(AUTH_TTL_MS.emailVerify);
  });
});
