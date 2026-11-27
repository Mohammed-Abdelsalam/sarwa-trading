import { Briefcase, Info } from 'lucide-react-native';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppBanners } from '../../components/layout/app-banners';
import { Empty, Loading, LoadError } from '../../components/layout/load-state';
import { AllocationBar } from '../../components/trading/allocation-bar';
import { EquityChart } from '../../components/trading/equity-chart';
import { SignedText } from '../../components/trading/signed-text';
import { IconButton } from '../../components/ui/icon-button';
import { Segmented } from '../../components/ui/segmented';
import { Text } from '../../components/ui/text';
import { useCopy } from '../../lib/i18n';
import { PlSheet } from './pl-sheet';
import { PositionRow } from './position-row';
import { usePortfolioScreen } from './use-portfolio-screen';

export function PortfolioScreen() {
  const { t } = useCopy();
  const screen = usePortfolioScreen();
  const { summary, actions } = screen;

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-bg">
      <View className="flex-row items-center justify-between pb-1 pe-3 ps-5 pt-1">
        <Text variant="h1" accessibilityRole="header">
          {t.portfolio.title}
        </Text>
        <IconButton label={t.portfolio.howPlA11y} icon={Info} size={44} onPress={actions.explain} />
      </View>
      <AppBanners />
      {screen.isLoading ? (
        <Loading />
      ) : screen.isError || !summary ? (
        <LoadError onRetry={actions.retry} />
      ) : (
        <ScrollView contentContainerClassName="pb-10">
          <View accessible className="gap-1 px-5 pt-1">
            <Text variant="display">{summary.equity}</Text>
            <Text variant="sm">
              <SignedText value={summary.today} />
              <Text variant="sm" className="text-fg-3">{` ${t.portfolio.today}`}</Text>
            </Text>
          </View>
          <View className="mt-1">
            <EquityChart
              values={screen.curve.values}
              rising={screen.curve.rising}
              height={120}
              label={t.portfolio.totalEquity}
            />
          </View>
          <View className="px-5 pb-3 pt-2">
            <Segmented
              full
              label={t.portfolio.totalEquity}
              options={screen.periods.map((value) => ({ value, label: value }))}
              value={screen.period}
              onChange={actions.setPeriod}
            />
          </View>
          <View className="flex-row flex-wrap gap-2 px-4 pb-3">
            {summary.stats.map((stat) => (
              <View
                key={stat.key}
                accessible
                className="min-w-[45%] flex-1 gap-0.5 rounded-control-lg bg-surface-3 px-3 py-2.5"
              >
                <Text variant="caption" className="text-fg-3">
                  {stat.label}
                </Text>
                <SignedText value={stat.value} variant="num-md" arrow={false} />
              </View>
            ))}
          </View>
          <View className="px-5 pb-2.5">
            <AllocationBar items={summary.allocation} label={t.portfolio.allocationA11y} />
          </View>
          <View className="flex-row items-center justify-between border-t border-border px-5 pb-1 pt-1.5">
            <Text variant="h3" accessibilityRole="header">
              {summary.positionsTitle}
            </Text>
            <Text variant="caption" weight={600} className="text-fg-2">
              {`${t.portfolio.sortByValue} ↓`}
            </Text>
          </View>
          {summary.positions.length === 0 ? (
            <Empty icon={Briefcase} title={t.portfolio.empty} />
          ) : null}
          {summary.positions.map((position) => (
            <PositionRow key={position.symbol} position={position} />
          ))}
        </ScrollView>
      )}
      <PlSheet visible={screen.explaining} onClose={actions.closeExplain} />
    </SafeAreaView>
  );
}
