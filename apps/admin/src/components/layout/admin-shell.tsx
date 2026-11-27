'use client';

import { type ReactNode, useEffect, useRef } from 'react';

import { useAdminI18n } from '@sarwa/core/admin';

import { ToastHost } from '../common/toasts';
import { NavDrawer, Sidebar } from './sidebar';
import { Topbar } from './topbar';
import { useAdminShell } from './use-admin-shell';

export function AdminShell({ children }: { children: ReactNode }) {
  const shell = useAdminShell();
  const { t, dir } = useAdminI18n();
  const navToggle = useRef<HTMLButtonElement>(null);
  // The drawer has no Radix trigger, so focus goes back to the menu button once it has unmounted.
  const navWasOpen = useRef(false);
  useEffect(() => {
    if (shell.navOpen) navWasOpen.current = true;
    else if (navWasOpen.current) {
      navWasOpen.current = false;
      navToggle.current?.focus();
    }
  }, [shell.navOpen]);

  return (
    <ToastHost>
      <div dir={dir} className="bg-bg flex h-dvh">
        <a
          href="#main"
          className="bg-brand text-on-brand sr-only z-50 rounded-md px-4 py-2 font-semibold focus:not-sr-only focus:absolute focus:start-4 focus:top-3"
        >
          {t.admin.shell.skipToContent}
        </a>
        <Sidebar
          active={shell.active}
          collapsed={shell.collapsed}
          version={shell.version}
          onToggle={shell.actions.toggleSidebar}
          className="max-lg:hidden"
        />
        <NavDrawer
          open={shell.navOpen}
          active={shell.active}
          version={shell.version}
          onClose={shell.actions.closeNav}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar
            active={shell.active}
            user={shell.user}
            status={shell.status}
            theme={shell.theme}
            navOpen={shell.navOpen}
            navToggle={navToggle}
            onOpenNav={shell.actions.openNav}
            onToggleTheme={shell.actions.toggleTheme}
            onSignOut={shell.actions.signOut}
          />
          <main
            id="main"
            className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4 py-5 md:px-8 md:py-7"
          >
            {children}
          </main>
        </div>
      </div>
    </ToastHost>
  );
}
