import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

import { Sidebar } from '../../src/components/layout/sidebar';
import { renderWithProviders } from '../utils';

function Harness({ version = 'v1.2.0 · 3f9c2ab' }: { version?: string | null }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <Sidebar
      active="trading"
      collapsed={collapsed}
      version={version}
      onToggle={() => {
        setCollapsed((value) => !value);
      }}
    />
  );
}

describe('Sidebar', () => {
  it('lists every board and marks the current one', () => {
    renderWithProviders(<Harness />);

    const nav = screen.getByRole('navigation', { name: 'Admin navigation' });
    expect(nav).toBeInTheDocument();
    expect(screen.getAllByRole('link').map((link) => link.textContent)).toEqual([
      'Overview',
      'Market',
      'Trading',
      'Orders',
      'Customers',
      'Stocks',
      'Config',
      'Audit log',
      'Team',
    ]);
    expect(screen.getByRole('link', { name: 'Team' })).toHaveAttribute('href', '/team');
    expect(screen.getByRole('link', { name: 'Trading' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Audit log' })).toHaveAttribute('href', '/audit');
    expect(screen.getByText('Simulator')).toBeInTheDocument();
    expect(screen.getByText('v1.2.0 · 3f9c2ab')).toBeInTheDocument();
  });

  it('shows no made-up version before the server reports one', () => {
    renderWithProviders(<Harness version={null} />);

    expect(screen.queryByText('Simulator')).not.toBeInTheDocument();
    expect(screen.queryByText(/v\d/)).not.toBeInTheDocument();
  });

  it('collapses to icons while keeping every link named', async () => {
    renderWithProviders(<Harness />);

    await userEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }));

    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.queryByText('Simulator')).not.toBeInTheDocument();
    expect(screen.queryByText('Collapse')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Orders' })).toHaveAttribute('href', '/orders');

    await userEvent.click(screen.getByRole('button', { name: 'Expand sidebar' }));
    expect(screen.getByText('Collapse')).toBeInTheDocument();
  });
});
