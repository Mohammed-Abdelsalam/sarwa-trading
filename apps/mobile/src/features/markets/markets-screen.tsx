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
import { useCopy } from '../../lib/i18n';
import { useColors } from '../../lib/theme';
import { ListMeta, SearchField, SectorChips } from './markets-toolbar';
import { useMarketsScreen } from './use-markets-screen';

const VIEWABILITY = { itemVisiblePercentThreshold: 10 };

export function MarketsScreen() {
  const colors = useColors();
  const { t } = useCopy();
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
      <ScreenHeader title={t.markets.title} />
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
          title={t.markets.loadError}
          description={t.markets.loadErrorBody}
          action={
            <Button
              size="lg"
              icon={<RefreshCw size={16} color={colors['on-brand']} />}
              onPress={actions.refresh}
            >
              {t.common.retry}
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
              title={t.markets.updating}
              titleColor={colors['fg-3']}
            />
          }
          ListEmptyComponent={
            <StateView
              icon={Search}
              title={t.search.noMatches({ query: filters.searchedQuery })}
              description={t.markets.noMatchesBody({ sector: filters.sectorLabel })}
              action={
                <Button variant="secondary" onPress={actions.clearFilters}>
                  {t.markets.clearSearch}
                </Button>
              }
            />
          }
        />
      )}
    </SafeAreaView>
  );
}
