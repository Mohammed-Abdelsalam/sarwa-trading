import { Moon, Search, Sun } from 'lucide-react';
import Link from 'next/link';
import { type RefObject } from 'react';

import { cn, ConnectionBadge, IconButton, Input, Kbd, Logo } from '@sarwa/ui';

import { useTopNav } from './use-top-nav';

const LINKS = [
  { href: '/', label: 'Markets' },
  { href: '/watchlist', label: 'Watchlist' },
] as const;

type NavModel = Omit<ReturnType<typeof useTopNav>, 'searchRef'>;

function SearchBox({
  nav,
  inputRef,
  className,
}: {
  nav: NavModel;
  inputRef?: RefObject<HTMLInputElement | null>;
  className?: string;
}) {
  return (
    <form
      role="search"
      className={cn('relative', className)}
      onSubmit={(event) => {
        event.preventDefault();
        nav.submit();
      }}
    >
      <Input
        ref={inputRef}
        icon={<Search />}
        value={nav.query}
        onChange={(event) => {
          nav.setQuery(event.target.value);
        }}
        placeholder="Search symbol or company"
        aria-label="Search"
        autoComplete="off"
        className="pr-10"
      />
      <Kbd className="absolute top-1/2 right-2 -translate-y-1/2">/</Kbd>
    </form>
  );
}

export function TopNav() {
  const { searchRef, ...nav } = useTopNav();
  const isActive = (href: string) =>
    href === '/' ? nav.pathname === '/' : nav.pathname.startsWith(href);

  return (
    <header className="border-border bg-surface sticky top-0 z-30 border-b">
      <nav aria-label="Main" className="flex h-16 items-center gap-2 pr-3 pl-4 md:gap-5 md:px-6">
        <Link href="/" className="focus-visible:outline-focus rounded-sm focus-visible:outline-2">
          <Logo className="max-md:[&>span:last-child]:sr-only" />
        </Link>
        <div className="ml-3 hidden items-stretch gap-6 self-stretch md:flex">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive(link.href) ? 'page' : undefined}
              className={cn(
                'text-fg-2 hover:text-fg -mb-px inline-flex items-center border-b-2 border-transparent text-sm font-semibold',
                isActive(link.href) && 'border-brand text-fg',
              )}
            >
              {link.label}
            </Link>
          ))}
        </div>
        <div className="flex-1" />
        <SearchBox nav={nav} inputRef={searchRef} className="hidden w-60 md:block xl:w-85" />
        <IconButton
          label="Search"
          className="md:hidden"
          aria-expanded={nav.searchOpen}
          onClick={nav.toggleSearch}
        >
          <Search aria-hidden className="size-5" />
        </IconButton>
        <ConnectionBadge status={nav.status} />
        <IconButton label="Switch theme" onClick={nav.toggleTheme}>
          {nav.theme === 'dark' ? (
            <Sun aria-hidden className="size-5" />
          ) : (
            <Moon aria-hidden className="size-5" />
          )}
        </IconButton>
      </nav>
      {nav.searchOpen ? (
        <SearchBox nav={nav} inputRef={searchRef} className="px-4 pb-3 md:hidden" />
      ) : null}
      <div className="flex gap-1 px-3 md:hidden" role="navigation" aria-label="Sections">
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            aria-current={isActive(link.href) ? 'page' : undefined}
            className={cn(
              'text-fg-2 -mb-px inline-flex h-10 items-center border-b-2 border-transparent px-3 text-sm font-semibold',
              isActive(link.href) && 'border-brand text-fg',
            )}
          >
            {link.label}
          </Link>
        ))}
      </div>
    </header>
  );
}
