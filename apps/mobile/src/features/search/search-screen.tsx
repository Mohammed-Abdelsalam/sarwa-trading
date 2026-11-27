import { Clock, Search, TrendingUp } from 'lucide-react-native';
import { type ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { type Sector } from '@sarwa/contracts';

import { TopBar } from '../../components/layout/top-bar';
import { StockAvatar } from '../../components/trading/stock-avatar';
import { StateView } from '../../components/ui/state-view';
import { Text } from '../../components/ui/text';
import { useCopy } from '../../lib/i18n';
import { useColors } from '../../lib/theme';
import { SearchField } from '../markets/markets-toolbar';
import { useSearchScreen } from './use-search-screen';

function ResultRow({
  stock,
  onPress,
}: {
  stock: { symbol: string; name: string; sector?: Sector };
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${stock.symbol}, ${stock.name}`}
      onPress={onPress}
      className="min-h-14 flex-row items-center gap-3 px-5 py-2 active:bg-surface-3"
    >
      <StockAvatar symbol={stock.symbol} sector={stock.sector} size={32} />
      <View className="flex-1">
        <Text variant="symbol">{stock.symbol}</Text>
        {stock.name ? (
          <Text variant="caption" className="text-fg-3" numberOfLines={1}>
            {stock.name}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function SectionTitle({
  icon: Icon,
  title,
  action,
}: {
  icon: typeof Clock;
  title: string;
  action?: ReactNode;
}) {
  const colors = useColors();
  return (
    <View className="min-h-11 flex-row items-center gap-2 pe-3 ps-5 pt-2">
      <Icon size={14} color={colors['fg-3']} />
      <Text variant="overline" accessibilityRole="header" className="flex-1 text-fg-3">
        {title}
      </Text>
      {action}
    </View>
  );
}

export function SearchScreen({ purpose }: { purpose?: string }) {
  const { t } = useCopy();
  const screen = useSearchScreen(purpose);
  const { actions } = screen;

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-bg">
      <TopBar title={t.search.title} />
      <SearchField
        value={screen.query}
        onChange={actions.setQuery}
        placeholder={t.search.placeholder}
        label={t.search.title}
      />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="pb-10">
        {screen.searched ? (
          screen.results.length === 0 ? (
            <StateView icon={Search} title={t.search.noMatches({ query: screen.searched })} />
          ) : (
            screen.results.map((stock) => (
              <ResultRow
                key={stock.symbol}
                stock={stock}
                onPress={() => {
                  actions.select(stock.symbol);
                }}
              />
            ))
          )
        ) : (
          <>
            {screen.recent.length > 0 ? (
              <>
                <SectionTitle
                  icon={Clock}
                  title={t.search.recent}
                  action={
                    <Pressable
                      accessibilityRole="button"
                      onPress={actions.clearRecent}
                      className="min-h-11 justify-center px-2"
                    >
                      <Text variant="sm" weight={600} className="text-brand-fg">
                        {t.search.clearRecent}
                      </Text>
                    </Pressable>
                  }
                />
                {screen.recent.map((stock) => (
                  <ResultRow
                    key={stock.symbol}
                    stock={stock}
                    onPress={() => {
                      actions.select(stock.symbol);
                    }}
                  />
                ))}
              </>
            ) : null}
            <SectionTitle icon={TrendingUp} title={t.search.trending} />
            {screen.trending.map((stock) => (
              <ResultRow
                key={stock.symbol}
                stock={stock}
                onPress={() => {
                  actions.select(stock.symbol);
                }}
              />
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
