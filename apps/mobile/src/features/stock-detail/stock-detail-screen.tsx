import { router } from 'expo-router';
import { AlertTriangle, Ban, ChevronLeft, Star } from 'lucide-react-native';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { type Period, type Quote, type Stock } from '@sarwa/contracts';
import {
  change,
  changePct,
  formatCandleDate,
  formatChange,
  formatMarketTime,
  formatPct,
  formatPrice,
  formatQuoteLabel,
  type LiveStatus,
} from '@sarwa/core';

import { ChangePill } from '../../components/trading/change-pill';
import { ConnectionBadge } from '../../components/trading/connection-badge';
import { PeriodTabs } from '../../components/trading/period-tabs';
import { PriceFlash } from '../../components/trading/price-flash';
import { StarButton } from '../../components/trading/star-button';
import { StockAvatar } from '../../components/trading/stock-avatar';
import { Button } from '../../components/ui/button';
import { IconButton } from '../../components/ui/icon-button';
import { Skeleton } from '../../components/ui/skeleton';
import { StateView } from '../../components/ui/state-view';
import { Text } from '../../components/ui/text';
import { useColors } from '../../lib/theme';
import { KeyStats } from './key-stats';
import { PriceChart } from './price-chart';
import { type ScrubPoint } from './use-price-chart';
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
  return (
    <View className="flex-row items-center justify-between px-2 pb-1">
      <IconButton
        label="Back"
        icon={ChevronLeft}
        iconSize={24}
        size={44}
        onPress={() => {
          router.back();
        }}
      />
      <ConnectionBadge status={status} />
      <StarButton symbol={symbol} watched={watched} onToggle={onToggleWatch} />
    </View>
  );
}

function StockTitle({ symbol, stock }: { symbol: string; stock: Stock | undefined }) {
  return (
    <View className="flex-row items-center gap-3 px-5 pt-1.5">
      {stock ? (
        <StockAvatar symbol={symbol} sector={stock.sector} />
      ) : (
        <Skeleton className="h-10 w-10 rounded-control-lg" />
      )}
      <View className="flex-1">
        <View className="flex-row items-center gap-2">
          <Text variant="h2" accessibilityRole="header">
            {symbol}
          </Text>
          {stock ? (
            <View className="h-badge justify-center rounded-sm bg-flat-subtle px-2">
              <Text variant="caption" weight={600} className="text-fg-2">
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
  scrubbed: ScrubPoint | null;
  period: Period;
}) {
  return (
    <View className="min-h-24 gap-1.5 px-5 pb-1.5 pt-3.5">
      {scrubbed ? (
        <>
          <Text variant="display">{formatPrice(scrubbed.candle.c)}</Text>
          <View className="flex-row gap-1">
            <ChangePill
              value={scrubbed.changePct}
              label={formatPct(scrubbed.changePct)}
              variant="inline"
            />
            <Text variant="sm" className="text-fg-3">
              · {formatCandleDate(scrubbed.candle.t, period)}
            </Text>
          </View>
        </>
      ) : quote ? (
        // No live region: the price ticks several times a second and would never stop being read.
        <View accessible accessibilityLabel={formatQuoteLabel(quote)} className="gap-1.5">
          <View className="self-start">
            <PriceFlash price={quote.price} size="display" />
          </View>
          <View className="flex-row gap-1">
            <ChangePill
              value={change(quote)}
              label={`${formatChange(change(quote))} (${formatPct(changePct(quote))})`}
              variant="inline"
            />
            <Text variant="sm" className="text-fg-3">
              · Today · {formatMarketTime(quote.ts)}
            </Text>
          </View>
        </View>
      ) : (
        <Skeleton className="h-12 w-48" />
      )}
    </View>
  );
}

// Deep link to a stock that was disabled or removed (X-A11y): explain it instead of a generic 404.
function RemovedStock({
  symbol,
  watched,
  onRemove,
}: {
  symbol: string;
  watched: boolean;
  onRemove: () => void;
}) {
  const colors = useColors();
  return (
    <View className="flex-1 items-center justify-center gap-4 px-9 pb-24">
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View className="h-art w-art items-center justify-center rounded-art border border-border bg-surface">
          <Text variant="avatar-lg" className="text-fg-2">
            {symbol.charAt(0)}
          </Text>
        </View>
        <View className="absolute -bottom-1 -right-1 h-9 w-9 items-center justify-center rounded-full bg-neg">
          <Ban size={16} color={colors['on-brand']} />
        </View>
      </View>
      <Text variant="mono" className="text-fg-3">
        stock/{symbol}
      </Text>
      <Text variant="h2" className="text-center">
        This stock is no longer available
      </Text>
      <Text className="text-center text-fg-2">
        {`${symbol} was removed from Mini Trading. You opened an old link — prices for it are no longer streaming.`}
      </Text>
      <View className="mt-2 w-full gap-2.5">
        <Button
          size="lg"
          onPress={() => {
            router.navigate('/');
          }}
        >
          Back to Markets
        </Button>
        {watched ? (
          <Button
            size="lg"
            variant="secondary"
            icon={<Star size={16} color={colors.fg} />}
            onPress={onRemove}
          >
            Remove from Watchlist
          </Button>
        ) : null}
      </View>
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
        <RemovedStock symbol={symbol} watched={watched} onRemove={actions.toggleWatch} />
      ) : isError ? (
        <StateView
          icon={AlertTriangle}
          tone="neg"
          title={`Couldn't load ${symbol}`}
          description="Check your connection and try again."
          action={
            <Button variant="secondary" onPress={actions.retry}>
              Retry
            </Button>
          }
        />
      ) : (
        <ScrollView contentContainerClassName="pb-10">
          <StockTitle symbol={symbol} stock={stock} />
          <PriceHeader quote={quote} scrubbed={chart.scrubbed} period={chart.period} />
          <PriceChart symbol={symbol} period={chart.period} onScrub={actions.scrub} />
          <View className="px-5 pb-3 pt-3.5">
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
