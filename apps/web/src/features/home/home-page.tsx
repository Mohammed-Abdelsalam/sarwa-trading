'use client';

import { ArrowRight, Megaphone } from 'lucide-react';
import Link from 'next/link';

import { DIRECTION_ARROW } from '@sarwa/core';
import { Banner, Card, cn, Skeleton } from '@sarwa/ui';

import { NotificationIcon } from '../../components/layout/notification-center';
import { EquityChart } from '../../components/trading/equity-chart';
import { GettingStartedChecklist, GuestHome } from './guest-home';
import { HeatmapCard, MoversCard } from './home-cards';
import { useHomePage } from './use-home-page';

const TONE = { up: 'text-pos', down: 'text-neg', flat: 'text-fg-2' } as const;
const linkClass =
  'type-sm text-brand-fg focus-visible:outline-focus inline-flex items-center gap-1 rounded-xs font-semibold focus-visible:outline-2';

export function HomePage() {
  const page = useHomePage();
  const { labels, actions } = page;
  if (page.guest) return <GuestHome page={{ ...page, hero: page.guest }} />;

  return (
    <div className="mx-auto flex w-full max-w-330 flex-col gap-5 px-4 py-6 md:px-8">
      {page.banner ? (
        <Banner
          tone="brand"
          icon={<Megaphone aria-hidden />}
          onDismiss={actions.dismissBanner}
          dismissLabel={labels.dismiss}
        >
          <b className="font-semibold">{page.banner.title}</b> {page.banner.body}
        </Banner>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <Card className="flex flex-col gap-1.5 px-5 py-4.5">
            <div className="flex justify-between">
              <h1 className="type-sm text-fg-2 font-semibold">{labels.totalEquity}</h1>
              <Link href="/portfolio" className={linkClass}>
                {labels.portfolioLink}
                <ArrowRight aria-hidden className="size-3.5 rtl:-scale-x-100" />
              </Link>
            </div>
            {page.equity ? (
              <>
                <span className="type-display">{page.equity.value}</span>
                <span className="type-sm">
                  <span className={cn('font-semibold', TONE[page.equity.direction])}>
                    <span aria-hidden>{DIRECTION_ARROW[page.equity.direction]} </span>
                    {page.equity.today} ({page.equity.todayPct})
                  </span>{' '}
                  <span className="text-fg-3">{labels.today}</span>
                </span>
              </>
            ) : (
              <Skeleton className="h-16 w-64" />
            )}
            <EquityChart
              values={page.curve.values}
              loading={page.curve.loading}
              height={120}
              label={labels.equityA11y}
            />
            <dl className="border-border grid grid-cols-2 gap-3 border-t pt-3 sm:grid-cols-4">
              {page.kpis.map((kpi) => (
                <div key={kpi.label}>
                  <dt className="type-caption text-fg-3">{kpi.label}</dt>
                  <dd
                    className={cn('type-num-md', kpi.direction ? TONE[kpi.direction] : undefined)}
                  >
                    {kpi.value}
                  </dd>
                </div>
              ))}
            </dl>
          </Card>

          {page.checklist ? <GettingStartedChecklist view={page.checklist} /> : null}
          <HeatmapCard page={page} />
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <MoversCard page={page} />

          <Card className="flex flex-col gap-2.5 px-4 py-3.5">
            <div className="flex justify-between">
              <h2 className="type-h3">{labels.activity}</h2>
              <Link href="/orders" className={linkClass}>
                {labels.viewAll}
              </Link>
            </div>
            {page.activity.length === 0 ? (
              <p className="type-sm text-fg-3">{labels.noActivity}</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {page.activity.map((row) => (
                  <li key={row.id}>
                    <Link
                      href={row.href}
                      className="focus-visible:outline-focus flex items-start gap-2.5 rounded-xs focus-visible:outline-2"
                    >
                      <NotificationIcon tone={row.tone} />
                      <span className="min-w-0 flex-1">
                        <b className="type-sm block">{row.title}</b>
                        <span className="type-caption text-fg-3 block">{row.body}</span>
                      </span>
                      <span className="type-caption text-fg-3 whitespace-nowrap">{row.when}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
