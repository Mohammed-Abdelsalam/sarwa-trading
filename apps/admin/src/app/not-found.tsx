'use client';

import { SearchX } from 'lucide-react';
import Link from 'next/link';

import { useI18n } from '@sarwa/core';
import { buttonVariants, StateView } from '@sarwa/ui';

export default function NotFound() {
  const { t } = useI18n();
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
