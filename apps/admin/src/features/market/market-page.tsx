'use client';

import { Activity, Pause, Play, Plug } from 'lucide-react';

import { MARKET_VOLATILITY } from '@sarwa/contracts';
import { useAdminI18n } from '@sarwa/core/admin';
import {
  Badge,
  Button,
  Callout,
  Card,
  cn,
  ConnectionBadge,
  Dialog,
  Field,
  Input,
  Skeleton,
  Slider,
} from '@sarwa/ui';

import { GuardedButton, Locked, ReadOnlyBadge, ViewerNotice } from '../../components/common/access';
import { LoadError, PageHeader } from '../../components/common/states';
import { TickerRows } from '../../components/common/ticker';
import {
  DROP_WORD,
  type MarketPageModel,
  useMarketPage,
  VOLATILITY_PRESETS,
} from './use-market-page';

const SCALE = [0.5, 1, 1.5, 2, 2.5, 3];

function StatusCard({ page }: { page: MarketPageModel }) {
  const { t, f } = useAdminI18n();
  const copy = t.admin.market;
  const status = page.status;
  return (
    <Card
      className="flex flex-wrap items-center justify-between gap-6 p-5 md:p-7"
      aria-labelledby="market-status"
    >
      <div className="flex flex-col gap-2.5">
        <span id="market-status" className="type-overline text-fg-3">
          {copy.status}
        </span>
        <div className="flex items-center gap-3.5">
          <span
            aria-hidden
            className={cn(
              'grid size-14 place-items-center rounded-[18px] [&>svg]:size-8',
              page.paused ? 'bg-info-subtle text-info' : 'bg-pos-subtle text-pos',
            )}
          >
            {page.paused ? <Pause /> : <Activity />}
          </span>
          <span className="font-display text-fg text-[2.75rem] leading-12 font-extrabold">
            {page.paused ? copy.paused : copy.running}
          </span>
        </div>
        {status ? (
          <span className="type-sm text-fg-2 tabular-nums">
            {page.paused
              ? copy.pausedSince({ time: f.time(status.since) })
              : copy.runningSince({
                  time: f.time(status.since),
                  ticks: f.number(Math.round(page.ticksPerSecond)),
                })}
          </span>
        ) : null}
      </div>
      <GuardedButton
        locked={!page.canEdit}
        size="lg"
        variant={page.paused ? 'primary' : 'secondary'}
        className="min-w-50"
        loading={page.isSaving}
        icon={
          page.paused ? (
            <Play aria-hidden className="size-4" />
          ) : (
            <Pause aria-hidden className="size-4" />
          )
        }
        onClick={page.actions.toggleMarket}
      >
        {page.paused ? copy.resume : copy.pause}
      </GuardedButton>
    </Card>
  );
}

