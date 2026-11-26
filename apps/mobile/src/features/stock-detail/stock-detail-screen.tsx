import { router } from 'expo-router';
import { AlertTriangle, ChevronLeft, SearchX } from 'lucide-react-native';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { type Candle, type Period, type Quote, type Stock } from '@sarwa/contracts';
import {
  change,
  changePct,
  formatCandleTime,
  formatChange,
  formatPct,
  formatPrice,
  formatQuoteLabel,
  type LiveStatus,
} from '@sarwa/core';

import { ChangeText } from '../../components/trading/change';
import { ConnectionBadge } from '../../components/trading/connection-badge';
import { PeriodTabs } from '../../components/trading/period-tabs';
import { PriceFlash } from '../../components/trading/price-flash';
import { StarButton } from '../../components/trading/star-button';
import { StockAvatar } from '../../components/trading/stock-avatar';
import { Button } from '../../components/ui/button';
import { Skeleton } from '../../components/ui/skeleton';
import { StateView } from '../../components/ui/state-view';
import { Text } from '../../components/ui/text';
import { useColors } from '../../lib/theme';
import { KeyStats } from './key-stats';
import { PriceChart } from './price-chart';
import { useStockDetailScreen } from './use-stock-detail-screen';

function TopBar({
  symbol,
  status,
  watched,
  onToggleWatch,
}: {
  symbol: string;
  status: LiveStatus;
  watched: boolean;
  onToggleWatch: () => void;
}) {
  const colors = useColors();
  return (
    <View className="flex-row items-center justify-between px-2 pb-1">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={() => {
          router.back();
        }}
        className="h-11 w-11 items-center justify-center rounded-[12px] active:bg-surface-3"
      >
        <ChevronLeft size={24} color={colors['fg-2']} />
      </Pressable>
      <ConnectionBadge status={status} />
      <StarButton symbol={symbol} watched={watched} onToggle={onToggleWatch} />
    </View>
  );
}

function StockTitle({ symbol, stock }: { symbol: string; stock: Stock | undefined }) {
  return (
    <View className="flex-row items-center gap-3 px-5 pt-2">
      {stock ? (
        <StockAvatar symbol={symbol} sector={stock.sector} size={56} />
      ) : (
        <Skeleton className="h-14 w-14 rounded-[16px]" />
      )}
      <View className="flex-1">
        <View className="flex-row items-center gap-2">
          <Text variant="h2" accessibilityRole="header">
            {symbol}
          </Text>
          {stock ? (
            <View className="h-[22px] justify-center rounded-sm bg-flat-subtle px-2">
              <Text variant="caption" className="text-fg-2">
                {stock.exchange}
              </Text>
            </View>
          ) : null}
        </View>
        <Text variant="sm" className="text-fg-2">
          {stock?.name ?? ' '}
        </Text>
      </View>
    </View>
  );
}

function PriceHeader({
  quote,
  scrubbed,
  period,
}: {
  quote: Quote | undefined;
  scrubbed: Candle | null;
  period: Period;
}) {
  return (
    <View className="gap-1 px-5 pb-3 pt-4">
      {scrubbed ? (
        <>
          <Text variant="display">{formatPrice(scrubbed.c)}</Text>
          <Text variant="sm" className="text-fg-3">
            {formatCandleTime(scrubbed.t, period)}
          </Text>
        </>
      ) : quote ? (
        // No live region: the price ticks several times a second and would never stop being read.
        <View accessible accessibilityLabel={formatQuoteLabel(quote)} className="gap-1">
          <View className="self-start">
            <PriceFlash price={quote.price} variant="display" />
          </View>
          <View className="flex-row gap-1">
            <ChangeText
              value={change(quote)}
              label={`${formatChange(change(quote))} (${formatPct(changePct(quote))})`}
            />
            <Text variant="sm" className="text-fg-3">
              · Today
            </Text>
          </View>
        </View>
      ) : (
        <Skeleton className="h-12 w-48" />
      )}
    </View>
  );
}

export function StockDetailScreen({ symbol }: { symbol: string }) {
  const { stock, quote, stats, status, watched, notFound, isError, chart, actions } =
    useStockDetailScreen(symbol);

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-bg">
      <TopBar
        symbol={symbol}
        status={status}
        watched={watched}
        onToggleWatch={actions.toggleWatch}
      />

      {notFound ? (
        <StateView
          icon={SearchX}
          title="Stock not found"
          description={`${symbol} isn't listed or has been disabled.`}
          action={
            <Button
              label="Back to Markets"
              variant="secondary"
              onPress={() => {
                router.navigate('/');
              }}
            />
          }
        />
      ) : isError ? (
        <StateView
          icon={AlertTriangle}
          tone="neg"
          title={`Couldn't load ${symbol}`}
          description="Check your connection and try again."
          action={<Button label="Retry" variant="secondary" onPress={actions.retry} />}
        />
      ) : (
        <ScrollView contentContainerClassName="pb-10">
          <StockTitle symbol={symbol} stock={stock} />
          <PriceHeader quote={quote} scrubbed={chart.scrubbed} period={chart.period} />
          <PriceChart symbol={symbol} period={chart.period} onScrub={actions.scrub} />
          <View className="px-5 pt-4">
            <PeriodTabs
              value={chart.period}
              onChange={actions.setPeriod}
              enabled={chart.enabledPeriods}
            />
          </View>
          {stats ? <KeyStats stats={stats} /> : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
