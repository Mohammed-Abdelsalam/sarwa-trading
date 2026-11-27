import { BellRing, ListChecks, Search } from 'lucide-react-native';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppBanners } from '../../components/layout/app-banners';
import { Loading, LoadError } from '../../components/layout/load-state';
import { MarketStatusPill } from '../../components/trading/market-status-pill';
import { StockRow } from '../../components/trading/stock-row';
import { Badge } from '../../components/ui/badge';
import { IconButton } from '../../components/ui/icon-button';
import { Segmented } from '../../components/ui/segmented';
import { Text } from '../../components/ui/text';
import { useCopy } from '../../lib/i18n';
import { OrderRow } from '../orders/order-row';
import { BellButton, EquityCard, ShortcutCard } from './home-parts';
import { type MoverTab, useHomeScreen } from './use-home-screen';

export function HomeScreen() {
  const { t, m } = useCopy();
  const screen = useHomeScreen();
  const { actions } = screen;
  const moverTabs: { value: MoverTab; label: string }[] = [
    { value: 'gainers', label: t.portfolio.gainers },
    { value: 'losers', label: t.portfolio.losers },
    { value: 'active', label: t.portfolio.active },
  ];

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-bg">
      <View className="flex-row items-center justify-between pb-2 pe-3 ps-5">
        <View>
          <Text variant="caption" className="text-fg-3">
            {screen.greeting}
          </Text>
          <Text variant="h1" accessibilityRole="header">
            {t.nav.home}
          </Text>
        </View>
        <View className="flex-row items-center">
          <IconButton label={t.search.title} icon={Search} size={44} onPress={actions.openSearch} />
          <BellButton
            count={screen.unread}
            badge={screen.unreadBadge}
            label={screen.bellLabel}
            onPress={actions.openNotifications}
          />
        </View>
      </View>
      <View className="flex-row flex-wrap items-center gap-2 px-5 pb-3">
        <MarketStatusPill pill={screen.market} />
        <Badge label={t.paper.badge} tone="outline" />
      </View>
      <AppBanners />

      <ScrollView contentContainerClassName="pb-10">
        <View className="px-4">
          {screen.isLoading ? (
            <Loading />
          ) : screen.isError || !screen.equity ? (
            <LoadError onRetry={actions.retry} />
          ) : (
            <EquityCard equity={screen.equity} curve={screen.curve} />
          )}
        </View>

        <View className="flex-row gap-2.5 px-4 pt-3">
          <ShortcutCard
            icon={ListChecks}
            title={t.portfolio.openOrders}
            value={screen.openOrders}
            onPress={actions.openOrders}
          />
          <ShortcutCard
            icon={BellRing}
            title={t.nav.alerts}
            value={screen.activeAlerts}
            onPress={actions.openAlerts}
          />
        </View>

        <View className="flex-row flex-wrap items-center justify-between gap-2 px-5 pb-1 pt-4">
          <Text variant="h3" accessibilityRole="header">
            {t.portfolio.topMovers}
          </Text>
          <Segmented
            size="sm"
            label={t.portfolio.topMovers}
            options={moverTabs}
            value={screen.moverTab}
            onChange={actions.setMoverTab}
          />
        </View>
        {screen.movers.map((stock) => (
          <StockRow key={stock.symbol} stock={stock} />
        ))}

        <View className="flex-row items-center justify-between pb-1 pe-3 ps-5 pt-4">
          <Text variant="h3" accessibilityRole="header">
            {t.portfolio.recentActivity}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={actions.openOrders}
            className="min-h-11 justify-center rounded-control-sm px-2 active:bg-surface-3"
          >
            <Text variant="sm" weight={600} className="text-brand-fg">
              {m.viewAll}
            </Text>
          </Pressable>
        </View>
        {screen.recent.length === 0 ? (
          <Text variant="sm" className="px-5 py-3 text-fg-3">
            {m.noActivity}
          </Text>
        ) : (
          screen.recent.map((row) => (
            <OrderRow key={row.line.id} order={row.line} sector={row.sector} />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