function VolatilityCard({ page }: { page: MarketPageModel }) {
  const { t, f } = useAdminI18n();
  const copy = t.admin.market;
  const label = f.multiplier(page.volatility);
  return (
    <Card className="flex flex-col gap-3.5 px-5 py-6 md:px-7">
      <div className="flex items-center justify-between">
        <h2 id="volatility-label" className="type-h3 text-fg">
          {copy.volatility}
        </h2>
        <Badge
          tone={page.canEdit ? 'brand' : 'neutral'}
          className="h-7.5 px-3 text-[0.9375rem] tabular-nums"
        >
          {label}
        </Badge>
      </div>
      <Locked locked={!page.canEdit}>
        <Slider
          className="w-full"
          aria-labelledby="volatility-label"
          min={MARKET_VOLATILITY.min}
          max={MARKET_VOLATILITY.max}
          step={0.1}
          value={[page.volatility]}
          onValueChange={([value]) => {
            if (value !== undefined) page.actions.dragVolatility(value);
          }}
          onValueCommit={([value]) => {
            if (value !== undefined) page.actions.setVolatility(value);
          }}
        />
      </Locked>
      <div aria-hidden className="type-caption text-fg-3 flex justify-between tabular-nums">
        {SCALE.map((step, i) => (
          <span key={step}>
            {f.multiplier(step)}
            {i === 0 ? ` ${copy.calm}` : i === SCALE.length - 1 ? ` ${copy.wild}` : ''}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="type-sm text-fg-2">{copy.volatilityHint}</p>
        <div
          role="group"
          aria-label={copy.presets}
          className="bg-surface-3 rounded-seg p-seg-pad flex gap-0.5"
        >
          {(Object.keys(VOLATILITY_PRESETS) as (keyof typeof VOLATILITY_PRESETS)[]).map((key) => (
            <button
              key={key}
              type="button"
              disabled={!page.canEdit}
              aria-pressed={page.volatility === VOLATILITY_PRESETS[key]}
              onClick={() => {
                page.actions.setVolatility(VOLATILITY_PRESETS[key]);
              }}
              className="type-sm text-fg-2 hover:text-fg aria-pressed:bg-surface aria-pressed:text-fg aria-pressed:shadow-e1 rounded-control-sm h-8 cursor-pointer px-3 font-semibold disabled:cursor-not-allowed disabled:opacity-40"
            >
              {copy.presetNames[key]}
            </button>
          ))}
        </div>
      </div>
    </Card>
  );
}

function DropCard({ page }: { page: MarketPageModel }) {
  const { t, f } = useAdminI18n();
  const copy = t.admin.market;
  return (
    <Card className="border-neg/45 flex flex-wrap items-center justify-between gap-6 px-5 py-5.5 md:px-7">
      <div className="flex items-start gap-3.5">
        <span
          aria-hidden
          className="bg-neg-subtle text-neg grid size-10 shrink-0 place-items-center rounded-xl"
        >
          <Plug className="size-5" />
        </span>
        <div>
          <h2 className="type-h3 text-fg">{copy.drop}</h2>
          <p className="type-sm text-fg-2">
            {page.canEdit ? copy.dropBody({ n: f.number(page.clients) }) : copy.dropViewer}
          </p>
        </div>
      </div>
      <GuardedButton locked={!page.canEdit} variant="danger" onClick={page.actions.openDrop}>
        {copy.drop}
      </GuardedButton>
    </Card>
  );
}

export function MarketPage() {
  const page = useMarketPage();
  const { f, t } = useAdminI18n();
  const copy = t.admin.market;

  if (page.isError) {
    return (
      <>
        <PageHeader title={copy.title} subtitle={copy.subtitle} />
        <LoadError what={copy.loading} onRetry={page.actions.retry} />
      </>
    );
  }

  return (
    <>
      {page.canEdit ? null : <ViewerNotice />}
      <PageHeader title={copy.title} subtitle={page.canEdit ? copy.subtitle : undefined}>
        {page.canEdit ? null : <ReadOnlyBadge />}
        {page.canEdit && page.lastChange ? (
          <span className="type-caption text-fg-3">
            {copy.lastChange({
              who: page.lastChange.who,
              what: t.admin.activity[page.lastChange.action],
              when: f.relative(page.lastChange.at, page.lastChange.now),
            })}
          </span>
        ) : null}
      </PageHeader>
      {page.failed ? (
        <Callout tone="neg" urgent>
          {t.admin.states.actionFailed}
        </Callout>
      ) : null}
      {page.drop.dropped !== null ? (
        <Callout tone="info" role="status">
          {copy.dropped({ n: f.number(page.drop.dropped) })}
        </Callout>
      ) : null}
      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          {page.isLoading ? (
            <Skeleton className="h-44 w-full rounded-lg" />
          ) : (
            <StatusCard page={page} />
          )}
          <VolatilityCard page={page} />
          <DropCard page={page} />
        </div>
        <Card className="relative flex min-h-0 flex-col overflow-hidden" aria-label={copy.ticker}>
          <div className="border-border flex items-center justify-between border-b px-5 py-4.5">
            <h2 className="type-h3 text-fg">{copy.ticker}</h2>
            <ConnectionBadge
              status={page.paused ? 'paused' : 'live'}
              label={page.paused ? t.admin.shell.live.paused : t.admin.shell.live.live}
            />
          </div>
          <TickerRows
            rows={page.ticker}
            isLoading={page.tickerLoading}
            frozen={page.paused}
            sparkline
            className="flex-1 overflow-y-auto"
          />
          {page.paused ? (
            <div
              role="status"
              className="bg-info-subtle type-sm text-fg flex items-center gap-2.5 px-5 py-3"
            >
              <Pause aria-hidden className="text-info size-4" />
              {copy.frozen}
            </div>
          ) : null}
        </Card>
      </div>
      <Dialog
        open={page.drop.open}
        onOpenChange={(open) => {
          if (!open) page.actions.closeDrop();
        }}
        title={copy.dropTitle({ n: f.number(page.clients) })}
        description={copy.dropDialogBody}
        footer={
          <>
            <Button variant="ghost" onClick={page.actions.closeDrop}>
              {t.common.cancel}
            </Button>
            <Button
              variant="danger"
              disabled={!page.drop.confirmed}
              loading={page.isSaving}
              onClick={page.actions.confirmDrop}
            >
              {copy.dropSubmit}
            </Button>
          </>
        }
      >
        <Field label={copy.dropConfirmLabel({ word: DROP_WORD })}>
          {(field) => (
            <Input
              {...field}
              autoComplete="off"
              value={page.drop.text}
              onChange={(event) => {
                page.actions.setDropText(event.target.value);
              }}
            />
          )}
        </Field>
      </Dialog>
    </>
  );
}
