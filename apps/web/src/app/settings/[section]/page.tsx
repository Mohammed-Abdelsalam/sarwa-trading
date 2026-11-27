import { type Metadata } from 'next';
import { notFound } from 'next/navigation';

import { SettingsScreen } from '../../../features/account/settings-screen';
import { SETTINGS_PAGES } from '../../../features/account/settings-sections';
import { personalMetadata } from '../../../lib/seo';

export const generateMetadata = (): Promise<Metadata> => personalMetadata('settings');

export default async function Page({ params }: PageProps<'/settings/[section]'>) {
  const { section } = await params;
  const page = SETTINGS_PAGES.find((item) => item === section);
  if (!page) notFound();
  return <SettingsScreen section={page} />;
}
