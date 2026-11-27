'use client';

import { Check } from 'lucide-react';
import Link from 'next/link';

import { Badge, Button, Card, cn } from '@sarwa/ui';

import { useCopy } from '../../lib/i18n';
import { linkClass } from '../auth/auth-parts';
import { AUTH_ROUTES, type ResendState } from '../auth/auth-view';
import { HeatmapCard, type MarketCardsView, MoversCard } from './home-cards';
import { type useHomePage } from './use-home-page';

type GuestHero = NonNullable<ReturnType<typeof useHomePage>['guest']>;

export interface GuestHomeView extends MarketCardsView {
  hero: GuestHero;
}

function Hero({ hero }: { hero: GuestHero }) {
  const { f } = useCopy();
  return (
    <Card className="flex flex-col items-start gap-4 px-5 py-7 md:px-8">
      <Badge tone="brand">{hero.badge}</Badge>
      <h1 className="type-display max-w-xl">{hero.title}</h1>
      <p className="type-body text-fg-2 max-w-xl">{hero.body}</p>
      <div className="flex flex-wrap gap-2.5">
        <Button asChild size="lg">
          <Link href={AUTH_ROUTES.signUp}>{hero.createAccount}</Link>
        </Button>
        <Button asChild size="lg" variant="secondary">
          <Link href={AUTH_ROUTES.signIn}>{hero.signIn}</Link>
        </Button>
      </div>
      <ol aria-label={hero.howItWorks} className="flex flex-wrap gap-x-6 gap-y-2">
        {hero.steps.map((step, index) => (
          <li key={step.key} className="type-sm text-fg-2 flex items-center gap-2">
            <span
              aria-hidden
              className="bg-brand-subtle text-brand-fg grid size-6 place-items-center rounded-full text-xs font-bold"
            >
              {f.number(index + 1)}
            </span>
            {step.label}
          </li>
        ))}
      </ol>
    </Card>
  );
}

// Signed out, Home pitches the app: the hero takes the equity card's place beside the live market.
export function GuestHome({ page }: { page: GuestHomeView }) {
  return (
    <div className="mx-auto flex w-full max-w-330 flex-col gap-5 px-4 py-6 md:px-8">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <Hero hero={page.hero} />
          <HeatmapCard page={page} />
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <MoversCard page={page} />
        </div>
      </div>
    </div>
  );
}

export interface ChecklistView {
  emailVerified: boolean;
  hasTraded: boolean;
  resend: ResendState;
  onResend: () => void;
}

// A new account's first steps, shown under the equity card until the first trade.
export function GettingStartedChecklist({ view }: { view: ChecklistView }) {
  const { t, f } = useCopy();
  const copy = t.home.checklist;
  const items = [
    { label: copy.created, done: true, action: null },
    {
      label: copy.verify,
      done: view.emailVerified,
      action: (
        <Button
          variant="ghost"
          size="sm"
          className={linkClass}
          loading={view.resend === 'pending'}
          disabled={view.resend === 'sent'}
          onClick={view.onResend}
        >
          {view.resend === 'sent' ? t.verifyBanner.sent : copy.resend}
        </Button>
      ),
    },
    {
      label: copy.firstTrade,
      done: view.hasTraded,
      action: (
        <Link href={AUTH_ROUTES.markets} className={cn(linkClass, 'type-sm')}>
          {copy.browse}
        </Link>
      ),
    },
  ];
  return (
    <Card className="flex flex-col gap-3 px-4.5 py-4">
      <h2 className="type-h3">{copy.title}</h2>
      <ol className="flex flex-col gap-2.5">
        {items.map((item, index) => (
          <li key={item.label} data-done={item.done} className="flex items-center gap-3">
            <span
              aria-hidden
              className={cn(
                'grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold',
                item.done ? 'bg-pos-subtle text-pos' : 'bg-surface-3 text-fg-2',
              )}
            >
              {item.done ? <Check className="size-3.5" /> : f.number(index + 1)}
            </span>
            <span className={cn('type-sm flex-1', item.done && 'text-fg-2')}>
              {item.label}
              {item.done ? <span className="sr-only"> · {t.common.done}</span> : null}
            </span>
            {item.done ? null : item.action}
          </li>
        ))}
      </ol>
    </Card>
  );
}
