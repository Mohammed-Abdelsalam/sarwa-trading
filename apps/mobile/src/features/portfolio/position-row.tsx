import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { type Sector } from '@sarwa/contracts';
import { type Direction } from '@sarwa/core';

import { SignedText } from '../../components/trading/signed-text';
import { StockAvatar } from '../../components/trading/stock-avatar';
import { openTicket } from '../../components/trading/trade-bar';
import { Text } from '../../components/ui/text';
import { TrailingSwipeable } from '../../components/ui/trailing-swipeable';
import { useCopy } from '../../lib/i18n';

export interface PositionModel {
  symbol: string;
  sector?: Sector;
  holding: string;
  details: string;
  value: string;
  total: { label: string; direction: Direction };
}

export function PositionRow({ position }: { position: PositionModel }) {
  const { t } = useCopy();
  const { symbol } = position;
  return (
    <TrailingSwipeable
      actions={() => (
        <View className="flex-row">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t.ticket.buyTitle({ symbol })}
            onPress={() => {
              openTicket(symbol, 'buy');
            }}
            className="w-20 items-center justify-center bg-brand"
          >
            <Text variant="button" className="text-on-brand">
              {t.common.buy}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t.ticket.sellTitle({ symbol })}
            onPress={() => {
              openTicket(symbol, 'sell');
            }}
            className="w-20 items-center justify-center bg-fg"
          >
            <Text variant="button" className="text-bg">
              {t.common.sell}
            </Text>
          </Pressable>
        </View>
      )}
    >
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={[
          symbol,
          position.holding,
          position.value,
          position.total.label,
          position.details,
        ].join(', ')}
        accessibilityActions={[
          { name: 'buy', label: t.common.buy },
          { name: 'sell', label: t.common.sell },
        ]}
        onAccessibilityAction={(event) => {
          openTicket(symbol, event.nativeEvent.actionName === 'sell' ? 'sell' : 'buy');
        }}
        onPress={() => {
          router.push({ pathname: '/stocks/[symbol]', params: { symbol } });
        }}
        className="min-h-16 flex-row items-center gap-3 border-b border-border bg-bg px-4 py-2.5 active:bg-surface-3"
      >
        <StockAvatar symbol={symbol} sector={position.sector} />
        <View className="min-w-0 flex-1 gap-0.5">
          <Text variant="symbol">{symbol}</Text>
          <Text variant="caption" className="text-fg-3" numberOfLines={1}>
            {position.holding}
          </Text>
          <Text variant="caption" className="text-fg-3" numberOfLines={2}>
            {position.details}
          </Text>
        </View>
        <View className="items-end gap-1">
          <Text variant="num-md">{position.value}</Text>
          <SignedText value={position.total} variant="caption" />
        </View>
      </Pressable>
    </TrailingSwipeable>
  );
}
