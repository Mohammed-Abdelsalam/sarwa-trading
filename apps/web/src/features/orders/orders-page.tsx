'use client';

import { Download, FileText, Info, RefreshCw, TriangleAlert } from 'lucide-react';

import { type OrderFilter } from '@sarwa/contracts';
import {
  Badge,
  Button,
  Callout,
  Card,
  SegmentedControl,
  Select,
  Skeleton,
  StateView,
  StatusBadge,
  Table,
  TBody,
  TCell,
  TH,
  THead,
  TRow,
} from '@sarwa/ui';

import { OrderDrawer } from './order-drawer';
import { type DateRange, RANGES, useOrdersPage } from './use-orders-page';

const NOTICE_ICON = { info: <Info />, neutral: <Info />, neg: <TriangleAlert /> } as const;

export function OrdersPage({ routeOrderId }: { routeOrderId?: string }) {
  const page = useOrdersPage(routeOrderId);
  const { labels, actions } = page;

  return (
    <div className="mx-auto flex w-full max-w-330 flex-col gap-4.5 px-4 py-6 md:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="type-h1">{labels.title}</h1>
          {page.summary ? <p className="type-sm text-fg-2 tabular-nums">{page.summary}</p> : null}
        </div>
        <Button
          variant="secondary"
          icon={<Download aria-hidden className="size-4" />}
          disabled={page.rows.length === 0}
          onClick={actions.exportCsv}
        >
          {labels.exportCsv}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <SegmentedControl<OrderFilter>
          label={labels.status}
          value={page.filter}
          onChange={actions.setFilter}
          options={[
            { value: 'open', label: labels.tabs.open },
            { value: 'filled', label: labels.tabs.filled },
            { value: 'all', label: labels.tabs.all },
          ]}
        />
        <Select
          aria-label={labels.symbolFilter}
          value={page.symbol}
          onChange={(event) => {
            actions.setSymbol(event.target.value);
          }}
          className="h-9"
        >
          <option value="">{labels.allSymbols}</option>
          {page.symbols.map((symbol) => (
            <option key={symbol} value={symbol}>
              {symbol}
            </option>
          ))}
        </Select>
        <Select
          aria-label={labels.dateFilter}
          value={page.range}
          onChange={(event) => {
            actions.setRange(event.target.value as DateRange);
          }}
          className="h-9"
        >
          {RANGES.map((range) => (
            <option key={range} value={range}>
              {labels.ranges[range]}
            </option>
          ))}
        </Select>
      </div>

      {page.notice ? (
        <Callout
          tone={page.notice.tone}
          icon={NOTICE_ICON[page.notice.tone]}
          title={page.notice.title}
          action={
            <Button size="sm" variant="ghost" onClick={actions.dismissNotice}>
              {labels.dismiss}
            </Button>
          }
        >
          {page.notice.body || null}
        </Callout>
      ) : null}

      <Card className="overflow-hidden">
        {page.isLoading ? (
          <Skeleton className="m-4 h-60" />
        ) : page.isError ? (
          <StateView
            tone="neg"
            icon={<TriangleAlert />}
            title={labels.loadError}
            action={
              <Button
                variant="secondary"
                icon={<RefreshCw aria-hidden className="size-4" />}
                onClick={actions.retry}
              >
                {labels.retry}
              </Button>
            }
          />
        ) : page.rows.length === 0 ? (
          <StateView
            icon={<FileText />}
            title={labels.empty}
            description={page.symbol || page.filter !== 'all' ? labels.emptyFiltered : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <tr>
                  <TH className="ps-4">{labels.columns.order}</TH>
                  <TH>{labels.columns.type}</TH>
                  <TH align="end">{labels.columns.qtyAmount}</TH>
                  <TH>{labels.columns.status}</TH>
                  <TH>{labels.columns.detail}</TH>
                  <TH align="end">{labels.columns.time}</TH>
                  <TH align="end">
                    <span className="sr-only">{labels.columns.actions}</span>
                  </TH>
                </tr>
              </THead>
              <TBody>
                {page.rows.map((row) => (
                  <TRow
                    key={row.id}
                    interactive
                    aria-selected={row.id === page.selected}
                    onClick={() => {
                      actions.select(row.id);
                    }}
                  >
                    <TCell className="ps-4">
                      <button
                        type="button"
                        aria-label={labels.openA11y(row.id)}
                        onClick={(event) => {
                          event.stopPropagation();
                          actions.select(row.id);
                        }}
                        className="focus-visible:outline-focus flex cursor-pointer items-center gap-2.5 rounded-xs focus-visible:outline-2"
                      >
                        <Badge
                          square
                          tone={row.side === 'buy' ? 'brand' : 'outline'}
                          className="h-5 text-[0.625rem]"
                        >
                          {row.sideLabel}
                        </Badge>
                        <b>{row.symbol}</b>
                      </button>
                    </TCell>
                    <TCell className="text-fg-2">{row.type}</TCell>
                    <TCell align="end">{row.size}</TCell>
                    <TCell>
                      <StatusBadge status={row.status} label={row.statusLabel} />
                    </TCell>
                    <TCell className="type-sm text-fg-3 max-w-52 truncate">{row.detail}</TCell>
                    <TCell align="end" className="text-fg-2">
                      {row.time}
                    </TCell>
                    <TCell align="end">
                      {row.cancellable ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={labels.cancelA11y(row.symbol)}
                          onClick={(event) => {
                            event.stopPropagation();
                            actions.cancel(row.id);
                          }}
                        >
                          {labels.cancel}
                        </Button>
                      ) : null}
                    </TCell>
                  </TRow>
                ))}
              </TBody>
            </Table>
            {page.hasMore ? (
              <div className="border-border flex justify-center border-t p-3">
                <Button variant="ghost" loading={page.isLoadingMore} onClick={actions.loadMore}>
                  {labels.loadMore}
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </Card>

      {page.selected ? <OrderDrawer id={page.selected} onClose={actions.closeDetail} /> : null}
    </div>
  );
}
