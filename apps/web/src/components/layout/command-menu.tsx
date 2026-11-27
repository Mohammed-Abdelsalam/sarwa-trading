import { Bell, FileText, type LucideIcon, Minus, Moon, Plus, Search, Star } from 'lucide-react';

import { CommandPalette, StockAvatar } from '@sarwa/ui';

import { type CommandIcon, useCommandPalette } from './use-command-palette';

const ICONS: Record<Exclude<CommandIcon, 'stock'>, LucideIcon> = {
  buy: Plus,
  sell: Minus,
  alert: Bell,
  watch: Star,
  page: FileText,
  theme: Moon,
  search: Search,
};

export function CommandMenu({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const palette = useCommandPalette({ open, onOpenChange });
  const { labels } = palette;

  return (
    <CommandPalette
      open={palette.open}
      onOpenChange={palette.setOpen}
      label={labels.label}
      placeholder={labels.placeholder}
      query={palette.query}
      onQueryChange={palette.setQuery}
      empty={labels.empty}
      hints={labels.hints}
      groups={palette.groups.map((group) => ({
        group: group.group,
        items: group.items.map((item) => {
          const Icon = item.icon === 'stock' ? null : ICONS[item.icon];
          return {
            id: item.id,
            label: item.label,
            ...(item.hint ? { hint: item.hint } : {}),
            ...(item.shortcut ? { shortcut: item.shortcut } : {}),
            icon: item.stock ? (
              <StockAvatar symbol={item.stock.symbol} sector={item.stock.sector} size={24} />
            ) : Icon ? (
              <Icon className={item.icon === 'buy' ? 'text-brand-fg' : undefined} />
            ) : null,
            onSelect: item.run,
          };
        }),
      }))}
    />
  );
}
