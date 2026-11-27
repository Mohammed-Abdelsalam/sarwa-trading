import { type ReactNode } from 'react';
import { ActivityIndicator, Pressable, type PressableProps } from 'react-native';

import { type ButtonSize, type ButtonVariant } from '@sarwa/tokens';

import { cx } from '../../lib/theme';
import { Text } from './text';

const VARIANT: Record<ButtonVariant, [container: string, label: string]> = {
  primary: ['bg-brand active:bg-brand-press', 'text-on-brand'],
  secondary: ['border border-border bg-surface-3 active:bg-border-strong', 'text-fg'],
  ghost: ['bg-transparent active:bg-surface-3', 'text-fg'],
  danger: ['bg-danger active:bg-danger-press', 'text-on-brand'],
};

// Every size keeps the 44 pt touch target; sm only tightens radius and padding.
const SIZE: Record<ButtonSize, string> = {
  sm: 'h-11 rounded-control-sm px-3',
  md: 'h-11 rounded-md px-4',
  lg: 'h-12 rounded-control-lg px-5',
};

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  className,
  ...props
}: Omit<PressableProps, 'children'> & {
  children: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  className?: string;
}) {
  const [container, label] = VARIANT[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ busy: loading, disabled: props.disabled ?? false }}
      className={cx(
        'flex-row items-center justify-center gap-2',
        SIZE[size],
        container,
        props.disabled && 'opacity-40',
        className,
      )}
      {...props}
    >
      {loading ? <ActivityIndicator size="small" /> : icon}
      <Text variant={size === 'lg' ? 'button-lg' : 'button'} className={label}>
        {children}
      </Text>
    </Pressable>
  );
}
