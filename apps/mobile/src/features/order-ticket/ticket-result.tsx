import { Bell, Check, Clock, Info, type LucideIcon, X } from 'lucide-react-native';
import { ScrollView, View } from 'react-native';

import { type TicketResultTone as ResultTone } from '@sarwa/core';
import { type ColorRole } from '@sarwa/tokens';

import { Button } from '../../components/ui/button';
import { KeyValueRow } from '../../components/ui/key-value-row';
import { Text } from '../../components/ui/text';
import { useCopy } from '../../lib/i18n';
import { cx, useColors } from '../../lib/theme';
import { type useOrderTicketScreen } from './use-order-ticket-screen';

type Screen = ReturnType<typeof useOrderTicketScreen>;

const TONE: Record<ResultTone, [bg: string, icon: ColorRole, Icon: LucideIcon]> = {
  pos: ['bg-pos-subtle', 'pos', Check],
  brand: ['bg-brand-subtle', 'brand-fg', Clock],
  info: ['bg-info-subtle', 'info', Info],
  neg: ['bg-neg-subtle', 'neg', X],
};

export function TicketResult({
  result,
  actions,
}: {
  result: NonNullable<Screen['result']>;
  actions: Screen['actions'];
}) {
  const colors = useColors();
  const { t } = useCopy();
  const [bg, iconColor, Icon] = TONE[result.tone];
  const traded = result.status === 'filled' || result.status === 'partially_filled';

  return (
    <>
      <ScrollView contentContainerClassName="items-center gap-3.5 px-6 pt-6">
        <View className={cx('h-[88px] w-[88px] items-center justify-center rounded-[28px]', bg)}>
          <Icon size={32} color={colors[iconColor]} />
        </View>
        <Text variant="h1" accessibilityRole="header" className="text-center">
          {result.title}
        </Text>
        {result.body ? (
          <Text className="text-center text-fg-2" style={{ fontVariant: ['tabular-nums'] }}>
            {result.body}
          </Text>
        ) : null}
        <View className="w-full rounded-lg border border-border bg-surface px-4 py-2">
          {result.rows.map((row) => (
            <KeyValueRow key={row.key} label={row.label} value={row.value} />
          ))}
        </View>
        {result.position ? (
          <View className="w-full flex-row gap-2.5 rounded-[14px] border border-border px-4 py-3.5">
            {result.position.map((item) => (
              <View key={item.key} accessible className="flex-1">
                <Text variant="caption" className="text-fg-3">
                  {item.label}
                </Text>
                <Text variant="num-sm" weight={600}>
                  {item.value}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
      <View className="gap-2.5 px-4 pb-4 pt-2">
        {traded ? (
          <Button size="lg" onPress={actions.viewPosition}>
            {t.ticket.viewPosition}
          </Button>
        ) : null}
        <View className="flex-row gap-2.5">
          <Button
            size="lg"
            variant="secondary"
            className="flex-1"
            icon={<Bell size={16} color={colors.fg} />}
            onPress={actions.setAlert}
          >
            {t.ticket.setAlert}
          </Button>
          <Button size="lg" variant="secondary" className="flex-1" onPress={actions.close}>
            {t.common.done}
          </Button>
        </View>
      </View>
    </>
  );
}
