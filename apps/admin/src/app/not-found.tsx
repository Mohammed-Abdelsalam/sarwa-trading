'use client';

import { SearchX } from 'lucide-react';
import Link from 'next/link';

import { useAdminI18n } from '@sarwa/core/admin';
import { buttonVariants, StateView } from '@sarwa/ui';

export default function NotFound() {
  const { t } = useAdminI18n();
  return (
    <StateView
      className="py-24"
      icon={<SearchX />}
      title={t.admin.states.notFound}
      description={t.admin.states.notFoundBody}
      action={
        <Link href="/overview" className={buttonVariants({ variant: 'secondary' })}>
          {t.admin.forbidden.back}
        </Link>
      }
    />
  );
}
