import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AuditPage } from '../../src/features/audit/audit-page';
import { me, renderWithApi } from '../utils';

describe('AuditPage', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('filters by actor once typing pauses, not on every keystroke', async () => {
    jest.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime, delay: 50 });
    const { calls } = renderWithApi(<AuditPage />, {
      'GET admin/auth/me': me(),
      'GET admin/audit': { items: [], total: 0, page: 1, pageSize: 25 },
    });
    const actors = () =>
      calls.filter((call) => call.path === 'admin/audit').map((call) => call.query.get('actor'));

    const input = await screen.findByRole('searchbox', { name: 'Actor' });
    await user.type(input, 'may');
    expect(input).toHaveValue('may');
    expect(actors()).toEqual([null]);

    act(() => {
      jest.advanceTimersByTime(300);
    });
    await waitFor(() => {
      expect(actors()).toEqual([null, 'may']);
    });
  });

  it('says how long events are kept and toggles the quick action chips', async () => {
    window.history.replaceState(null, '', '/audit');
    const { calls } = renderWithApi(<AuditPage />, {
      'GET admin/auth/me': me(),
      'GET admin/audit': {
        items: [
          {
            id: 'e1',
            actorEmail: 'maya@minitrading.dev',
            action: 'customer.suspend',
            entity: 'Customer · ACC-7F2E9C',
            payload: { reasonCategory: 'abuse' },
            ip: '41.32.•.•',
            createdAt: new Date().toISOString(),
          },
        ],
        total: 1,
        page: 1,
        pageSize: 25,
      },
    });

    expect(await screen.findByText(/retained 400 days/)).toBeInTheDocument();
    expect(await screen.findByText('Customer · ACC-7F2E9C')).toBeInTheDocument();
    const chip = screen.getByRole('button', { name: 'account.reset' });
    expect(chip).toHaveAttribute('aria-pressed', 'false');

    await userEvent.click(chip);
    expect(new URLSearchParams(window.location.search).get('action')).toBe('account.reset');
    expect(chip).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => {
      expect(calls.at(-1)?.query.get('action')).toBe('account.reset');
    });

    await userEvent.click(chip);
    expect(window.location.search).toBe('');
  });

  it('filters by the customer.* group, and an action chip replaces the group', async () => {
    window.history.replaceState(null, '', '/audit');
    const { calls } = renderWithApi(<AuditPage />, {
      'GET admin/auth/me': me(),
      'GET admin/audit': { items: [], total: 0, page: 1, pageSize: 25 },
    });
    const last = () => calls.filter((call) => call.path === 'admin/audit').at(-1)?.query;

    const group = await screen.findByRole('button', { name: 'customer.*' });
    await userEvent.click(group);
    expect(group).toHaveAttribute('aria-pressed', 'true');
    expect(new URLSearchParams(window.location.search).get('group')).toBe('customer');
    await waitFor(() => {
      expect(last()?.get('group')).toBe('customer');
    });

    await userEvent.click(screen.getByRole('button', { name: 'account.reset' }));
    expect(new URLSearchParams(window.location.search).get('group')).toBeNull();
    await waitFor(() => {
      expect(last()?.get('action')).toBe('account.reset');
    });
    expect(last()?.get('group')).toBeNull();

    await userEvent.click(group);
    await userEvent.click(screen.getAllByRole('button', { name: 'Clear' })[0]!);
    expect(window.location.search).toBe('');
  });
});
