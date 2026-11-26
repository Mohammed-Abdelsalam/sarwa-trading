import { router } from 'expo-router';
import { AlertTriangle, Hand, Trash2 } from 'lucide-react-native';
import { Pressable, ScrollView, View } from 'react-native';
import ReanimatedSwipeable, {
  SwipeDirection,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import { SafeAreaView } from 'react-native-safe-area-context';

import { type StockWithQuote } from '@sarwa/contracts';
import { formatPct } from '@sarwa/core';

import { AppBanners } from '../../components/layout/app-banners';
import { ScreenHeader } from '../../components/layout/screen-header';
import { ChangeText } from '../../components/trading/change';
import { StockListSkeleton, StockRow } from '../../components/trading/stock-row';
import { Button } from '../../components/ui/button';
import { StateView } from '../../components/ui/state-view';
import { Text } from '../../components/ui/text';
import { useColors } from '../../lib/theme';
import { EmptyWatchlist } from './empty-watchlist';
import { useWatchlistScreen } from './use-watchlist-screen';

function SwipeToRemoveRow({
  stock,
  onRemove,
}: {
  stock: StockWithQuote;
  onRemove: (symbol: string) => void;
}) {
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
          <Trash2 size={20} color="#FFFFFF" />
          <Text variant="caption" className="text-white">
            Remove
          </Text>
        </Pressable>
      )}
    >
      <View className="border-b border-border bg-bg">
        <StockRow stock={stock} />
      </View>
    </ReanimatedSwipeable>
  );
}

function WatchlistSummary({ count, average }: { count: number; average: number | null }) {
  return (
    <View className="flex-row items-center gap-1 px-5 pb-4">
      <Text variant="sm" className="text-fg-2">
        {count} {count === 1 ? 'stock' : 'stocks'}
      </Text>
      {average === null ? null : (
        <>
          <Text variant="sm" className="text-fg-2">
            ·
          </Text>
          <ChangeText value={average} label={formatPct(average)} />
          <Text variant="sm" className="text-fg-2">
            avg today
          </Text>
        </>
      )}
    </View>
  );
}

export function WatchlistScreen() {
  const colors = useColors();
  const { rows, average, isLoading, isError, retry, remove } = useWatchlistScreen();

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
          action={<Button label="Retry" variant="secondary" onPress={retry} />}
        />
      ) : rows.length === 0 ? (
        <EmptyWatchlist
          onBrowse={() => {
            router.navigate('/');
          }}
        />
      ) : (
        <ScrollView>
          <WatchlistSummary count={rows.length} average={average} />
          <View className="border-t border-border">
            {rows.map((stock) => (
              <SwipeToRemoveRow key={stock.symbol} stock={stock} onRemove={remove} />
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
    </SafeAreaView>
  );
}
