import { ChevronDown, LogOut, Moon, Sun } from 'lucide-react';
import { type Route } from 'next';
import Link from 'next/link';

import { type AdminUser } from '@sarwa/contracts';
import { type LiveStatus, useI18n } from '@sarwa/core';
import {
  Breadcrumbs,
  ConnectionBadge,
  IconButton,
  type LinkComponent,
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuTrigger,
} from '@sarwa/ui';

import { RoleBadge, UserAvatar } from '../common/identity';
import { type NavKey } from './nav';

const AppLink: LinkComponent = ({ href, ...props }) => <Link href={href as Route} {...props} />;

export function Topbar({
  active,
  user,
  status,
  theme,
  onToggleTheme,
  onSignOut,
}: {
  active: NavKey;
  user: AdminUser | null;
  status: LiveStatus;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onSignOut: () => void;
}) {
  const { t } = useI18n();
  return (
    <header className="border-border bg-surface flex h-16 shrink-0 items-center gap-4 border-b px-6">
      <Breadcrumbs
        link={AppLink}
        items={[{ label: t.admin.shell.admin, href: '/overview' }, { label: t.admin.nav[active] }]}
      />
      <div className="flex-1" />
      <ConnectionBadge status={status} label={t.admin.shell.live[status]} />
      <IconButton label={t.admin.shell.switchTheme} onClick={onToggleTheme}>
        {theme === 'dark' ? (
          <Sun aria-hidden className="size-5" />
        ) : (
          <Moon aria-hidden className="size-5" />
        )}
      </IconButton>
      <span aria-hidden className="bg-border h-7 w-px" />
      {user ? (
        <Menu>
          <MenuTrigger
            aria-label={t.admin.shell.accountMenu}
            className="hover:bg-surface-3 focus-visible:outline-focus flex h-11 cursor-pointer items-center gap-2.5 rounded-md ps-1.5 pe-2 focus-visible:outline-2"
          >
            <UserAvatar name={user.name} />
            <span className="flex flex-col items-start gap-0.5">
              <span className="type-sm text-fg font-semibold">{user.email}</span>
              <RoleBadge role={user.role} />
            </span>
            <ChevronDown aria-hidden className="text-fg-3 size-4" />
          </MenuTrigger>
          <MenuContent>
            <MenuLabel>{user.name}</MenuLabel>
            <MenuSeparator />
            <MenuItem icon={<LogOut />} onSelect={onSignOut}>
              {t.admin.shell.signOut}
            </MenuItem>
          </MenuContent>
        </Menu>
      ) : null}
    </header>
  );
}
