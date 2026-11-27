import { AlertCircle } from 'lucide-react-native';
import { TextInput, View } from 'react-native';

import { typography } from '@sarwa/tokens';

import { cx, useColors } from '../../lib/theme';
import { fontFile, Text } from './text';

const INPUT_STYLE = {
  fontFamily: fontFile('sans', 600),
  fontSize: typography['num-lg'].size,
  fontVariant: ['tabular-nums' as const],
};

export function FieldError({ message }: { message: string }) {
  const colors = useColors();
  return (
    <View accessibilityRole="alert" className="flex-row items-start gap-1.5">
      <View className="pt-0.5">
        <AlertCircle size={14} color={colors.neg} />
      </View>
      <Text variant="sm" className="flex-1 text-neg">
        {message}
      </Text>
    </View>
  );
}

export function PriceField({
  label,
  value,
  onChangeText,
  prefix,
  signed = false,
  hint,
  error,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  prefix?: string;
  // The decimal pad has no minus key, so a signed value gets a keyboard that does.
  signed?: boolean;
  hint?: string;
  error?: string;
}) {
  const colors = useColors();
  return (
    <View className="gap-1.5">
      <Text variant="sm" weight={600} className="text-fg-2">
        {label}
      </Text>
      <View
        className={cx(
          'min-h-12 flex-row items-center gap-1 rounded-control-lg border bg-surface px-3.5',
          error ? 'border-neg' : 'border-border-strong',
        )}
      >
        {prefix ? <Text className="text-fg-3">{prefix}</Text> : null}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          accessibilityLabel={label}
          accessibilityHint={error ?? hint}
          keyboardType={signed ? 'numbers-and-punctuation' : 'decimal-pad'}
          placeholderTextColor={colors['fg-3']}
          className="flex-1 py-2 text-fg"
          style={INPUT_STYLE}
        />
      </View>
      {error ? (
        <FieldError message={error} />
      ) : hint ? (
        <Text variant="caption" className="text-fg-3" style={{ fontVariant: ['tabular-nums'] }}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}
