import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Search } from 'lucide-react';
import { type KeyboardEvent, type ReactNode, useId, useState } from 'react';

import { cn } from '../lib/cn';
import { Kbd } from './navigation';

export interface CommandItem {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  shortcut?: string;
  onSelect: () => void;
}

export interface CommandGroup {
  group: string;
  items: readonly CommandItem[];
}

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: string;
  query: string;
  onQueryChange: (query: string) => void;
  groups: readonly CommandGroup[];
  placeholder?: string;
  empty?: ReactNode;
  hints?: readonly { keys: string; label: string }[];
  className?: string;
}

export function CommandPalette({
  open,
  onOpenChange,
  label,
  query,
  onQueryChange,
  groups,
  placeholder,
  empty,
  hints,
  className,
}: CommandPaletteProps) {
  const baseId = useId();
  const listId = `${baseId}-list`;
  const optionId = (id: string) => `${baseId}-opt-${id}`;
  const items = groups.flatMap((g) => g.items);
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = items.find((item) => item.id === activeId) ?? items[0];

  const run = (item: CommandItem) => {
    item.onSelect();
    onOpenChange(false);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      if (!active) return;
      event.preventDefault();
      run(active);
      return;
    }
    const step = { ArrowDown: 1, ArrowUp: -1 }[event.key];
    if (!step || items.length === 0) return;
    event.preventDefault();
    const index = active ? items.indexOf(active) : -1;
    const next = items[(index + step + items.length) % items.length];
    if (!next) return;
    setActiveId(next.id);
    const option = document.getElementById(optionId(next.id));
    // jsdom and some embedded webviews don't implement scrollIntoView.
    if (option && 'scrollIntoView' in option) option.scrollIntoView({ block: 'nearest' });
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="bg-scrim fixed inset-0 z-40" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className={cn(
            'fixed top-24 left-1/2 z-50 flex max-h-[calc(100dvh-8rem)] w-[calc(100vw-32px)] max-w-160 -translate-x-1/2 flex-col overflow-hidden',
            'border-border bg-surface-2 shadow-e3 rounded-[1rem] border focus:outline-none',
            className,
          )}
        >
          <DialogPrimitive.Title className="sr-only">{label}</DialogPrimitive.Title>
          <div className="border-border flex h-14 shrink-0 items-center gap-3 border-b px-4">
            <Search aria-hidden className="text-fg-3 size-5 shrink-0" />
            <input
              role="combobox"
              aria-label={label}
              aria-expanded
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={active ? optionId(active.id) : undefined}
              autoComplete="off"
              spellCheck={false}
              value={query}
              placeholder={placeholder}
              onChange={(event) => {
                onQueryChange(event.target.value);
              }}
              onKeyDown={onKeyDown}
              className="text-fg placeholder:text-fg-3 min-w-0 flex-1 bg-transparent text-base outline-none"
            />
            <Kbd>esc</Kbd>
          </div>
          <div
            id={listId}
            role="listbox"
            aria-label={label}
            className="min-h-0 flex-1 overflow-y-auto pb-1.5"
          >
            {items.length === 0 && empty ? (
              <p className="type-sm text-fg-3 px-4 py-6 text-center">{empty}</p>
            ) : null}
            {groups.map((group, groupIndex) =>
              group.items.length === 0 ? null : (
                <div
                  key={group.group}
                  role="group"
                  aria-labelledby={`${baseId}-g${String(groupIndex)}`}
                >
                  <div
                    id={`${baseId}-g${String(groupIndex)}`}
                    className="type-overline text-fg-3 px-4 pt-3 pb-1.5"
                  >
                    {group.group}
                  </div>
                  {group.items.map((item) => {
                    const selected = item === active;
                    return (
                      <div
                        key={item.id}
                        id={optionId(item.id)}
                        role="option"
                        aria-selected={selected}
                        onMouseMove={() => {
                          if (!selected) setActiveId(item.id);
                        }}
                        onClick={() => {
                          run(item);
                        }}
                        className={cn(
                          'text-fg relative flex h-11 cursor-pointer items-center gap-3 px-4 text-sm',
                          selected &&
                            'bg-surface-3 before:bg-brand before:absolute before:inset-y-0 before:start-0 before:w-0.75',
                        )}
                      >
                        {item.icon ? (
                          <span aria-hidden className="text-fg-3 shrink-0 [&>svg]:size-4">
                            {item.icon}
                          </span>
                        ) : null}
                        <span className="min-w-0 flex-1 truncate">{item.label}</span>
                        {item.hint ? (
                          <span className="type-caption text-fg-3 shrink-0 tabular-nums">
                            {item.hint}
                          </span>
                        ) : null}
                        {item.shortcut ? <Kbd>{item.shortcut}</Kbd> : null}
                      </div>
                    );
                  })}
                </div>
              ),
            )}
          </div>
          {hints && hints.length > 0 ? (
            <div className="border-border type-caption text-fg-3 flex shrink-0 gap-4 border-t px-4 py-2.5">
              {hints.map((hint) => (
                <span key={hint.keys} className="inline-flex items-center gap-1.5">
                  <Kbd>{hint.keys}</Kbd>
                  {hint.label}
                </span>
              ))}
            </div>
          ) : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
