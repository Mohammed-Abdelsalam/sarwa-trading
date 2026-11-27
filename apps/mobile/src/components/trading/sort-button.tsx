import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react-native';
import { Pressable } from 'react-native';

import { type SortOption, WATCHLIST_ORDER_LABEL } from '@sarwa/core';

import { useColors } from '../../lib/theme';
import { Text } from '../ui/text';

// A null sort is the watchlist's own order, the order the stocks were starred in.
export function SortButton({ sort, onPress }: { sort: SortOption | null; onPress: () => void }) {
  const colors = useColors();
  const label = sort?.label ?? WATCHLIST_ORDER_LABEL;
  const DirectionIcon = sort ? (sort.dir > 0 ? ArrowUp : ArrowDown) : null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Sort by ${label}, tap to change`}
      onPress={onPress}
      className="h-11 flex-row items-center gap-1.5 rounded-control-sm px-2 active:bg-surface-3"
    >
      <ArrowUpDown size={16} color={colors['fg-2']} />
      <Text variant="sm" weight={600} className="text-fg-2">
        {label}
      </Text>
      {DirectionIcon ? <DirectionIcon size={14} color={colors['fg-2']} /> : null}
    </Pressable>
  );
}
