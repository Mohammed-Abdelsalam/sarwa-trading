import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react-native';
import { Pressable } from 'react-native';

import { sortLabel, type SortOption } from '@sarwa/core';

import { useCopy } from '../../lib/i18n';
import { useColors } from '../../lib/theme';
import { Text } from '../ui/text';

// A null sort is the watchlist's own order, the order the stocks were starred in.
export function SortButton({ sort, onPress }: { sort: SortOption | null; onPress: () => void }) {
  const colors = useColors();
  const { t } = useCopy();
  const label = sortLabel(t, sort);
  const DirectionIcon = sort ? (sort.dir > 0 ? ArrowUp : ArrowDown) : null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t.sort.tapToChange({ label })}
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
