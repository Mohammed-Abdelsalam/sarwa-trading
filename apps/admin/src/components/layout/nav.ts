import {
  Activity,
  Database,
  FileText,
  LayoutGrid,
  List,
  type LucideIcon,
  SlidersHorizontal,
  User,
  Users,
  Zap,
} from 'lucide-react';
import { type Route } from 'next';

import { type AdminMessages } from '@sarwa/core/admin';

export type NavKey = keyof AdminMessages['nav'];

export const NAV: readonly { key: NavKey; href: Route; icon: LucideIcon }[] = [
  { key: 'overview', href: '/overview', icon: LayoutGrid },
  { key: 'market', href: '/market', icon: Activity },
  { key: 'trading', href: '/trading', icon: Zap },
  { key: 'orders', href: '/orders', icon: List },
  { key: 'accounts', href: '/accounts', icon: User },
  { key: 'stocks', href: '/stocks', icon: Database },
  { key: 'config', href: '/config', icon: SlidersHorizontal },
  { key: 'audit', href: '/audit', icon: FileText },
  { key: 'users', href: '/users', icon: Users },
];

export function navKeyFor(pathname: string): NavKey {
  return NAV.find((item) => pathname.startsWith(item.href))?.key ?? 'overview';
}
