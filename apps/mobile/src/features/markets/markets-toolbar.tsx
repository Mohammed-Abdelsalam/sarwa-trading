import { ArrowDown, ArrowUp, ArrowUpDown, Search } from 'lucide-react-native';
import { Pressable, ScrollView, TextInput, View } from 'react-native';

import { SECTOR_FILTERS, type SectorFilter, type SortOption } from '@sarwa/core';

import { Text } from '../../components/ui/text';
import { cx, useColors } from '../../lib/theme';

export function SearchField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const colors = useColors();
  return (
    <View className="px-5 pb-3">
      <View className="h-11 flex-row items-center gap-2 rounded-[12px] border border-border-strong bg-surface px-3 dark:bg-surface-2">
        <Search size={16} color={colors['fg-3']} />
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder="Search symbol or company"
          placeholderTextColor={colors['fg-3']}
          accessibilityLabel="Search stocks"
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          className="flex-1 text-[15px] text-fg"
          style={{ fontFamily: 'Inter_400Regular' }}
        />
      </View>
    </View>
  );
}

export function SectorChips({
  value,
  onChange,
}: {
  value: SectorFilter;
  onChange: (sector: SectorFilter) => void;
}) {
  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-2 px-5"
        accessibilityRole="tablist"
      >
        {SECTOR_FILTERS.map((chip) => {
          const active = chip.id === value;
          return (
            <Pressable
              key={chip.id}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => {
                onChange(chip.id);
              }}
              className={cx(
                'h-9 justify-center rounded-full border px-3.5',
                active ? 'border-fg bg-fg' : 'border-border-strong',
              )}
            >
              <Text
                variant="sm"
                className={active ? 'text-bg' : 'text-fg-2'}
                style={{ fontFamily: 'Inter_600SemiBold' }}
              >
                {chip.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export function ListMeta({
  count,
  sort,
  onCycleSort,
}: {
  count: number;
  sort: SortOption;
  onCycleSort: () => void;
}) {
  const colors = useColors();
  const SortIcon = sort.dir > 0 ? ArrowUp : ArrowDown;
  return (
    <View className="flex-row items-center justify-between pb-1 pl-5 pr-3 pt-2">
      <Text variant="caption" className="text-fg-3">
        {count} stocks · prices in USD
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Sort by ${sort.label}, tap to change`}
        onPress={onCycleSort}
        className="h-11 flex-row items-center gap-1.5 rounded-[8px] px-2 active:bg-surface-3"
      >
        <ArrowUpDown size={16} color={colors['fg-2']} />
        <Text variant="sm" className="text-fg-2" style={{ fontFamily: 'Inter_600SemiBold' }}>
          {sort.label}
        </Text>
        <SortIcon size={14} color={colors['fg-2']} />
      </Pressable>
    </View>
  );
}
