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
import { useCopy } from '../../lib/i18n';
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
  const { t, dir } = useCopy();
  const rtl = dir === 'rtl';
  const action = () => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t.watchlist.removeSymbol({ symbol: stock.symbol })}
      onPress={() => {
        onRemove(stock.symbol);
      }}
      style={{ direction: dir }}
      className="w-24 items-center justify-center gap-1 bg-danger"
    >
      <Trash2 size={20} color={colors['on-brand']} />
      <Text variant="caption" weight={600} className="text-on-brand">
        {t.watchlist.remove}
      </Text>
    </Pressable>
  );
  // The swipeable lays out in physical LTR, so the action goes on whichever side is trailing.
  const trailing = rtl
    ? { renderLeftActions: action, leftThreshold: 48, overshootLeft: false }
    : { renderRightActions: action, rightThreshold: 48, overshootRight: false };
  return (
    <View style={{ direction: 'ltr' }}>
      <ReanimatedSwipeable
        friction={2}
        {...trailing}
        onSwipeableOpen={(direction) => {
          if (direction === (rtl ? SwipeDirection.RIGHT : SwipeDirection.LEFT)) {
            onRemove(stock.symbol);
          }
        }}
      >
        <View style={{ direction: dir }} className="border-b border-border bg-bg">
          <StockRow stock={stock} stale={stale} onRemove={onRemove} />
        </View>
      </ReanimatedSwipeable>
    </View>
  );
}

// A guest's stars live on this device until they sign up.
function GuestNote({ onSignUp }: { onSignUp: () => void }) {
  const { t } = useCopy();
  return (
    <Pressable
      accessibilityRole="link"
      onPress={onSignUp}
      className="min-h-11 items-center justify-center px-5 pb-4"
    >
      <Text variant="caption" weight={600} className="text-center text-brand-fg">
        {t.watchlist.guestNote}
      </Text>
    </Pressable>
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
  const { t, f } = useCopy();
  return (
    <View className="flex-row items-center justify-between pb-2 pe-3 ps-5">
      <View className="flex-row items-center gap-1">
        <Text variant="sm" className="text-fg-2">
          {t.watchlist.count(f.count(count))}
        </Text>
        {average === null ? null : (
          <>
            <Text variant="sm" className="text-fg-2">
              ·
            </Text>
            <ChangePill value={average} label={formatPct(f, average)} variant="inline" />
            <Text variant="sm" className="text-fg-2">
              {t.watchlist.avgToday}
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
  const { t } = useCopy();
  const { rows, average, stale, isLoading, isError, sort, isGuest, removed, actions } =
    useWatchlistScreen();
  const guestNote = isGuest ? <GuestNote onSignUp={actions.signUp} /> : null;

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-bg">
      <ScreenHeader title={t.watchlist.title} />
      <AppBanners />

      {isLoading ? (
        <StockListSkeleton rows={4} />
      ) : isError ? (
        <StateView
          icon={AlertTriangle}
          tone="neg"
          title={t.watchlist.loadError}
          description={t.watchlist.loadErrorBody}
          action={
            <Button variant="secondary" onPress={actions.retry}>
              {t.common.retry}
            </Button>
          }
        />
      ) : rows.length === 0 ? (
        <>
          <EmptyWatchlist
            onBrowse={() => {
              router.navigate('/markets');
            }}
          />
          {guestNote}
        </>
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
              {t.watchlist.swipeHint}
            </Text>
          </View>
          {guestNote}
        </ScrollView>
      )}

      {removed ? (
        <Snackbar
          message={t.watchlist.removed({ symbol: removed })}
          actionLabel={t.common.undo}
          onAction={actions.undo}
          onDismiss={actions.dismissUndo}
        />
      ) : null}
    </SafeAreaView>
  );
}
