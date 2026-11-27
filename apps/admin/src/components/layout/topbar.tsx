import { ChevronDown, LogOut, Menu as MenuIcon, Moon, Sun } from 'lucide-react';
import { type Route } from 'next';
import Link from 'next/link';
import { type Ref } from 'react';

import { type AdminUser } from '@sarwa/contracts';
import { type LiveStatus } from '@sarwa/core';
import { useAdminI18n } from '@sarwa/core/admin';
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
import { LanguageMenu } from './language-menu';
import { type NavKey } from './nav';

const AppLink: LinkComponent = ({ href, ...props }) => <Link href={href as Route} {...props} />;

export function Topbar({
  active,
  user,
  status,
  theme,
  navOpen,
  navToggle,
  onOpenNav,
  onToggleTheme,
  onSignOut,
}: {
  active: NavKey;
  user: AdminUser | null;
  status: LiveStatus;
  theme: 'light' | 'dark';
  navOpen: boolean;
  navToggle: Ref<HTMLButtonElement>;
  onOpenNav: () => void;
  onToggleTheme: () => void;
  onSignOut: () => void;
}) {
  const { t } = useAdminI18n();
  return (
    <header className="border-border bg-surface flex h-16 shrink-0 items-center gap-2 border-b px-3 sm:gap-4 md:px-6">
      <IconButton
        ref={navToggle}
        label={t.admin.shell.navLabel}
        aria-haspopup="dialog"
        aria-expanded={navOpen}
        onClick={onOpenNav}
        className="lg:hidden"
      >
        <MenuIcon aria-hidden className="size-5" />
      </IconButton>
      <Breadcrumbs
        className="max-sm:hidden"
        link={AppLink}
        items={[{ label: t.admin.shell.admin, href: '/overview' }, { label: t.admin.nav[active] }]}
      />
      <div className="flex-1" />
      <ConnectionBadge
        status={status}
        label={t.admin.shell.live[status]}
        className="max-sm:sr-only"
      />
      <LanguageMenu />
      <IconButton label={t.admin.shell.switchTheme} onClick={onToggleTheme}>
        {theme === 'dark' ? (
          <Sun aria-hidden className="size-5" />
        ) : (
          <Moon aria-hidden className="size-5" />
        )}
      </IconButton>
      <span aria-hidden className="bg-border h-7 w-px max-sm:hidden" />
      {user ? (
        <Menu>
          <MenuTrigger
            aria-label={t.admin.shell.accountMenu}
            className="hover:bg-surface-3 focus-visible:outline-focus flex h-11 cursor-pointer items-center gap-2.5 rounded-md ps-1.5 pe-2 focus-visible:outline-2"
          >
            <UserAvatar name={user.name} />
            <span className="flex flex-col items-start gap-0.5 max-md:hidden">
              <span className="type-sm text-fg font-semibold">{user.email}</span>
              <RoleBadge role={user.role} />
            </span>
            <ChevronDown aria-hidden className="text-fg-3 size-4 max-md:hidden" />
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
