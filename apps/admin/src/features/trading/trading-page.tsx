'use client';

import { Pause } from 'lucide-react';

import { bps, type MarketState, marketTime, type SessionPhase } from '@sarwa/core';
import { SESSION_MODES, useAdminI18n } from '@sarwa/core/admin';
import {
  Badge,
  Callout,
  Card,
  MarketStatusPill,
  SegmentedControl,
  Skeleton,
  StockAvatar,
  Table,
  TBody,
  TCell,
  TH,
  THead,
  TRow,
} from '@sarwa/ui';

import {
  GuardedButton,
  GuardedSwitch,
  Locked,
  ReadOnlyBadge,
  ViewerNotice,
} from '../../components/common/access';
import { ConfirmDialog } from '../../components/common/confirm-dialog';
import { LoadError, PageHeader, TableSkeleton } from '../../components/common/states';
import { HaltDialog } from './halt-dialog';
import { RulesForm } from './rules-form';
import { type TradingPageModel, useTradingPage } from './use-trading-page';

const PILL_STATE: Record<SessionPhase, MarketState> = {
  pre: 'pre',
  regular: 'open',
  post: 'post',
  closed: 'closed',
};

function ControlCards({ page }: { page: TradingPageModel }) {
  const { t, f } = useAdminI18n();
  const data = page.trading;
  if (!data) return null;
  const breaker = data.circuitBreaker;
  const session = data.session;
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="flex flex-col gap-2.5 px-5 py-4.5">
        <div className="flex items-center justify-between">
          <h2 id="kill-switch" className="type-h3 text-fg">
            {t.admin.tradingEnabled}
          </h2>
          <GuardedSwitch
            locked={!page.canEdit}
            aria-labelledby="kill-switch"
            checked={data.tradingEnabled}
            disabled={page.isUpdating}
            onCheckedChange={page.actions.setTradingEnabled}
          />
        </div>
        <p className="type-sm text-fg-2">{t.admin.killSwitchHint}</p>
        {page.changedBy && data.changedAt ? (
          <span className="type-caption text-fg-3">
            {t.admin.lastChanged({ who: page.changedBy, time: f.dateTime(data.changedAt) })}
          </span>
        ) : null}
      </Card>
      <Card className="flex flex-col gap-2.5 px-5 py-4.5">
        <div className="flex items-center justify-between">
          <h2 id="circuit-breaker" className="type-h3 text-fg">
            {t.admin.circuitBreaker}
          </h2>
          <GuardedSwitch
            locked={!page.canEdit}
            aria-labelledby="circuit-breaker"
            checked={breaker.enabled}
            disabled={page.isUpdating}
            onCheckedChange={page.actions.setCircuitBreaker}
          />
        </div>
        <p className="type-sm text-fg-2">
          {t.admin.circuitBreakerRule({
            move: f.percent(bps(breaker.moveBps)),
            window: t.common.minutes(f.count(breaker.windowMs / 60_000)),
            halt: t.common.minutes(f.count(breaker.haltMs / 60_000)),
          })}
        </p>
        <span className="type-caption text-fg-3">
          <span className={data.tripsToday.length > 0 ? 'text-warn font-semibold' : undefined}>
            {t.admin.tripsToday(f.count(data.tripsToday.length))}
          </span>
          {page.lastTrip
            ? ` · ${t.admin.trading.tripDetail({ symbol: page.lastTrip.symbol, time: f.time(page.lastTrip.at) })}`
            : null}
        </span>
      </Card>
      <Card className="flex flex-col gap-2.5 px-5 py-4.5">
        <h2 className="type-h3 text-fg">{t.admin.session}</h2>
        <div className="type-sm flex flex-col gap-1">
          <span>
            <span className="text-fg-3">{t.admin.sessionNow}</span> ·{' '}
            {t.market.phases[session.phase]}
            {session.isOpen
              ? ` (${t.admin.trading.closesAt({ time: f.time(session.closesAt) })})`
              : null}
            {session.earlyClose ? ` ${t.admin.trading.earlyClose}` : null}
          </span>
          {session.isOpen ? null : (
            <span>
              <span className="text-fg-3">{t.admin.sessionNext}</span> ·{' '}
              {t.admin.trading.opensAt({ time: f.dateTime(session.opensAt) })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span aria-hidden className="type-caption text-fg-2 font-semibold">
            {t.admin.trading.sessionMode}
          </span>
          <Locked locked={!page.canEdit}>
            <SegmentedControl
              label={t.admin.trading.sessionMode}
              options={SESSION_MODES.map((mode) => ({
                value: mode,
                label: t.admin.trading.sessionModes[mode],
              }))}
              value={data.sessionMode}
              onChange={page.actions.setSessionMode}
              disabled={!page.canEdit || page.isUpdating}
            />
          </Locked>
        </div>
        <span className="type-caption text-fg-3">{t.admin.sessionNote}</span>
      </Card>
    </div>
  );
}

function TradingConfirmDialog({ page }: { page: TradingPageModel }) {
  const { t } = useAdminI18n();
  const copy = t.admin.trading;
  const request = page.confirm.request;
  const text =
    request?.kind === 'sessionMode'
      ? {
          title: copy.confirmSessionMode.title({ mode: copy.sessionModes[request.mode] }),
          body: copy.confirmSessionMode.body[request.mode],
          submit: copy.confirmSessionMode.submit,
        }
      : request?.kind === 'breakerOff'
        ? copy.confirmBreakerOff
        : copy.confirmTradingOff;
  return (
    <ConfirmDialog
      open={request !== null}
      {...text}
      isSaving={page.confirm.isSaving}
      failed={page.confirm.failed}
      onConfirm={page.actions.confirm}
      onCancel={page.actions.cancelConfirm}
    />
  );
}

function HaltsCard({ page }: { page: TradingPageModel }) {
  const { t, f } = useAdminI18n();
  const halts = page.trading?.halts ?? [];
  const empty = halts.length === 0 && page.disabledStocks.length === 0;
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3.5">
        <h2 className="type-h3 text-fg">{t.admin.halts}</h2>
        <GuardedButton
          locked={!page.canEdit}
          variant="secondary"
          size="sm"
          icon={<Pause aria-hidden className="size-3.5" />}
          onClick={() => {
            page.halt.actions.open();
          }}
        >
          {t.admin.haltSymbol}
        </GuardedButton>
      </div>
      {empty ? (
        <p className="type-sm text-fg-2 border-border border-t px-4 py-6 text-center">
          {t.admin.trading.noHalts}
        </p>
      ) : (
        <Table label={t.admin.halts}>
          <THead>
            <TRow>
              <TH className="ps-4">{t.admin.haltColumns.symbol}</TH>
              <TH className="max-md:hidden">{t.admin.haltColumns.reason}</TH>
              <TH>{t.admin.haltColumns.since}</TH>
              <TH>{t.admin.haltColumns.resumes}</TH>
              <TH align="end">
                <span className="sr-only">{t.admin.haltColumns.actions}</span>
              </TH>
            </TRow>
          </THead>
          <TBody>
            {halts.map((halt) => (
              <TRow key={halt.symbol}>
                <TCell className="ps-4">
                  <span className="flex items-center gap-2">
                    <StockAvatar
                      symbol={halt.symbol}
                      sector={page.sectorOf(halt.symbol)}
                      size={32}
                    />
                    <b>{halt.symbol}</b>
                    <Badge tone="warn">{t.admin.haltedBadge}</Badge>
                  </span>
                </TCell>
                <TCell className="text-fg-2 max-w-60 truncate max-md:hidden">{halt.message}</TCell>
                <TCell className="tabular-nums">{f.time(halt.since)}</TCell>
                <TCell className="tabular-nums">
                  {halt.resumesAt === null ? (
                    <span className="text-fg-3">{t.admin.manual}</span>
                  ) : (
                    <>
                      {f.time(halt.resumesAt)}{' '}
                      {halt.source === 'circuit_breaker' ? (
                        <span className="text-fg-3">{t.admin.auto}</span>
                      ) : null}
                    </>
                  )}
                </TCell>
                <TCell align="end">
                  <GuardedButton
                    locked={!page.canEdit}
                    variant="ghost"
                    size="sm"
                    loading={page.resuming === halt.symbol}
                    onClick={() => {
                      page.actions.resume(halt.symbol);
                    }}
                  >
                    {t.admin.resumeNow}
                  </GuardedButton>
                </TCell>
              </TRow>
            ))}
            {page.disabledStocks.map((stock) => (
              <TRow key={`off-${stock.symbol}`}>
                <TCell className="ps-4">
                  <span className="flex items-center gap-2">
                    <StockAvatar symbol={stock.symbol} sector={stock.sector} size={32} />
                    <b>{stock.symbol}</b>
                    <Badge tone="outline">{t.admin.offBadge}</Badge>
                  </span>
                </TCell>
                <TCell className="text-fg-2">{t.admin.nav.stocks}</TCell>
                <TCell className="tabular-nums">{f.dateTime(Date.parse(stock.updatedAt))}</TCell>
                <TCell className="text-fg-3">{t.admin.manual}</TCell>
                <TCell align="end">
                  <GuardedButton
                    locked={!page.canEdit}
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      page.actions.enableStock(stock.symbol);
                    }}
                  >
                    {t.common.enable}
                  </GuardedButton>
                </TCell>
              </TRow>
            ))}
          </TBody>
        </Table>
      )}
      <p className="border-border type-caption text-fg-3 border-t px-4 py-3">{t.admin.haltsNote}</p>
    </Card>
  );
}

