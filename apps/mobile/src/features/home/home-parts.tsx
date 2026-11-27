import { Bell, ChevronRight, type LucideIcon } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { type Direction } from '@sarwa/core';

import { EquityChart } from '../../components/trading/equity-chart';
import { SignedText } from '../../components/trading/signed-text';
import { Text } from '../../components/ui/text';
import { useCopy } from '../../lib/i18n';
import { useColors } from '../../lib/theme';

interface Signed {
  label: string;
  direction: Direction;
}

export function BellButton({
  count,
  badge,
  label,
  onPress,
}: {
  count: number;
  badge: string;
  label: string;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className="h-11 w-11 items-center justify-center rounded-control-lg active:bg-surface-3"
    >
      <Bell size={20} color={colors['fg-2']} />
      {count > 0 ? (
        <View className="absolute end-1 top-1 h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-surface bg-neg px-1">
          <Text variant="overline" weight={700} className="text-on-brand">
            {badge}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export function EquityCard({
  equity,
  curve,
}: {
  equity: {
    value: string;
    today: Signed;
    allTime: Signed;
    buyingPower: string;
    unrealized: Signed;
  };
  curve: { values: readonly number[]; rising: boolean };
}) {
  const { t } = useCopy();
  return (
    <View className="gap-2 rounded-lg border border-border bg-surface p-4">
      <View className="flex-row items-center justify-between">
        <Text variant="sm" weight={600} className="text-fg-2">
          {t.portfolio.totalEquity}
        </Text>
        <Text variant="caption" className="text-fg-3">
          {`${t.portfolio.allTime} `}
          <SignedText value={equity.allTime} variant="caption" arrow={false} />
        </Text>
      </View>
      <Text variant="display-equity">{equity.value}</Text>
      <Text variant="sm">
        <SignedText value={equity.today} />
        <Text variant="sm" className="text-fg-3">{` ${t.portfolio.today}`}</Text>
      </Text>
      <EquityChart values={curve.values} rising={curve.rising} height={64} />
      <View className="flex-row gap-2 border-t border-border pt-2.5">
        <View className="flex-1">
          <Text variant="caption" className="text-fg-3">
            {t.portfolio.buyingPower}
          </Text>
          <Text variant="num-md">{equity.buyingPower}</Text>
        </View>
        <View className="flex-1">
          <Text variant="caption" className="text-fg-3">
            {t.portfolio.unrealizedPl}
          </Text>
          <SignedText value={equity.unrealized} variant="num-md" arrow={false} />
        </View>
      </View>
    </View>
  );
}

export function ShortcutCard({
  icon: Icon,
  title,
  value,
  onPress,
}: {
  icon: LucideIcon;
  title: string;
  value: string;
  onPress: () => void;
}) {
  const colors = useColors();
  const { dir } = useCopy();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${value}`}
      onPress={onPress}
      className="min-h-16 flex-1 flex-row items-center gap-2.5 rounded-lg border border-border bg-surface px-3.5 py-3 active:bg-surface-3"
    >
      <Icon size={18} color={colors['brand-fg']} />
      <View className="flex-1">
        <Text variant="caption" className="text-fg-3">
          {title}
        </Text>
        <Text variant="num-md">{value}</Text>
      </View>
      <ChevronRight
        size={16}
        color={colors['fg-3']}
        style={dir === 'rtl' ? { transform: [{ scaleX: -1 }] } : undefined}
      />
    </Pressable>
  );
}
