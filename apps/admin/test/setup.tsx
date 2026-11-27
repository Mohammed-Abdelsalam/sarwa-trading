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

// Radix measures popovers and sliders; jsdom has no layout, so a no-op observer is enough.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverStub;

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn(), refresh: jest.fn() }),
  usePathname: () => '/overview',
  useSearchParams: () => new URLSearchParams(),
}));
