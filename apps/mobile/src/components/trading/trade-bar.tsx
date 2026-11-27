import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { type Order } from '@sarwa/contracts';

import { useCopy } from '../../lib/i18n';
import { Text } from '../ui/text';

export function openTicket(symbol: string, side: Order['side']) {
  router.push({ pathname: '/order/new', params: { symbol, side } });
}

export function TradeBar({ symbol, sellLabel }: { symbol: string; sellLabel: string }) {
  const { t } = useCopy();
  const insets = useSafeAreaInsets();
  return (
    <View
      className="flex-row gap-2.5 border-t border-border bg-surface px-4 pt-3"
      style={{ paddingBottom: Math.max(insets.bottom, 12) }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t.ticket.buyTitle({ symbol })}
        onPress={() => {
          openTicket(symbol, 'buy');
        }}
        className="min-h-12 flex-1 items-center justify-center rounded-control-lg bg-brand active:bg-brand-press"
      >
        <Text variant="button-lg" className="text-on-brand">
          {t.common.buy}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t.ticket.sellTitle({ symbol })}
        onPress={() => {
          openTicket(symbol, 'sell');
        }}
        className="min-h-12 flex-1 items-center justify-center rounded-control-lg bg-fg active:opacity-80"
      >
        <Text variant="button-lg" className="text-bg">
          {sellLabel}
        </Text>
      </Pressable>
    </View>
  );
}
