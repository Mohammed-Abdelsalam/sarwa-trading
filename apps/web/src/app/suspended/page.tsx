import { type Metadata } from 'next';

import { SuspendedScreen } from '../../features/account/suspended-page';
import { serverCopy } from '../../lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await serverCopy();
  return { title: t.suspended.title, robots: { index: false, follow: false } };
}

export default function Page() {
  return <SuspendedScreen />;
}
