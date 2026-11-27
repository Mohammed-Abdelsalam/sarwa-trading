'use client';

import { type ReactNode } from 'react';

import { useI18n } from '@sarwa/core';

import { Sidebar } from './sidebar';
import { Topbar } from './topbar';
import { useAdminShell } from './use-admin-shell';

export function AdminShell({ children }: { children: ReactNode }) {
  const shell = useAdminShell();
  const { t, dir } = useI18n();

  return (
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
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          active={shell.active}
          user={shell.user}
          status={shell.status}
          theme={shell.theme}
          onToggleTheme={shell.actions.toggleTheme}
          onSignOut={shell.actions.signOut}
        />
        <main id="main" className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-8 py-7">
          {children}
        </main>
      </div>
    </div>
  );
}
