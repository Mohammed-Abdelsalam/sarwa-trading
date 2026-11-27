import { AlertCircle, Eye, EyeOff } from 'lucide-react-native';
import { type ReactNode, useState } from 'react';
import { TextInput, type TextInputProps, View } from 'react-native';

import { typography } from '@sarwa/tokens';

import { useCopy } from '../../lib/i18n';
import { cx, useColors } from '../../lib/theme';
import { IconButton } from './icon-button';
import { fontFile, Text } from './text';

const TEXT_STYLE = { fontFamily: fontFile('sans', 400), fontSize: typography.body.size };

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

type Autofill = 'name' | 'email' | 'current-password' | 'new-password' | 'off';

const AUTOFILL: Record<Autofill, Pick<TextInputProps, 'textContentType' | 'keyboardType'>> = {
  name: { textContentType: 'name' },
  email: { textContentType: 'emailAddress', keyboardType: 'email-address' },
  'current-password': { textContentType: 'password' },
  'new-password': { textContentType: 'newPassword' },
  off: { textContentType: 'none' },
};

export function TextField({
  label,
  value,
  onChangeText,
  autofill,
  secure = false,
  error,
  hint,
  placeholder,
  accessory,
  editable = true,
  returnKeyType,
  onSubmitEditing,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  autofill: Autofill;
  secure?: boolean;
  error?: string;
  hint?: string;
  placeholder?: string;
  // Sits on the label row, e.g. the sign-in "Forgot?" link.
  accessory?: ReactNode;
  editable?: boolean;
  returnKeyType?: TextInputProps['returnKeyType'];
  onSubmitEditing?: () => void;
}) {
  const colors = useColors();
  const { t, dir } = useCopy();
  const [shown, setShown] = useState(false);
  const isEmail = autofill === 'email';
  return (
    <View className="gap-1.5">
      <View className="flex-row items-center justify-between">
        <Text variant="sm" weight={600} className="text-fg-2">
          {label}
        </Text>
        {accessory}
      </View>
      <View
        className={cx(
          'min-h-12 flex-row items-center rounded-control-lg border bg-surface ps-3.5',
          secure ? 'pe-1' : 'pe-3.5',
          error ? 'border-neg' : 'border-border-strong',
        )}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          accessibilityLabel={label}
          accessibilityHint={error ?? hint}
          accessibilityState={{ disabled: !editable }}
          aria-invalid={error !== undefined}
          autoComplete={autofill}
          autoCapitalize={autofill === 'name' ? 'words' : 'none'}
          autoCorrect={false}
          secureTextEntry={secure && !shown}
          editable={editable}
          placeholder={placeholder}
          placeholderTextColor={colors['fg-3']}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          className="flex-1 py-2.5 text-fg"
          // Emails stay left-to-right inside Arabic layouts.
          style={[
            TEXT_STYLE,
            isEmail && dir === 'rtl' && { writingDirection: 'ltr', textAlign: 'right' },
          ]}
          {...AUTOFILL[autofill]}
        />
        {secure ? (
          <IconButton
            label={shown ? t.auth.hidePassword : t.auth.showPassword}
            icon={shown ? EyeOff : Eye}
            iconSize={18}
            size={44}
            accessibilityState={{ selected: shown }}
            onPress={() => {
              setShown((current) => !current);
            }}
          />
        ) : null}
      </View>
      {error ? (
        <FieldError message={error} />
      ) : hint ? (
        <Text variant="caption" className="text-fg-3">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}
