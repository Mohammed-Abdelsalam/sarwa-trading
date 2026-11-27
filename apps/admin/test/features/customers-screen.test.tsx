import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter } from 'next/navigation';

import { type AdminUser } from '@sarwa/contracts';
import { downloadCsv } from '@sarwa/ui';

import { ToastHost } from '../../src/components/common/toasts';
import { CustomersScreen } from '../../src/features/customers/customers-page';
import { type ApiCall, HttpError, makeCustomer, me, renderWithApi, type Routes } from '../utils';

jest.mock('@sarwa/ui', () => ({
  ...jest.requireActual<object>('@sarwa/ui'),
  downloadCsv: jest.fn(),
}));

const KPIS = {
  registered: 8_412,
  registeredWeekBps: 200,
  signedUpToday: 164,
  signedUpTodayMobileBps: 4_100,
  active24h: 3_207,
  suspended: 37,
  suspendedToday: 2,
  verifiedBps: 8_640,
  verifiedDeltaBps: 110,
  guests24h: 2_930,
  conversionBps: 610,
};

function renderCustomers(
  role: AdminUser['role'],
  routes: Routes = {},
  path = '/customers?status=active',
) {
  window.history.replaceState(null, '', path);
  return renderWithApi(
    <ToastHost>
      <CustomersScreen />
    </ToastHost>,
    {
      'GET admin/auth/me': me(role),
      'GET admin/customers/kpis': KPIS,
      'GET admin/customers': { items: [makeCustomer()], nextCursor: null, total: 1 },
      'GET admin/customers/export.csv': 'handle,email\nACC-7F2E9C,sara.h@example.com',
      ...routes,
    },
  );
}

describe('Customers screen', () => {
  it('shows the KPIs with shares of registered customers', async () => {
    renderCustomers('ADMIN');

    expect(await screen.findByText('38.12% of registered')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Suspended · 37' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Sara Hassan' })).toHaveAttribute(
      'href',
      '/customers/ACC-7F2E9C',
    );
  });

  it('exports the CSV for the current filters and hands it to the download', async () => {
    const { calls } = renderCustomers('ADMIN');

    await screen.findByText('Sara Hassan');
    await userEvent.click(screen.getByRole('button', { name: 'Export CSV' }));

    await waitFor(() => {
      expect(downloadCsv).toHaveBeenCalledWith(
        'customers',
        'handle,email\nACC-7F2E9C,sara.h@example.com',
      );
    });
    expect(screen.getByText('Customer export downloaded')).toBeInTheDocument();
    const exported = calls.find((call) => call.path === 'admin/customers/export.csv');
    expect(exported?.query.get('status')).toBe('active');
  });

  it('keeps export and row actions locked for viewers', async () => {
    const { calls } = renderCustomers('VIEWER', {
      'GET admin/customers': {
        items: [makeCustomer({ email: 's•••@example.com' })],
        nextCursor: null,
        total: 1,
      },
    });

    expect(await screen.findByText('s•••@example.com')).toBeInTheDocument();
    const exportButton = await screen.findByRole('button', { name: 'Export CSV' });
    await waitFor(() => {
      expect(exportButton).toHaveAttribute('aria-disabled', 'true');
    });
    await userEvent.click(exportButton);
    expect(screen.getByRole('button', { name: 'Actions for Sara Hassan' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(calls.map((call) => call.path)).not.toContain('admin/customers/export.csv');
  });

  it('opens a row action on the customer page, where the reason is asked', async () => {
    renderCustomers('ADMIN');

    await userEvent.click(await screen.findByRole('button', { name: 'Actions for Sara Hassan' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Suspend customer…' }));

    expect(useRouter().push).toHaveBeenCalledWith('/customers/ACC-7F2E9C?action=suspend');
  });

  it('quotes the request id when the list fails to load', async () => {
    renderCustomers('ADMIN', { 'GET admin/customers': new HttpError(500, 'req-42') });

    expect(await screen.findByText("Couldn't load customers")).toBeInTheDocument();
    expect(screen.getByText('500 · GET /admin/customers · req-42')).toBeInTheDocument();
  });

  it('copies the web app link while there are no customers yet', async () => {
    const user = userEvent.setup();
    renderCustomers(
      'ADMIN',
      { 'GET admin/customers': { items: [], nextCursor: null, total: 0 } },
      '/customers',
    );

    await user.click(await screen.findByRole('button', { name: 'Copy app link' }));

    expect(await screen.findByRole('button', { name: 'App link copied' })).toBeInTheDocument();
    await expect(navigator.clipboard.readText()).resolves.toBe('http://localhost:3000');
  });

  it('asks for the next cursor page as the end of the list comes into view', async () => {
    const original = globalThis.IntersectionObserver;
    globalThis.IntersectionObserver = class {
      constructor(callback: IntersectionObserverCallback) {
        callback(
          [{ isIntersecting: true } as IntersectionObserverEntry],
          this as unknown as IntersectionObserver,
        );
      }
      observe() {}
      disconnect() {}
    } as unknown as typeof IntersectionObserver;
    const { calls } = renderCustomers('ADMIN', {
      'GET admin/customers': (call: ApiCall) =>
        call.query.get('cursor') === 'c2'
          ? { items: [makeCustomer({ id: 'c2', name: 'Omar Fathy' })], nextCursor: null, total: 2 }
          : { items: [makeCustomer()], nextCursor: 'c2', total: 2 },
    });

    const table = await screen.findByRole('table', { name: 'Customers' });
    expect(await within(table).findByText('Omar Fathy')).toBeInTheDocument();
    expect(calls.filter((call) => call.path === 'admin/customers')).toHaveLength(2);
    globalThis.IntersectionObserver = original;
  });
});
