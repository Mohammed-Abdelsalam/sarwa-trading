import { type ReactNode } from 'react';

import { type Stock } from '@sarwa/contracts';
import { Badge, Breadcrumbs, StockAvatar } from '@sarwa/ui';

import { RouteLink } from '../../components/route-link';

// Server-rendered: name, ticker and breadcrumbs never change, so they ship as HTML without JS.
export function StockHeading({
  symbol,
  stock,
  labels,
  actions,
}: {
  symbol: string;
  stock: Stock | undefined;
  labels: { markets: string; sector: string | undefined };
  actions: ReactNode;
}) {
  return (
    <>
      <Breadcrumbs
        link={RouteLink}
        items={[
          { label: labels.markets, href: '/markets' },
          ...(labels.sector ? [{ label: labels.sector }] : []),
          { label: symbol },
        ]}
      />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          {stock ? <StockAvatar symbol={symbol} sector={stock.sector} size={56} /> : null}
          <div>
            <h1 className="type-h1">{stock?.name ?? symbol}</h1>
            <div className="type-sm text-fg-2 flex items-center gap-2">
              <b className="text-fg">{symbol}</b>
              {stock ? <Badge square>{stock.exchange}</Badge> : null}
              {labels.sector ? <Badge>{labels.sector}</Badge> : null}
            </div>
          </div>
        </div>
        {actions}
      </div>
    </>
  );
}
