import { router } from 'expo-router';
import { AlertTriangle, Hand, Trash2 } from 'lucide-react-native';
import { Pressable, ScrollView, View } from 'react-native';
import ReanimatedSwipeable, {
  SwipeDirection,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import { SafeAreaView } from 'react-native-safe-area-context';

import { type StockWithQuote } from '@sarwa/contracts';
import { formatPct, type SortOption } from '@sarwa/core';

import { AppBanners } from '../../components/layout/app-banners';
import { ScreenHeader } from '../../components/layout/screen-header';
import { ChangePill } from '../../components/trading/change-pill';
import { SortButton } from '../../components/trading/sort-button';
import { StockListSkeleton, StockRow } from '../../components/trading/stock-row';
import { Button } from '../../components/ui/button';
import { Snackbar } from '../../components/ui/snackbar';
import { StateView } from '../../components/ui/state-view';
import { Text } from '../../components/ui/text';
import { useColors } from '../../lib/theme';
import { EmptyWatchlist } from './empty-watchlist';
import { useWatchlistScreen } from './use-watchlist-screen';

function SwipeToRemoveRow({
  stock,
  stale,
  onRemove,
}: {
  stock: StockWithQuote;
  stale: boolean;
  onRemove: (symbol: string) => void;
}) {
  const colors = useColors();
  return (
    <ReanimatedSwipeable
      friction={2}
      rightThreshold={48}
      overshootRight={false}
      onSwipeableOpen={(direction) => {
        if (direction === SwipeDirection.LEFT) onRemove(stock.symbol);
      }}
      renderRightActions={() => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Remove ${stock.symbol} from watchlist`}
          onPress={() => {
            onRemove(stock.symbol);
          }}
          className="w-24 items-center justify-center gap-1 bg-danger"
        >
          <Trash2 size={20} color={colors['on-brand']} />
          <Text variant="caption" weight={600} className="text-on-brand">
            Remove
          </Text>
        </Pressable>
      )}
    >
      <View className="border-b border-border bg-bg">
        <StockRow stock={stock} stale={stale} />
      </View>
    </ReanimatedSwipeable>
  );
}

function WatchlistSummary({
  count,
  average,
  sort,
  onCycleSort,
}: {
  count: number;
  average: number | null;
  sort: SortOption | null;
  onCycleSort: () => void;
}) {
  return (
    <View className="flex-row items-center justify-between pb-2 pl-5 pr-3">
      <View className="flex-row items-center gap-1">
        <Text variant="sm" className="text-fg-2">
          {count} {count === 1 ? 'stock' : 'stocks'}
        </Text>
        {average === null ? null : (
          <>
            <Text variant="sm" className="text-fg-2">
              ·
            </Text>
            <ChangePill value={average} label={formatPct(average)} variant="inline" />
            <Text variant="sm" className="text-fg-2">
              avg today
            </Text>
          </>
        )}
      </View>
      <SortButton sort={sort} onPress={onCycleSort} />
    </View>
  );
}

export function WatchlistScreen() {
  const colors = useColors();
  const { rows, average, stale, isLoading, isError, sort, removed, actions } = useWatchlistScreen();

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-bg">
      <ScreenHeader title="Watchlist" />
      <AppBanners />

      {isLoading ? (
        <StockListSkeleton rows={4} />
      ) : isError ? (
        <StateView
          icon={AlertTriangle}
          tone="neg"
          title="Couldn't load your watchlist"
          description="We couldn't reach the price server. Check your connection and try again."
          action={
            <Button variant="secondary" onPress={actions.retry}>
              Retry
            </Button>
          }
        />
      ) : rows.length === 0 ? (
        <EmptyWatchlist
          onBrowse={() => {
            router.navigate('/');
          }}
        />
      ) : (
        // ScrollView, not FlashList: a recycled cell would carry one row's open swipe to another stock.
        <ScrollView contentContainerClassName={removed ? 'pb-24' : undefined}>
          <WatchlistSummary
            count={rows.length}
            average={average}
            sort={sort}
            onCycleSort={actions.cycleSort}
          />
          <View className="border-t border-border">
            {rows.map((stock) => (
              <SwipeToRemoveRow
                key={stock.symbol}
                stock={stock}
                stale={stale}
                onRemove={actions.remove}
              />
            ))}
          </View>
          <View className="flex-row items-center gap-2 px-5 py-4">
            <Hand size={16} color={colors['fg-3']} />
            <Text variant="caption" className="text-fg-3">
              Swipe left on a row to remove
            </Text>
          </View>
        </ScrollView>
      )}

      {removed ? (
        <Snackbar
          message={`${removed} removed from Watchlist`}
          actionLabel="Undo"
          onAction={actions.undo}
          onDismiss={actions.dismissUndo}
        />
      ) : null}
    </SafeAreaView>
  );
}
