'use client';

import { ShieldBan } from 'lucide-react';

import { Button } from '@sarwa/ui';

import { useCopy } from '../../lib/i18n';
import { AuthCard, AuthHeading, AuthShell, StatusIcon } from '../auth/auth-parts';
import { type SuspendedView, useSuspendedPage } from './use-suspended-page';

export function SuspendedPage({ view }: { view: SuspendedView }) {
  const { t, f } = useCopy();
  const copy = t.suspended;
  const { suspension } = view;
  return (
    <AuthShell>
      <AuthCard>
        <AuthHeading
          icon={<StatusIcon tone="neg" icon={<ShieldBan />} />}
          title={copy.title}
          body={copy.body}
        />
        {suspension ? (
          <figure className="border-border bg-surface-3 flex flex-col gap-1 rounded-md border px-4 py-3">
            <figcaption className="type-caption text-fg-3">
              {copy.reasonLabel} · {copy.reasonCategories[suspension.reasonCategory]}
            </figcaption>
            <blockquote className="type-sm text-fg">
              {copy.reason({ reason: suspension.reason, date: f.date(suspension.at) })}
            </blockquote>
          </figure>
        ) : null}
        <div className="grid gap-2.5 sm:grid-cols-2">
          <Button asChild size="lg">
            <a href={view.supportHref}>{copy.contact}</a>
          </Button>
          <Button size="lg" variant="secondary" onClick={view.actions.signOut}>
            {copy.signOut}
          </Button>
        </div>
        {suspension ? (
          <p className="type-caption text-fg-3 text-center">
            {copy.reference({ handle: suspension.accountHandle })}
          </p>
        ) : null}
      </AuthCard>
    </AuthShell>
  );
}

export function SuspendedScreen() {
  return <SuspendedPage view={useSuspendedPage()} />;
}
