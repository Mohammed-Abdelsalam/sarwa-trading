import { usePathname } from 'next/navigation';
import { useState } from 'react';

import { useLiveStatus } from '@sarwa/core';
import { useAdminLive, useAdminSession, useLogout, useServerVersion } from '@sarwa/core/admin';
import { useLocalPreference, usePageLifecycle } from '@sarwa/ui';

import { useTheme } from '../../lib/theme';
import { navKeyFor } from './nav';

const SIDEBAR = ['expanded', 'collapsed'] as const;

export function useAdminShell() {
  const pathname = usePathname();
  const session = useAdminSession();
  const { logout } = useLogout();
  const status = useLiveStatus();
  const { theme, toggle } = useTheme();
  const [sidebar, setSidebar] = useLocalPreference('sarwa.admin.sidebar', SIDEBAR, 'expanded');
  const [navOpen, setNavOpen] = useState(false);
  const version = useServerVersion();
  const { foreground } = usePageLifecycle();
  useAdminLive({ enabled: session.user !== null, foreground });

  return {
    active: navKeyFor(pathname),
    user: session.user,
    status,
    theme,
    collapsed: sidebar === 'collapsed',
    navOpen,
    version,
    actions: {
      toggleTheme: toggle,
      toggleSidebar: () => {
        setSidebar(sidebar === 'collapsed' ? 'expanded' : 'collapsed');
      },
      openNav: () => {
        setNavOpen(true);
      },
      closeNav: () => {
        setNavOpen(false);
      },
      signOut: logout,
    },
  };
}

export type AdminShellModel = ReturnType<typeof useAdminShell>;
