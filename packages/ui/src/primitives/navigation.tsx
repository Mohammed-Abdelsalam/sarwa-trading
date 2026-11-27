import { ChevronRight, TrendingUp } from 'lucide-react';
import { type ComponentProps, type ComponentType, type ReactNode } from 'react';

import { cn } from '../lib/cn';

export type LinkComponent = ComponentType<{
  href: string;
  className?: string;
  children: ReactNode;
}>;

const PlainLink: LinkComponent = (props) => <a {...props} />;

export function Logo({ showName = true, className }: { showName?: boolean; className?: string }) {
  return (
    <span className={cn('type-logo text-fg inline-flex items-center gap-2.5', className)}>
      <span
        aria-hidden
        className="bg-brand text-on-brand rounded-mark size-7.5 grid place-items-center"
      >
        <TrendingUp className="size-4" />
      </span>
      {showName ? 'Mini Trading' : <span className="sr-only">Mini Trading</span>}
    </span>
  );
}

export interface Crumb {
  label: string;
  href?: string;
}

export function Breadcrumbs({
  items,
  link: Link = PlainLink,
  className,
}: {
  items: Crumb[];
  link?: LinkComponent;
  className?: string;
}) {
  return (
    <nav aria-label="Breadcrumb" className={cn('type-sm text-fg-3', className)}>
      <ol className="flex items-center gap-2">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={item.label} className="flex items-center gap-2">
              {last || !item.href ? (
                <span
                  aria-current={last ? 'page' : undefined}
                  className={last ? 'text-fg font-semibold' : undefined}
                >
                  {item.label}
                </span>
              ) : (
                <Link href={item.href} className="hover:text-fg-2">
                  {item.label}
                </Link>
              )}
              {last ? null : <ChevronRight aria-hidden className="size-3.5" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function Kbd({ className, ...props }: ComponentProps<'kbd'>) {
  return (
    <kbd
      className={cn(
        'type-kbd border-border-strong bg-surface text-fg-3 rounded-sm border px-1.5 py-1',
        className,
      )}
      {...props}
    />
  );
}
