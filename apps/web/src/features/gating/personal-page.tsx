'use client';

import { type ReactNode } from 'react';

import { Skeleton } from '@sarwa/ui';

import { useCopy } from '../../lib/i18n';
import { type GuestEmptyKind, GuestEmptyState, GuestPortfolioCard } from './guest-views';
import { usePersonalPage } from './use-personal-page';

// A personal page for members only: a guest gets the invite, never a load error.
export function PersonalPage({ kind, children }: { kind: GuestEmptyKind; children: ReactNode }) {
  const page = usePersonalPage(kind);
  const { t, m } = useCopy();
  if (page.status === 'member') return children;
  return (
    <div className="mx-auto flex w-full max-w-250 flex-col gap-5 px-4 py-6 md:px-8">
      <h1 className="type-h1">{t.nav[kind]}</h1>
      {page.status === 'loading' ? (
        <div role="status" aria-label={m.loading}>
          <Skeleton className="h-80 w-full rounded-lg" />
        </div>
      ) : kind === 'portfolio' ? (
        <GuestPortfolioCard
          stockCount={page.stockCount}
          onCreate={page.onCreate}
          onSignIn={page.onSignIn}
        />
      ) : (
        <GuestEmptyState kind={kind} onCreate={page.onCreate} onSignIn={page.onSignIn} />
      )}
    </div>
  );
}
