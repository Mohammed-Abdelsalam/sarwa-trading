import { type ReactNode } from 'react';
import { ActivityIndicator, Pressable, type PressableProps } from 'react-native';

import { cx } from '../../lib/theme';
import { Text } from './text';

const BUTTON_VARIANTS = {
  primary: ['bg-brand active:bg-brand-press', 'text-on-brand'],
  secondary: ['border border-border bg-surface-3 active:bg-border-strong', 'text-fg'],
  ghost: ['bg-transparent active:bg-surface-3', 'text-fg'],
} as const;

export function Button({
  label,
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  className,
  ...props
}: PressableProps & {
  label: string;
  variant?: keyof typeof BUTTON_VARIANTS;
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: ReactNode;
  className?: string;
}) {
  const [container, text] = BUTTON_VARIANTS[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ busy: loading, disabled: props.disabled ?? false }}
      className={cx(
        'flex-row items-center justify-center gap-2',
        size === 'sm' && 'h-11 rounded-[8px] px-3',
        size === 'md' && 'h-11 rounded-md px-4',
        size === 'lg' && 'h-12 rounded-[12px] px-5',
        container,
        props.disabled && 'opacity-40',
        className,
      )}
      {...props}
    >
      {loading ? <ActivityIndicator size="small" /> : icon}
      <Text
        variant="sm"
        className={text}
        style={{ fontFamily: 'Inter_600SemiBold', fontSize: size === 'lg' ? 15 : 14 }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
