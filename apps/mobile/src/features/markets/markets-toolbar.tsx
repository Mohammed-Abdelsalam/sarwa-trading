import { ArrowDown, ArrowUp, ArrowUpDown, Search, X } from 'lucide-react-native';
import { Pressable, ScrollView, TextInput, View } from 'react-native';

import { SECTOR_FILTERS, type SectorFilter, type SortOption } from '@sarwa/core';
import { typography } from '@sarwa/tokens';

import { IconButton } from '../../components/ui/icon-button';
import { fontFile, Text } from '../../components/ui/text';
import { cx, useColors } from '../../lib/theme';

const INPUT_STYLE = { fontFamily: fontFile('sans', 400), fontSize: typography.body.size };

export function SearchField({
  value,
  onChange,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const colors = useColors();
  return (
    <View className="px-5 pb-3">
      <View
        className={cx(
          'h-11 flex-row items-center gap-2 rounded-control-lg border border-border-strong bg-surface pl-3 dark:bg-surface-2',
          disabled && 'opacity-50',
        )}
      >
        <Search size={16} color={colors['fg-3']} />
        <TextInput
          value={value}
          onChangeText={onChange}
          editable={!disabled}
          placeholder="Search symbol or company"
          placeholderTextColor={colors['fg-3']}
          accessibilityLabel="Search stocks"
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          className="flex-1 text-fg"
          style={INPUT_STYLE}
        />
        {value ? (
          <IconButton
            label="Clear search"
            icon={X}
            iconSize={16}
            size={44}
            onPress={() => {
              onChange('');
            }}
          />
        ) : null}
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
              <Text variant="sm" weight={600} className={active ? 'text-bg' : 'text-fg-2'}>
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
        className="h-11 flex-row items-center gap-1.5 rounded-control-sm px-2 active:bg-surface-3"
      >
        <ArrowUpDown size={16} color={colors['fg-2']} />
        <Text variant="sm" weight={600} className="text-fg-2">
          {sort.label}
        </Text>
        <SortIcon size={14} color={colors['fg-2']} />
      </Pressable>
    </View>
  );
}
