import { Search, X } from 'lucide-react-native';
import { Pressable, ScrollView, TextInput, View } from 'react-native';

import { SECTOR_FILTERS, type SectorFilter, sectorFilterLabel, type SortOption } from '@sarwa/core';
import { typography } from '@sarwa/tokens';

import { SortButton } from '../../components/trading/sort-button';
import { IconButton } from '../../components/ui/icon-button';
import { fontFile, Text } from '../../components/ui/text';
import { useCopy } from '../../lib/i18n';
import { cx, useColors } from '../../lib/theme';

const INPUT_STYLE = { fontFamily: fontFile('sans', 400), fontSize: typography.body.size };

export function SearchField({
  value,
  onChange,
  disabled = false,
  placeholder,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  label?: string;
}) {
  const colors = useColors();
  const { t } = useCopy();
  return (
    <View className="px-5 pb-3">
      <View
        className={cx(
          'h-11 flex-row items-center gap-2 rounded-control-lg border border-border-strong bg-surface ps-3 dark:bg-surface-2',
          disabled && 'opacity-50',
        )}
      >
        <Search size={16} color={colors['fg-3']} />
        <TextInput
          value={value}
          onChangeText={onChange}
          editable={!disabled}
          placeholder={placeholder ?? t.search.placeholder}
          placeholderTextColor={colors['fg-3']}
          accessibilityLabel={label ?? t.markets.searchLabel}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          className="flex-1 text-fg"
          style={INPUT_STYLE}
        />
        {value ? (
          <IconButton
            label={t.markets.clearSearch}
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
  const { t } = useCopy();
  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-2 px-5"
        accessibilityRole="tablist"
      >
        {SECTOR_FILTERS.map((sector) => {
          const active = sector === value;
          return (
            <Pressable
              key={sector}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => {
                onChange(sector);
              }}
              className={cx(
                'h-9 justify-center rounded-full border px-3.5',
                active ? 'border-fg bg-fg' : 'border-border-strong',
              )}
            >
              <Text variant="sm" weight={600} className={active ? 'text-bg' : 'text-fg-2'}>
                {sectorFilterLabel(t, sector)}
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
  const { t, f } = useCopy();
  return (
    <View className="flex-row items-center justify-between pb-1 pe-3 ps-5 pt-2">
      <Text variant="caption" className="text-fg-3">
        {t.markets.summaryShort(f.count(count))}
      </Text>
      <SortButton sort={sort} onPress={onCycleSort} />
    </View>
  );
}
