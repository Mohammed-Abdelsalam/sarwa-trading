import * as Haptics from 'expo-haptics';
import { Delete } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { type KeypadKey } from '@sarwa/core';

import { localDigits, useCopy } from '../../lib/i18n';
import { useColors } from '../../lib/theme';
import { Text } from '../ui/text';

const ROWS: KeypadKey[][] = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['.', '0', 'backspace'],
];

export function Keypad({ onKey }: { onKey: (key: KeypadKey) => void }) {
  const colors = useColors();
  const { t, digits, dir } = useCopy();
  const labelOf = (key: KeypadKey) =>
    key === 'backspace'
      ? t.ticket.keypad.delete
      : key === '.'
        ? t.ticket.keypad.decimalPoint
        : localDigits(key, digits);

  return (
    <View className="gap-1">
      {ROWS.map((row) => (
        <View key={row.join('')} className="flex-row gap-1">
          {row.map((key) => (
            <Pressable
              key={key}
              accessibilityRole="keyboardkey"
              accessibilityLabel={labelOf(key)}
              onPress={() => {
                void Haptics.selectionAsync();
                onKey(key);
              }}
              className="min-h-[52px] flex-1 items-center justify-center rounded-control-lg active:bg-surface-3"
            >
              {key === 'backspace' ? (
                <Delete
                  size={24}
                  color={colors.fg}
                  style={dir === 'rtl' ? { transform: [{ scaleX: -1 }] } : undefined}
                />
              ) : (
                <Text variant="keypad">{localDigits(key, digits)}</Text>
              )}
            </Pressable>
          ))}
        </View>
      ))}
    </View>
  );
}
