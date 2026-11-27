import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { type StockWithQuote } from '@sarwa/contracts';
import { type MoversTab } from '@sarwa/core';

import { StockRow } from '../../components/trading/stock-row';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Text } from '../../components/ui/text';
import { useCopy } from '../../lib/i18n';
import { MoversHeader } from './home-parts';

export interface GuestHomeView {
  startingCash: string;
  stockCount: string;
  moverTab: MoversTab;
  movers: readonly StockWithQuote[];
  onMoverTab: (tab: MoversTab) => void;
  onCreateAccount: () => void;
  onSignIn: () => void;
}

const SIGNUP_SECONDS = 30;

export function GuestHero({ view }: { view: GuestHomeView }) {
  const { t, f } = useCopy();
  const steps = [
    t.home.guest.stepSignUp({ n: f.number(SIGNUP_SECONDS) }),
    t.home.guest.stepCash({ amount: view.startingCash }),
    t.home.guest.stepTrade,
  ];
  const short = t.home.guest.stepsShort;
  const labels = [short.signUp, short.getCash({ amount: view.startingCash }), short.trade];
  return (
    <View className="gap-3 rounded-lg border border-border bg-surface p-4">
      <Badge label={t.home.guest.badge} tone="brand" />
      <Text variant="h2" accessibilityRole="header">
        {t.home.guest.h1({ amount: view.startingCash })}
      </Text>
      <Text variant="sm" className="text-fg-2">
        {t.home.guest.bodyMobile({ n: view.stockCount })}
      </Text>
      <Button size="lg" onPress={view.onCreateAccount}>
        {t.gate.cta.createFree}
      </Button>
      <View
        accessible
        accessibilityLabel={`${t.home.guest.howItWorks}: ${steps.join(', ')}`}
        className="flex-row gap-2 pt-1"
      >
        {labels.map((step, index) => (
          <View key={step} className="flex-1 items-center gap-1">
            <View className="h-7 w-7 items-center justify-center rounded-full bg-brand-subtle">
              <Text variant="sm" weight={700} className="text-brand-fg">
                {f.number(index + 1)}
              </Text>
            </View>
            <Text variant="caption" className="text-center text-fg-2">
              {step}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// The Home tab for a guest: hero in place of the equity card, then live top movers.
export function GuestHomeScreen({ view }: { view: GuestHomeView }) {
  const { t } = useCopy();
  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-bg">
      <View className="flex-row items-center justify-between pb-2 pe-3 ps-5">
        <Text variant="h1" accessibilityRole="header">
          {t.nav.home}
        </Text>
        <Button variant="ghost" size="sm" onPress={view.onSignIn}>
          {t.gate.cta.signIn}
        </Button>
      </View>
      <ScrollView contentContainerClassName="pb-10">
        <View className="px-4">
          <GuestHero view={view} />
        </View>
        <MoversHeader value={view.moverTab} onChange={view.onMoverTab} />
        {view.movers.map((stock) => (
          <StockRow key={stock.symbol} stock={stock} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
