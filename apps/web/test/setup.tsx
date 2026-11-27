import { type AnchorHTMLAttributes } from 'react';

// next/link needs the App Router context, which jsdom doesn't have; a plain anchor keeps href and a11y.
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({
    href,
    children,
    scroll: _scroll,
    prefetch: _prefetch,
    ...props
  }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    href: string | { pathname: string };
    scroll?: boolean;
    prefetch?: boolean;
  }) => (
    <a href={typeof href === 'string' ? href : href.pathname} {...props}>
      {children}
    </a>
  ),
}));
