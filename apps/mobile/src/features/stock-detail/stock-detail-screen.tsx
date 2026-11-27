import { AlertTriangle } from 'lucide-react-native';
import { RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { type Stock } from '@sarwa/contracts';

import { StockAvatar } from '../../components/trading/stock-avatar';
import { TradeBar } from '../../components/trading/trade-bar';
import { Button } from '../../components/ui/button';
import { Skeleton } from '../../components/ui/skeleton';
import { StateView } from '../../components/ui/state-view';
import { Text } from '../../components/ui/text';
import { useCopy } from '../../lib/i18n';
import { useColors } from '../../lib/theme';
import { ChartToolbar } from './chart-toolbar';
import { KeyStats } from './key-stats';
import { PriceChart, ChartSkeleton } from './price-chart';
import { PriceHeader } from './price-header';
import { RangeCard } from './range-card';
import { RemovedStock } from './removed-stock';
import { SimilarStocks } from './similar-stocks';
import { TopBar } from './top-bar';
import { useStockDetailScreen } from './use-stock-detail-screen';

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

export function StockDetailScreen({ symbol }: { symbol: string }) {
  const colors = useColors();
  const { t } = useCopy();
  const screen = useStockDetailScreen(symbol);
  const { chart, actions } = screen;

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-bg">
      <TopBar
        symbol={symbol}
        status={screen.status}
        watched={screen.watched}
        onToggleWatch={actions.toggleWatch}
        onShare={actions.share}
      />

      {screen.notFound ? (
        <RemovedStock symbol={symbol} watched={screen.watched} onRemove={actions.toggleWatch} />
      ) : screen.isError ? (
        <StateView
          icon={AlertTriangle}
          tone="neg"
          title={t.stock.loadError({ symbol })}
          description={t.common.loadErrorBody}
          action={
            <Button variant="secondary" onPress={actions.retry}>
              {t.common.retry}
            </Button>
          }
        />
      ) : (
        <ScrollView
          testID="stock-detail-scroll"
          contentContainerClassName="pb-10"
          refreshControl={
            <RefreshControl
              refreshing={screen.isRefreshing}
              onRefresh={() => void actions.refresh()}
              tintColor={colors['brand-fg']}
              title={t.markets.updating}
              titleColor={colors['fg-3']}
            />
          }
        >
          <StockTitle symbol={symbol} stock={screen.stock} />
          <PriceHeader
            quote={screen.quote}
            scrubbed={chart.scrubbed}
            period={chart.period}
            type={chart.type}
          />
          {chart.isLoaded ? (
            <PriceChart
              symbol={symbol}
              period={chart.period}
              type={chart.type}
              onScrub={actions.scrub}
              footer={(change) => (
                <ChartToolbar
                  period={chart.period}
                  enabledPeriods={chart.enabledPeriods}
                  onPeriodChange={actions.setPeriod}
                  type={chart.type}
                  onTypeChange={actions.setChartType}
                  change={chart.period === '1D' || chart.scrubbed ? null : change}
                />
              )}
            />
          ) : (
            <ChartSkeleton />
          )}
          {screen.stats ? <KeyStats stats={screen.stats} /> : null}
          {screen.week52 ? <RangeCard {...screen.week52} /> : null}
          <SimilarStocks
            title={
              screen.sectorLabel
                ? t.stock.moreIn({ sector: screen.sectorLabel })
                : t.stock.moreInSector
            }
            stocks={screen.similar}
          />
        </ScrollView>
      )}
      {screen.notFound || screen.isError ? null : (
        <TradeBar symbol={symbol} sellLabel={screen.sellLabel} />
      )}
    </SafeAreaView>
  );
}
