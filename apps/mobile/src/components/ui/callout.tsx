import { type LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';

import { type ColorRole } from '@sarwa/tokens';

import { cx, useColors } from '../../lib/theme';
import { Text } from './text';

export type CalloutTone = 'info' | 'warn' | 'neg' | 'pos';

const TONE: Record<CalloutTone, [container: string, icon: ColorRole]> = {
  info: ['border-info/30 bg-info-subtle', 'info'],
  warn: ['border-warn/30 bg-warn-subtle', 'warn'],
  neg: ['border-neg/30 bg-neg-subtle', 'neg'],
  pos: ['border-pos/30 bg-pos-subtle', 'pos'],
};

export function Callout({
  tone,
  icon: Icon,
  title,
  body,
}: {
  tone: CalloutTone;
  icon: LucideIcon;
  title?: string;
  body: string;
}) {
  const colors = useColors();
  const [container, iconColor] = TONE[tone];
  return (
    <View
      accessibilityRole={tone === 'neg' ? 'alert' : undefined}
      className={cx('flex-row gap-2.5 rounded-control-lg border px-3.5 py-3', container)}
    >
      <View className="pt-0.5">
        <Icon size={16} color={colors[iconColor]} />
      </View>
      <Text variant="sm" className="flex-1">
        {title ? <Text variant="sm" weight={700}>{`${title} `}</Text> : null}
        {body}
      </Text>
    </View>
  );
}
