import { View } from 'react-native';

import { type BadgeTone } from '@sarwa/tokens';

import { cx } from '../../lib/theme';
import { Text } from './text';

const TONE: Record<BadgeTone, [container: string, label: string]> = {
  neutral: ['bg-surface-3', 'text-fg-2'],
  pos: ['bg-pos-subtle', 'text-pos'],
  neg: ['bg-neg-subtle', 'text-neg'],
  warn: ['bg-warn-subtle', 'text-warn'],
  info: ['bg-info-subtle', 'text-info'],
  brand: ['bg-brand-subtle', 'text-brand-fg'],
  outline: ['border border-border-strong', 'text-fg-2'],
};

export function Badge({
  label,
  tone = 'neutral',
  square = false,
}: {
  label: string;
  tone?: BadgeTone;
  square?: boolean;
}) {
  const [container, text] = TONE[tone];
  return (
    <View
      className={cx(
        'items-center justify-center self-start',
        square ? 'min-h-[18px] rounded-xs px-1.5' : 'min-h-badge rounded-sm px-2',
        container,
      )}
    >
      <Text variant={square ? 'overline' : 'caption'} weight={600} className={text}>
        {label}
      </Text>
    </View>
  );
}
