import { Search } from 'lucide-react';
import Link from 'next/link';

import { cn, IconButton, Kbd, Logo, MarketStatusPill } from '@sarwa/ui';

import { AccountMenu } from './account-menu';
import { CommandMenu } from './command-menu';
import { NotificationCenter } from './notification-center';
import { useTopNav } from './use-top-nav';

const focusRing = 'focus-visible:outline-focus focus-visible:outline-2';

export function TopNav() {
  const nav = useTopNav();
  const { labels, palette } = nav;

  const sectionLinks = (className: string) =>
    nav.links.map((link) => (
      <Link
        key={link.href}
        href={link.href}
        aria-current={link.active ? 'page' : undefined}
        className={cn(
          'text-fg-2 hover:text-fg -mb-px inline-flex shrink-0 items-center border-b-2 border-transparent text-sm font-semibold',
          focusRing,
          className,
          link.active && 'border-brand text-fg',
        )}
      >
        {link.label}
      </Link>
    ));

  return (
    <header className="border-border bg-surface sticky top-0 z-30 border-b">
      <nav
        aria-label={labels.main}
        className="flex h-16 items-center gap-2 ps-4 pe-3 md:gap-4 md:px-6"
      >
        <Link href="/" className={cn('rounded-sm', focusRing)}>
          <Logo className="max-xl:[&>span:last-child]:sr-only" />
        </Link>
        <div className="ms-2 hidden items-stretch gap-5.5 self-stretch md:flex">
          {sectionLinks('')}
        </div>
        <div className="flex-1" />
        <button
          type="button"
          aria-label={labels.searchA11y}
          onClick={() => {
            palette.setOpen(true);
          }}
          className={cn(
            'border-border-strong bg-surface dark:bg-surface-2 hover:border-fg-3 type-sm text-fg-3 hidden h-9 w-70 cursor-pointer items-center gap-2.5 rounded-md border px-3 lg:flex',
            focusRing,
          )}
        >
          <Search aria-hidden className="size-4 shrink-0" />
          <span className="flex-1 truncate text-start">{labels.search}</span>
          <Kbd>{palette.shortcut}</Kbd>
        </button>
        <IconButton
          label={labels.searchA11y}
          className="lg:hidden"
          onClick={() => {
            palette.setOpen(true);
          }}
        >
          <Search aria-hidden className="size-5" />
        </IconButton>
        <span data-live={nav.live}>
          <MarketStatusPill state={nav.pill.state} label={nav.pill.label} compact />
        </span>
        <NotificationCenter />
        <AccountMenu />
      </nav>
      {/* The fade at the inline end hints that more sections scroll into view. */}
      <div
        role="navigation"
        aria-label={labels.sections}
        className="flex gap-1 overflow-x-auto [mask-image:linear-gradient(to_right,black_85%,transparent)] ps-3 pe-10 md:hidden rtl:[mask-image:linear-gradient(to_left,black_85%,transparent)]"
      >
        {sectionLinks('h-10 px-3')}
      </div>
      <CommandMenu open={palette.open} onOpenChange={palette.setOpen} />
    </header>
  );
}
