import { Link } from 'expo-router';
import { memo } from 'react';
import { Pressable, View } from 'react-native';

import { type StockWithQuote } from '@sarwa/contracts';
import { changePct, direction, formatPct, formatPrice, useQuote } from '@sarwa/core';

import { cx } from '../../lib/theme';
import { Text } from '../ui/text';
import { ChangePill } from './change';
import { PriceFlash } from './price-flash';
import { Sparkline } from './sparkline';
import { StarButton } from './star-button';
import { StockAvatar } from './stock-avatar';

export interface StockRowProps {
  stock: StockWithQuote;
  watched?: boolean;
  onToggleWatch?: (symbol: string, watched: boolean) => void;
}

// Each row subscribes to its own quote, so a tick re-renders only the row whose price changed.
export const StockRow = memo(function StockRow({ stock, watched, onToggleWatch }: StockRowProps) {
  const quote = useQuote(stock.symbol) ?? stock.quote;
  const pct = changePct(quote);
  const withStar = onToggleWatch !== undefined;

  return (
    <Link href={`/stock/${stock.symbol}`} asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${stock.symbol}, ${stock.name}, ${formatPrice(quote.price)}, ${formatPct(pct)} today`}
        className={cx(
          'min-h-16 flex-row items-center gap-2.5 py-2 pl-4 active:bg-surface-3',
          withStar ? 'pr-1.5' : 'pr-4',
        )}
      >
        <StockAvatar symbol={stock.symbol} sector={stock.sector} />
        <View className="min-w-0 flex-1">
          <Text variant="body" style={{ fontFamily: 'Inter_700Bold' }}>
            {stock.symbol}
          </Text>
          <Text variant="sm" numberOfLines={1} className="text-fg-3">
            {stock.name}
          </Text>
        </View>
        <Sparkline values={stock.sparkline} direction={direction(pct)} />
        <View className="w-[92px] items-end gap-1">
          <PriceFlash price={quote.price} />
          <ChangePill value={pct} label={formatPct(pct)} />
        </View>
        {withStar ? (
          <StarButton
            symbol={stock.symbol}
            watched={watched ?? false}
            size={36}
            onToggle={() => {
              onToggleWatch(stock.symbol, watched ?? false);
            }}
          />
        ) : null}
      </Pressable>
    </Link>
  );
});

export function StockRowSkeleton() {
  return (
    <View className="min-h-16 flex-row items-center gap-2.5 py-2 pl-4 pr-4">
      <View className="h-10 w-10 rounded-[12px] bg-surface-3" />
      <View className="flex-1 gap-1.5">
        <View className="h-3.5 w-14 rounded-sm bg-surface-3" />
        <View className="h-3 w-28 rounded-sm bg-surface-3" />
      </View>
      <View className="w-[92px] items-end gap-1.5">
        <View className="h-3.5 w-16 rounded-sm bg-surface-3" />
        <View className="h-[22px] w-[68px] rounded-sm bg-surface-3" />
      </View>
    </View>
  );
}
