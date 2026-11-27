import { type Metadata } from 'next';

import { getAdminMessages } from '@sarwa/core/server';

import { InviteScreen } from '../../../features/invite/invite-page';

export const metadata: Metadata = { title: getAdminMessages('en').invite.title };

export default async function Page({ params }: PageProps<'/invite/[token]'>) {
  const { token } = await params;
  return <InviteScreen token={token} />;
}
