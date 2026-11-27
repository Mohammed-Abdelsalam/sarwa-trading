import { randomUUID } from 'node:crypto';

import {
  AuthSessionResponseSchema,
  CLIENT_PLATFORM_HEADER,
  type ClientPlatform,
  DEVICE_ID_HEADER,
} from '@sarwa/contracts';

import type request from 'supertest';

export const PASSWORD = 'correct-horse-42';

export interface Customer {
  id: string;
  ip: string;
  email: string;
  userId: string;
  accountId: string;
  handle: string;
  token: string;
  refreshToken: string;
}

let counter = 0;
export const uniqueEmail = (prefix = 'trader') =>
  `${prefix}-${String(++counter)}-${randomUUID().slice(0, 8)}@example.com`;

// Signs up like the mobile app (bearer tokens in the body) from its own device and IP.
export async function signUp(
  http: ReturnType<typeof request>,
  options: {
    ip: string;
    deviceId?: string;
    email?: string;
    name?: string;
    platform?: Exclude<ClientPlatform, 'web'>;
  },
): Promise<Customer> {
  const id = options.deviceId ?? randomUUID();
  const email = options.email ?? uniqueEmail();
  const res = await http
    .post('/api/v1/auth/sign-up')
    .set(DEVICE_ID_HEADER, id)
    .set(CLIENT_PLATFORM_HEADER, options.platform ?? 'ios')
    .set('X-Forwarded-For', options.ip)
    .send({
      name: options.name ?? 'Test Trader',
      email,
      password: PASSWORD,
      terms: true,
      keepSignedIn: true,
    })
    .expect(201);
  const { user, accessToken, refreshToken } = AuthSessionResponseSchema.parse(res.body);
  return {
    id,
    ip: options.ip,
    email,
    userId: user.id,
    accountId: user.account.id,
    handle: user.account.handle,
    token: accessToken!,
    refreshToken: refreshToken!,
  };
}

export const bearer = (customer: { token: string }) => `Bearer ${customer.token}`;
