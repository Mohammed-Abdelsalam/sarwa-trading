import { randomUUID } from 'node:crypto';

import { type Role } from '@sarwa/contracts';

import { type CapturingMailer } from './app';

import type request from 'supertest';

export interface InvitedAdmin {
  id: string;
  email: string;
  password: string;
  cookie: string;
}

// Invites a new admin with an ADMIN's cookie and accepts it from the emailed link.
export async function inviteAdmin(
  http: ReturnType<typeof request>,
  mailer: CapturingMailer,
  adminCookie: string,
  role: Role,
): Promise<InvitedAdmin> {
  const email = `ops-${randomUUID().slice(0, 8)}@sarwa.dev`;
  const password = 'team-member-42';
  await http
    .post('/api/v1/admin/invites')
    .set('Cookie', adminCookie)
    .send({ email, role })
    .expect(201);
  const res = await http
    .post('/api/v1/admin/invites/accept')
    .set('X-Forwarded-For', `198.51.102.${String(Math.floor(Math.random() * 250) + 1)}`)
    .send({ token: mailer.tokenFor(email, 'admin_invite'), name: 'Ops', password })
    .expect(201);
  const cookie = ([] as string[]).concat(res.headers['set-cookie'] ?? [])[0]!.split(';')[0]!;
  return { id: res.body.user.id as string, email, password, cookie };
}
