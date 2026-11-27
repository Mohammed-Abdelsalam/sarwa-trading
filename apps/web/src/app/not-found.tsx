import { SearchX } from 'lucide-react';
import { type Metadata } from 'next';
import Link from 'next/link';

import { buttonVariants, StateView } from '@sarwa/ui';

export const metadata: Metadata = { title: 'Not found' };

export default function NotFound() {
  return (
    <StateView
      className="py-24"
      icon={<SearchX />}
      title="Page not found"
      description="This link doesn't lead anywhere in Mini Trading."
      action={
        <Link href="/markets" className={buttonVariants({ variant: 'secondary' })}>
          Back to Markets
        </Link>
      }
    />
  );
}
