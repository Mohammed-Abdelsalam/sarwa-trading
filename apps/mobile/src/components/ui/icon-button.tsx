import { type LucideIcon } from 'lucide-react-native';
import { Pressable, type PressableProps } from 'react-native';

import { type IconButtonSize, layout } from '@sarwa/tokens';

import { cx, useColors } from '../../lib/theme';

const SIZE: Record<IconButtonSize, string> = {
  32: 'h-8 w-8 rounded-control-sm',
  40: 'h-10 w-10 rounded-md',
  44: 'h-11 w-11 rounded-control-lg',
};

export function IconButton({
  label,
  icon: Icon,
  iconSize = 20,
  size = 40,
  solid = false,
  className,
  ...props
}: Omit<PressableProps, 'children'> & {
  label: string;
  icon: LucideIcon;
  iconSize?: number;
  size?: IconButtonSize;
  solid?: boolean;
  className?: string;
}) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={(layout.minTouchTarget - size) / 2}
      className={cx(
        'items-center justify-center active:bg-surface-3',
        SIZE[size],
        solid && 'border border-border bg-surface-3',
        className,
      )}
      {...props}
    >
      <Icon size={iconSize} color={colors['fg-2']} />
    </Pressable>
  );
}
