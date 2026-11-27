import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { type Sector } from '@sarwa/contracts';

import { OrderStatusBadge, SideBadge } from '../../components/trading/order-status-badge';
import { StockAvatar } from '../../components/trading/stock-avatar';
import { Text } from '../../components/ui/text';
import { type OrderLine } from './order-copy';

export function OrderRow({ order, sector }: { order: OrderLine; sector?: Sector }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={order.a11yLabel}
      onPress={() => {
        router.push({ pathname: '/orders/[id]', params: { id: order.id } });
      }}
      className="min-h-16 flex-row items-center gap-3 border-b border-border px-4 py-3 active:bg-surface-3"
    >
      <StockAvatar symbol={order.symbol} sector={sector} />
      <View className="min-w-0 flex-1 gap-[3px]">
        <View className="flex-row items-center gap-1.5">
          <SideBadge side={order.side} />
          <Text variant="symbol">{order.symbol}</Text>
          <Text variant="caption" className="text-fg-3" style={{ fontVariant: ['tabular-nums'] }}>
            {order.amount}
          </Text>
        </View>
        <Text variant="caption" className="text-fg-2">
          {order.typeLine}
        </Text>
        {order.note ? (
          <Text variant="caption" className="text-fg-3" numberOfLines={2}>
            {order.note}
          </Text>
        ) : null}
      </View>
      <View className="items-end gap-1.5">
        <OrderStatusBadge status={order.status} />
        <Text variant="caption" className="text-fg-3">
          {order.time}
        </Text>
      </View>
    </Pressable>
  );
}
