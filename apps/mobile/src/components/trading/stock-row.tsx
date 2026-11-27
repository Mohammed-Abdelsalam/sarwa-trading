import { Link } from 'expo-router';
import { memo } from 'react';
import { Pressable, View } from 'react-native';

import { type StockWithQuote } from '@sarwa/contracts';
import {
  changePct,
  direction,
  formatListPrice,
  formatPct,
  formatStockLabel,
  useQuote,
} from '@sarwa/core';
import { layout } from '@sarwa/tokens';

import { cx, useLargeText } from '../../lib/theme';
import { Skeleton } from '../ui/skeleton';
import { Text } from '../ui/text';
import { ChangePill } from './change-pill';
import { PriceFlash } from './price-flash';
import { Sparkline } from './sparkline';
import { StarButton } from './star-button';
import { StockAvatar } from './stock-avatar';

export interface StockRowProps {
  stock: StockWithQuote;
  watched?: boolean;
  onToggleWatch?: (symbol: string, watched: boolean) => void;
  stale?: boolean;
}

// Each row subscribes to its own quote, so a tick re-renders only the row whose price changed.
export const StockRow = memo(function StockRow({
  stock,
  watched = false,
  onToggleWatch,
  stale = false,
}: StockRowProps) {
  const quote = useQuote(stock.symbol) ?? stock.quote;
  const largeText = useLargeText();
  const pct = changePct(quote);
  const withStar = onToggleWatch !== undefined;
  const toggle = () => onToggleWatch?.(stock.symbol, watched);
  // Rows without a star column use the wider Watchlist grid (M-Watchlist).
  const sparkline = withStar ? layout.stockRow.sparkline : layout.stockRow.sparklineWide;

  const price = (
    <View
      className={cx(
        'items-end gap-1',
        !largeText && (withStar ? 'w-price-col' : 'w-price-col-wide'),
      )}
    >
      <PriceFlash price={quote.price} format={formatListPrice} muted={stale} />
      <View className={stale ? 'opacity-70' : undefined}>
        <ChangePill value={pct} label={formatPct(pct)} />
      </View>
    </View>
  );

  return (
    <Link href={`/stock/${stock.symbol}`} asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={formatStockLabel({
          symbol: stock.symbol,
          name: stock.name,
          quote,
          watched,
        })}
        accessibilityActions={
          withStar
            ? [
                {
                  name: 'toggleWatch',
                  label: watched ? 'Remove from watchlist' : 'Add to watchlist',
                },
              ]
            : undefined
        }
        onAccessibilityAction={toggle}
        className={cx(
          'min-h-16 flex-row items-center pl-4 active:bg-surface-3',
          withStar ? 'gap-2.5 py-2 pr-1.5' : 'gap-3 py-2.5 pr-4',
        )}
      >
        <StockAvatar symbol={stock.symbol} sector={stock.sector} />
        <View className="min-w-0 flex-1">
          <Text variant="symbol">{stock.symbol}</Text>
          <Text variant="sm" numberOfLines={1} className="text-fg-3">
            {stock.name}
          </Text>
          {largeText ? <View className="mt-1.5 flex-row justify-between">{price}</View> : null}
        </View>
        {largeText ? null : (
          <>
            <Sparkline
              values={stock.sparkline}
              direction={direction(pct)}
              width={sparkline.width}
              height={sparkline.height}
            />
            {price}
          </>
        )}
        {withStar ? (
          <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            <StarButton symbol={stock.symbol} watched={watched} size={36} onToggle={toggle} />
          </View>
        ) : null}
      </Pressable>
    </Link>
  );
});

export function StockRowSkeleton() {
  return (
    <View
      testID="stock-row-skeleton"
      className="min-h-16 flex-row items-center gap-2.5 py-2 pl-4 pr-4"
    >
      <Skeleton className="h-10 w-10 rounded-control-lg" />
      <View className="flex-1 gap-1.5">
        <Skeleton className="h-3.5 w-14" />
        <Skeleton className="h-3 w-28" />
      </View>
      <Skeleton
        className="opacity-60"
        style={{ width: layout.stockRow.sparkline.width, height: layout.stockRow.sparkline.height }}
      />
      <View className="w-price-col items-end gap-1.5">
        <Skeleton className="h-3.5 w-16" />
        <Skeleton className="h-pill-sm w-pill-sm-min" />
      </View>
    </View>
  );
}

export function StockListSkeleton({ rows }: { rows: number }) {
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel="Loading stocks">
      {Array.from({ length: rows }, (_, i) => (
        <StockRowSkeleton key={i} />
      ))}
    </View>
  );
}
