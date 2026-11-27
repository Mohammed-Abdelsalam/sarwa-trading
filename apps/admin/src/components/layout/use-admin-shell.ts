import { usePathname } from 'next/navigation';

import { useLiveStatus } from '@sarwa/core';
import { useAdminLive, useAdminSession, useLogout, useServerVersion } from '@sarwa/core/admin';

import { useLocalPreference } from '../../lib/browser';
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
  const version = useServerVersion();
  useAdminLive(session.user !== null);

  return {
    active: navKeyFor(pathname),
    user: session.user,
    status,
    theme,
    collapsed: sidebar === 'collapsed',
    version,
    actions: {
      toggleTheme: toggle,
      toggleSidebar: () => {
        setSidebar(sidebar === 'collapsed' ? 'expanded' : 'collapsed');
      },
      signOut: logout,
    },
  };
}

export type AdminShellModel = ReturnType<typeof useAdminShell>;
