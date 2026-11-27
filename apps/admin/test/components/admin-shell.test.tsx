import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AdminShell } from '../../src/components/layout/admin-shell';
import { me, renderWithApi } from '../utils';

const routes = {
  'GET admin/auth/me': me(),
  'GET health': { status: 'ok', uptimeSeconds: 5, version: '1.2.0', commit: '3f9c2ab' },
};

beforeAll(() => {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }) as unknown as MediaQueryList;
});

function renderShell() {
  window.history.replaceState(null, '', '/orders');
  return renderWithApi(
    <AdminShell>
      <h1>Orders board</h1>
    </AdminShell>,
    routes,
  );
}

describe('AdminShell', () => {
  it('shows the signed-in operator, the current board and the server build', async () => {
    renderShell();

    expect(await screen.findByText('maya@minitrading.dev')).toBeInTheDocument();
    expect(await screen.findByText('v1.2.0 · 3f9c2ab')).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Admin navigation' });
    expect(within(nav).getByRole('link', { name: 'Orders' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('main')).toHaveTextContent('Orders board');
    expect(screen.getByRole('button', { name: 'Language' })).toBeInTheDocument();
  });

  it('collapses the sidebar to icons and remembers it', async () => {
    renderShell();

    await userEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }));

    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(window.localStorage.getItem('sarwa.admin.sidebar')).toBe('collapsed');
    await userEvent.click(screen.getByRole('button', { name: 'Expand sidebar' }));
  });

  it('opens the navigation drawer as a modal that Esc closes, returning focus', async () => {
    renderShell();
    const toggle = screen.getByRole('button', { name: 'Admin navigation' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await userEvent.click(toggle);

    const drawer = screen.getByRole('dialog', { name: 'Admin navigation' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(within(drawer).getByRole('button', { name: 'Close' })).toHaveFocus();
    expect(within(drawer).getByRole('link', { name: 'Orders' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    // The page behind the drawer is hidden from assistive tech while it is open.
    expect(screen.queryByRole('main')).not.toBeInTheDocument();

    await userEvent.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await waitFor(() => {
      expect(toggle).toHaveFocus();
    });
  });

  it('closes the drawer once a board is picked', async () => {
    renderShell();

    await userEvent.click(screen.getByRole('button', { name: 'Admin navigation' }));
    const drawer = screen.getByRole('dialog', { name: 'Admin navigation' });
    await userEvent.click(within(drawer).getByRole('link', { name: 'Audit log' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
