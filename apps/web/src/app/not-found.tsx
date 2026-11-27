import { SearchX } from 'lucide-react';
import { type Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';

import { buttonVariants, StateView } from '@sarwa/ui';

import { readLocalePreferences } from '../lib/locale-cookie';
import { appMessages } from '../lib/messages';

// A Server Component, so the copy follows the language cookie the root layout also reads.
async function notFoundCopy() {
  const cookieStore = await cookies();
  const { locale } = readLocalePreferences((name) => cookieStore.get(name)?.value);
  return appMessages[locale].notFound;
}

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await notFoundCopy()).metaTitle };
}

export default async function NotFound() {
  const copy = await notFoundCopy();
  return (
    <StateView
      className="py-24"
      icon={<SearchX />}
      title={copy.title}
      description={copy.body}
      action={
        <Link href="/markets" className={buttonVariants({ variant: 'secondary' })}>
          {copy.back}
        </Link>
      }
    />
  );
}
