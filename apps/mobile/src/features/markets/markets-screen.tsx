import { FlashList, type ViewToken } from '@shopify/flash-list';
import { RefreshCw, Search, WifiOff } from 'lucide-react-native';
import { RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { type StockWithQuote } from '@sarwa/contracts';

import { AppBanners } from '../../components/layout/app-banners';
import { ScreenHeader } from '../../components/layout/screen-header';
import { StockListSkeleton, StockRow } from '../../components/trading/stock-row';
import { Button } from '../../components/ui/button';
import { StateView } from '../../components/ui/state-view';
import { useColors } from '../../lib/theme';
import { ListMeta, SearchField, SectorChips } from './markets-toolbar';
import { useMarketsScreen } from './use-markets-screen';

const VIEWABILITY = { itemVisiblePercentThreshold: 10 };

export function MarketsScreen() {
  const colors = useColors();
  const { rows, watched, stale, isLoading, isError, isRefreshing, filters, actions } =
    useMarketsScreen();

  const onViewableItemsChanged = ({
    viewableItems,
  }: {
    viewableItems: ViewToken<StockWithQuote>[];
  }) => {
    actions.setVisibleSymbols(viewableItems.map((token) => token.item.symbol));
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-bg">
      <ScreenHeader title="Markets" />
      <AppBanners />
      <SearchField
        value={filters.query}
        onChange={actions.setQuery}
        disabled={filters.searchDisabled}
      />
      <SectorChips value={filters.sector} onChange={actions.setSector} />
      <ListMeta count={rows.length} sort={filters.sort} onCycleSort={actions.cycleSort} />

      {isLoading ? (
        <StockListSkeleton rows={8} />
      ) : isError ? (
        <StateView
          icon={WifiOff}
          tone="neg"
          title="Couldn't load markets"
          description="We couldn't reach the price server. Check your connection — we'll keep trying in the background."
          action={
            <Button
              size="lg"
              icon={<RefreshCw size={16} color={colors['on-brand']} />}
              onPress={actions.refresh}
            >
              Retry
            </Button>
          }
        />
      ) : (
        <FlashList
          data={rows}
          keyExtractor={(item) => item.symbol}
          extraData={watched}
          renderItem={({ item }) => (
            <StockRow
              stock={item}
              watched={watched.has(item.symbol)}
              onToggleWatch={actions.toggleWatch}
              stale={stale}
            />
          )}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={VIEWABILITY}
          keyboardDismissMode="on-drag"
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={actions.refresh}
              tintColor={colors['brand-fg']}
              title="Updating prices…"
              titleColor={colors['fg-3']}
            />
          }
          ListEmptyComponent={
            <StateView
              icon={Search}
              title={`No matches for “${filters.searchedQuery}”`}
              description={`Try a ticker like AAPL or a company name like “Netflix”. Sector filter: ${filters.sectorLabel}.`}
              action={
                <Button variant="secondary" onPress={actions.clearFilters}>
                  Clear search
                </Button>
              }
            />
          }
        />
      )}
    </SafeAreaView>
  );
}
