import { type Route } from 'next';
import { usePathname, useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import { marketPill, useLiveStatus, useSession, useTradingStatus } from '@sarwa/core';

import { useOpenGate } from '../../features/gating/auth-ui';
import { isTyping, useModKey, useWindowKeyDown } from '../../lib/browser';
import { useCopy } from '../../lib/i18n';
import { useTheme } from '../../lib/theme';

const SEQUENCE_MS = 1_000;

// "G then O" jumps to Orders, as listed in the command palette.
export const GO_TO: Partial<Record<string, Route>> = {
  h: '/',
  m: '/markets',
  p: '/portfolio',
  w: '/watchlist',
  o: '/orders',
  a: '/alerts',
};

export function isSectionActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  if (href === '/markets') return pathname.startsWith('/markets') || pathname.startsWith('/stocks');
  return pathname.startsWith(href);
}

export function useTopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const copy = useCopy();
  const { t, m } = copy;
  const live = useLiveStatus();
  const session = useTradingStatus().data?.session;
  const { toggle: toggleTheme } = useTheme();
  const mod = useModKey();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const pendingGo = useRef(0);
  const { status } = useSession();
  const openGate = useOpenGate();

  useWindowKeyDown((event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      setPaletteOpen((open) => !open);
      return;
    }
    if (event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return;
    const go = Date.now() - pendingGo.current < SEQUENCE_MS ? GO_TO[event.key] : undefined;
    pendingGo.current = 0;
    if (go) {
      router.push(go);
    } else if (event.key === '/') {
      event.preventDefault();
      const search = document.getElementById('markets-search');
      if (search) search.focus();
      else setPaletteOpen(true);
    } else if (event.shiftKey && event.key.toLowerCase() === 'd') {
      event.preventDefault();
      toggleTheme();
    } else if (event.key === 'g') {
      pendingGo.current = Date.now();
    }
  });

  const links = [
    { href: '/', label: t.nav.home },
    { href: '/markets', label: t.nav.markets },
    { href: '/portfolio', label: t.nav.portfolio },
    { href: '/watchlist', label: t.nav.watchlist },
    { href: '/orders', label: t.nav.orders },
  ].map((link) => ({
    href: link.href as Route,
    label: link.label,
    active: isSectionActive(pathname, link.href),
  }));

  return {
    links,
    live,
    // Nothing account-shaped renders until the session is known, so neither set flashes.
    account: status === 'authenticated' ? 'member' : status === 'loading' ? null : 'guest',
    guest: {
      onCreate: () => {
        openGate({ kind: 'notifications' });
      },
      onSignIn: () => {
        openGate({ kind: 'notifications' }, 'signIn');
      },
    },
    pill: marketPill(live, session, copy),
    palette: { open: paletteOpen, setOpen: setPaletteOpen, shortcut: `${mod} K` },
    labels: {
      main: t.nav.main,
      sections: m.nav.sections,
      search: t.common.search,
      searchA11y: m.nav.commandA11y,
    },
  };
}
