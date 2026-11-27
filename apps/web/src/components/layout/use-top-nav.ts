import { type Route } from 'next';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { useLiveStatus } from '@sarwa/core';

import { replaceSearchParam, useSearchParam } from '../../lib/browser';
import { useTheme } from '../../lib/theme';

function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  );
}

export function useTopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const urlQuery = useSearchParam('q') ?? '';
  const status = useLiveStatus();
  const { theme, toggle } = useTheme();
  const searchRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const onMarkets = pathname === '/';

  // "/" focuses search from anywhere, as on the canvas (W-Markets).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== '/' || isTyping(event.target)) return;
      event.preventDefault();
      setSearchOpen(true);
      searchRef.current?.focus();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  return {
    pathname,
    status,
    theme,
    toggleTheme: toggle,
    searchRef,
    searchOpen,
    toggleSearch: () => {
      setSearchOpen((open) => !open);
    },
    // On Markets the search box drives the list through ?q=; elsewhere Enter takes you there.
    query: onMarkets ? urlQuery : draft,
    setQuery: (value: string) => {
      if (onMarkets) replaceSearchParam('q', value || null);
      else setDraft(value);
    },
    submit: () => {
      if (onMarkets || !draft) return;
      router.push(`/?q=${encodeURIComponent(draft)}` as Route);
      setDraft('');
    },
  };
}