function CalendarStrip({ page }: { page: TradingPageModel }) {
  const { t, f } = useAdminI18n();
  return (
    <Card className="flex flex-wrap items-center gap-4.5 px-4.5 py-3.5">
      <h2 className="type-h3 text-fg whitespace-nowrap">{t.admin.marketCalendar}</h2>
      {page.calendar.length === 0 ? (
        <p className="type-sm text-fg-2">{t.admin.trading.noCalendar}</p>
      ) : (
        <ul className="flex flex-wrap gap-3">
          {page.calendar.map((day) => (
            <li
              key={day.date}
              className="bg-surface-3 flex min-w-37.5 flex-col gap-0.5 rounded-[10px] px-3 py-2"
            >
              <span className="type-caption text-fg-3">
                {f.date(marketTime(day.date, 0), { weekday: true })}
              </span>
              <span className="type-sm text-fg font-semibold">
                {day.kind === 'early_close' && day.closesAt !== null
                  ? t.admin.earlyCloseAt({ time: f.time(day.closesAt) })
                  : t.admin.closedFor({ holiday: day.label })}
              </span>
              <Badge
                tone={day.isToday ? 'warn' : day.kind === 'holiday' ? 'outline' : 'neutral'}
                className="h-4.5 self-start text-[0.625rem]"
              >
                {day.isToday
                  ? t.admin.calendarToday
                  : day.kind === 'holiday'
                    ? t.admin.calendarHoliday
                    : t.admin.calendarScheduled}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function TradingPage() {
  const page = useTradingPage();
  const { t } = useAdminI18n();
  const session = page.trading?.session;

  return (
    <>
      {page.canEdit ? null : <ViewerNotice />}
      <PageHeader title={t.admin.tradingControls} subtitle={t.admin.tradingControlsSub}>
        {page.canEdit ? null : <ReadOnlyBadge />}
        {session ? (
          <MarketStatusPill
            state={PILL_STATE[session.phase]}
            label={`${t.market.phases[session.phase]}${session.earlyClose ? ` ${t.admin.trading.earlyClose}` : ''}`}
          />
        ) : null}
      </PageHeader>
      {page.isError && !page.trading ? (
        <LoadError what={t.admin.trading.controls} onRetry={page.actions.retry} />
      ) : page.isLoading ? (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            {[0, 1, 2].map((card) => (
              <Skeleton key={card} className="h-36 rounded-lg" />
            ))}
          </div>
          <Card>
            <TableSkeleton columns={5} rows={3} label={t.admin.trading.controls} />
          </Card>
        </>
      ) : (
        <>
          {page.failed ? (
            <Callout tone="neg" urgent>
              {t.admin.states.actionFailed}
            </Callout>
          ) : null}
          <ControlCards page={page} />
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
            <HaltsCard page={page} />
            <RulesForm form={page.rules} canEdit={page.canEdit} />
          </div>
          <CalendarStrip page={page} />
          <HaltDialog halt={page.halt} />
          <TradingConfirmDialog page={page} />
        </>
      )}
    </>
  );
}
