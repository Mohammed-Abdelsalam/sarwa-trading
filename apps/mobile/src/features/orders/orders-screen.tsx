import { ListChecks } from 'lucide-react-native';
import { ActivityIndicator, FlatList, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Empty, Loading, LoadError } from '../../components/layout/load-state';
import { TopBar } from '../../components/layout/top-bar';
import { Tabs } from '../../components/ui/tabs';
import { useCopy } from '../../lib/i18n';
import { useColors } from '../../lib/theme';
import { OrderRow } from './order-row';
import { useOrdersScreen } from './use-orders-screen';

export function OrdersScreen() {
  const colors = useColors();
  const { t } = useCopy();
  const { tab, tabs, rows, isLoading, isError, isRefreshing, isLoadingMore, actions } =
    useOrdersScreen();

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-bg">
      <TopBar title={t.orders.title} />
      <Tabs options={tabs} value={tab} onChange={actions.setTab} />
      {isLoading ? (
        <Loading />
      ) : isError ? (
        <LoadError onRetry={actions.refresh} />
      ) : (
        <FlatList
          testID="orders-list"
          data={rows}
          keyExtractor={(row) => row.line.id}
          renderItem={({ item }) => <OrderRow order={item.line} sector={item.sector} />}
          ListEmptyComponent={<Empty icon={ListChecks} title={t.orders.empty} />}
          ListFooterComponent={
            isLoadingMore ? (
              <ActivityIndicator className="py-4" color={colors['brand-fg']} />
            ) : undefined
          }
          onEndReached={actions.loadMore}
          onEndReachedThreshold={0.5}
          contentContainerClassName="pb-10"
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={actions.refresh}
              tintColor={colors['brand-fg']}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}
