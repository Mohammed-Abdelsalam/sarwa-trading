import { Bell, ChevronDown, Moon, Settings, Sun, User } from 'lucide-react';

import {
  Badge,
  Button,
  Kbd,
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuTrigger,
} from '@sarwa/ui';

import { useAccountMenu } from './use-account-menu';

export function AccountMenu() {
  const menu = useAccountMenu();
  const { labels, actions } = menu;

  return (
    <Menu>
      <MenuTrigger asChild>
        <Button variant="ghost" className="h-10 gap-2 px-1.5" aria-label={labels.trigger}>
          <span
            aria-hidden
            className="bg-brand-subtle text-brand-fg grid size-8 place-items-center rounded-full"
          >
            <User className="size-4" />
          </span>
          <Badge tone="outline" className="h-5 text-[0.625rem]">
            {labels.paper}
          </Badge>
          <ChevronDown aria-hidden className="text-fg-3 size-3.5" />
        </Button>
      </MenuTrigger>
      <MenuContent className="w-72">
        <MenuLabel>{labels.account}</MenuLabel>
        <div className="flex flex-col gap-1.5 px-2.5 pb-2">
          {menu.handle ? <span className="type-mono text-fg-3 text-xs">{menu.handle}</span> : null}
          <div className="type-sm flex justify-between">
            <span className="text-fg-2">{labels.equity}</span>
            <b className="tabular-nums">{menu.equity ?? '—'}</b>
          </div>
          <div className="type-sm flex justify-between">
            <span className="text-fg-2">{labels.buyingPower}</span>
            <b className="tabular-nums">{menu.buyingPower ?? '—'}</b>
          </div>
          <span className="type-caption text-fg-3">{labels.disclosure}</span>
        </div>
        <MenuSeparator />
        <MenuItem
          icon={<Settings />}
          onSelect={() => {
            actions.go('/settings');
          }}
        >
          {labels.settings}
        </MenuItem>
        <MenuItem
          icon={<Bell />}
          onSelect={() => {
            actions.go('/alerts');
          }}
        >
          {labels.alerts}
        </MenuItem>
        <MenuItem icon={menu.theme === 'dark' ? <Sun /> : <Moon />} onSelect={actions.toggleTheme}>
          <span className="flex-1">{labels.theme}</span>
          <Kbd>⇧ D</Kbd>
        </MenuItem>
        <MenuSeparator />
        <MenuLabel>{labels.language}</MenuLabel>
        <MenuRadioGroup
          value={menu.locale}
          onValueChange={(value) => {
            const option = menu.languages.find((o) => o.value === value);
            if (option) actions.setLocale(option.value);
          }}
        >
          {menu.languages.map((option) => (
            <MenuRadioItem key={option.value} value={option.value} lang={option.value}>
              {option.label}
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
        <MenuLabel>{labels.digits}</MenuLabel>
        <MenuRadioGroup
          value={menu.digits}
          onValueChange={(value) => {
            const option = menu.digitOptions.find((o) => o.value === value);
            if (option) actions.setDigits(option.value);
          }}
        >
          {menu.digitOptions.map((option) => (
            <MenuRadioItem key={option.value} value={option.value}>
              {option.label}
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
      </MenuContent>
    </Menu>
  );
}
