'use client';

import { Bell, Briefcase, ListOrdered, BellRing } from 'lucide-react';
import Link from 'next/link';
import { type ReactNode } from 'react';

import { POLICY, SIGN_UP_SECONDS } from '@sarwa/core';
import {
  Button,
  Card,
  cn,
  IconButton,
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
  StateView,
} from '@sarwa/ui';

import { useCopy } from '../../lib/i18n';
import { AUTH_ROUTES } from '../auth/auth-view';

export interface GuestCallbacks {
  onCreate: () => void;
  onSignIn: () => void;
}

function useStartingCash() {
  const { f } = useCopy();
  return f.money(POLICY.startingCashCents, { whole: true });
}

function GuestButtons({ onCreate, onSignIn, className }: GuestCallbacks & { className?: string }) {
  const { t } = useCopy();
  return (
    <div className={cn('flex flex-wrap justify-center gap-2.5', className)}>
      <Button onClick={onCreate}>{t.gate.cta.createFree}</Button>
      <Button variant="secondary" onClick={onSignIn}>
        {t.gate.cta.signIn}
      </Button>
    </div>
  );
}

export type GuestEmptyKind = 'portfolio' | 'orders' | 'alerts';

const EMPTY_ICONS: Record<GuestEmptyKind, ReactNode> = {
  portfolio: <Briefcase />,
  orders: <ListOrdered />,
  alerts: <BellRing />,
};

// The friendly "invite" empty state for a personal page: never error-styled.
export function GuestEmptyState({
  kind,
  symbol,
  onCreate,
  onSignIn,
}: GuestCallbacks & { kind: GuestEmptyKind; symbol?: string }) {
  const { t } = useCopy();
  const amount = useStartingCash();
  const empty = t.guest.empty;
  const copy: Record<GuestEmptyKind, { title: string; body: string }> = {
    portfolio: { title: empty.portfolioTitle, body: empty.portfolioBody({ amount }) },
    orders: { title: empty.ordersTitle, body: empty.ordersBody },
    alerts: {
      title: empty.alertsTitle,
      body: symbol ? empty.alertsBody({ symbol }) : empty.alertsBodyAny,
    },
  };
  return (
    <Card>
      <StateView
        tone="brand"
        icon={EMPTY_ICONS[kind]}
        title={copy[kind].title}
        description={copy[kind].body}
        action={<GuestButtons onCreate={onCreate} onSignIn={onSignIn} />}
      />
    </Card>
  );
}

export function GuestSteps({ stockCount }: { stockCount: number }) {
  const { t, f } = useCopy();
  const amount = useStartingCash();
  const steps = t.guest.steps;
  const rows = [
    { title: steps.create.title, body: steps.create.body({ n: f.number(SIGN_UP_SECONDS) }) },
    { title: steps.cash.title({ amount }), body: steps.cash.body },
    { title: steps.trade.title({ n: f.number(stockCount) }), body: steps.trade.body },
  ];
  return (
    <ol className="grid gap-3 sm:grid-cols-3">
      {rows.map((row, index) => (
        <li
          key={row.title}
          className="border-border bg-surface-2 flex gap-3 rounded-md border p-3.5"
        >
          <span
            aria-hidden
            className="bg-brand-subtle text-brand-fg type-sm grid size-7 shrink-0 place-items-center rounded-full font-bold"
          >
            {f.number(index + 1)}
          </span>
          <span className="min-w-0">
            <b className="type-sm block">{row.title}</b>
            <span className="type-caption text-fg-3 block">{row.body}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

// The guest Portfolio page: the pitch, both calls to action and how it works.
export function GuestPortfolioCard({
  stockCount,
  onCreate,
  onSignIn,
}: GuestCallbacks & { stockCount: number }) {
  const { t } = useCopy();
  const amount = useStartingCash();
  return (
    <Card className="flex flex-col gap-5 px-5 py-8 md:px-8">
      <div className="flex flex-col items-center gap-2 text-center">
        <span
          aria-hidden
          className="size-art rounded-art bg-brand-subtle text-brand-fg grid place-items-center [&>svg]:size-8"
        >
          <Briefcase />
        </span>
        <h2 className="type-h2">{t.guest.portfolio.title({ amount })}</h2>
        <p className="type-sm text-fg-2 max-w-md">{t.guest.portfolio.body}</p>
      </div>
      <GuestButtons onCreate={onCreate} onSignIn={onSignIn} />
      <GuestSteps stockCount={stockCount} />
    </Card>
  );
}

// The guest bell: no inbox yet, just what an account would bring.
export function GuestBell({ onCreate, onSignIn }: GuestCallbacks) {
  const { t } = useCopy();
  return (
    <Popover>
      <PopoverTrigger asChild>
        <IconButton label={t.guest.bell.a11y}>
          <Bell aria-hidden className="size-5" />
        </IconButton>
      </PopoverTrigger>
      <PopoverContent
        aria-label={t.notifications.title}
        className="flex w-80 max-w-[calc(100vw-2rem)] flex-col items-center gap-2 p-5 text-center"
      >
        <span
          aria-hidden
          className="bg-brand-subtle text-brand-fg grid size-11 place-items-center rounded-full"
        >
          <BellRing className="size-5" />
        </span>
        <b className="type-h3">{t.guest.bell.title}</b>
        <p className="type-sm text-fg-2">{t.guest.bell.body}</p>
        <PopoverClose asChild>
          <Button className="mt-1 w-full" onClick={onCreate}>
            {t.gate.cta.createFree}
          </Button>
        </PopoverClose>
        <PopoverClose asChild>
          <Button variant="ghost" className="w-full" onClick={onSignIn}>
            {t.gate.cta.signIn}
          </Button>
        </PopoverClose>
      </PopoverContent>
    </Popover>
  );
}

// Signed-out top bar: Sign in (ghost) and Create account (primary) replace bell and avatar.
export function GuestTopBarActions() {
  const { t } = useCopy();
  return (
    <div className="flex items-center gap-1.5">
      <Button asChild variant="ghost" size="sm" className="max-sm:hidden">
        <Link href={AUTH_ROUTES.signIn}>{t.gate.tabs.signIn}</Link>
      </Button>
      <Button asChild size="sm">
        <Link href={AUTH_ROUTES.signUp}>{t.gate.tabs.signUp}</Link>
      </Button>
    </div>
  );
}
