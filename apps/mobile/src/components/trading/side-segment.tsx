import * as Haptics from 'expo-haptics';
import { Pressable, View } from 'react-native';

import { type Order } from '@sarwa/contracts';

import { cx } from '../../lib/theme';
import { Text } from '../ui/text';

type Side = Order['side'];

// Buy is the brand fill, Sell the neutral inverse: never green/red buttons.
const ACTIVE: Record<Side, [container: string, label: string]> = {
  buy: ['bg-brand', 'text-on-brand'],
  sell: ['bg-fg', 'text-bg'],
};

export function SideSegment({
  value,
  onChange,
  label,
  buyLabel,
  sellLabel,
}: {
  value: Side;
  onChange: (side: Side) => void;
  label: string;
  buyLabel: string;
  sellLabel: string;
}) {
  const options: [Side, string][] = [
    ['buy', buyLabel],
    ['sell', sellLabel],
  ];
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      className="flex-row gap-[3px] rounded-control-lg bg-surface-3 p-[3px]"
    >
      {options.map(([side, text]) => {
        const selected = side === value;
        const [container, color] = ACTIVE[side];
        return (
          <Pressable
            key={side}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            onPress={() => {
              if (selected) return;
              void Haptics.selectionAsync();
              onChange(side);
            }}
            className={cx(
              'min-h-[38px] flex-1 items-center justify-center rounded-[9px]',
              selected && container,
            )}
          >
            <Text variant="button" className={selected ? color : 'text-fg-2'}>
              {text}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
