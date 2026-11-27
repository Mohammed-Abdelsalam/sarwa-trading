import { fireEvent, render, screen } from '@testing-library/react-native';

import { type AppNotice, useAppNotices } from '@sarwa/core';

import { AppBanners } from '../../../src/components/layout/app-banners';

jest.mock('@sarwa/core', () => ({
  ...jest.requireActual<object>('@sarwa/core'),
  useAppNotices: jest.fn(),
}));

const mockedNotices = jest.mocked(useAppNotices);

const reconnecting: AppNotice = {
  kind: 'reconnecting',
  tone: 'warn',
  title: 'Reconnecting…',
  message: 'Prices may be a few seconds behind.',
  meta: 'try 3',
  dismissible: false,
};

const remote: AppNotice = {
  kind: 'remote',
  tone: 'brand',
  message: 'Markets close early today at 1:00 PM ET.',
  dismissible: true,
};

describe('AppBanners', () => {
  it('renders nothing when there is no notice', async () => {
    mockedNotices.mockReturnValue({ notices: [], dismiss: jest.fn() });
    await render(<AppBanners />);

    expect(screen.queryByRole('alert')).not.toBeOnTheScreen();
  });

  it('shows the bold title, the message and the retry count of a connection notice', async () => {
    mockedNotices.mockReturnValue({ notices: [reconnecting], dismiss: jest.fn() });
    await render(<AppBanners />);

    expect(screen.getByText('Reconnecting… ')).toBeOnTheScreen();
    expect(screen.getByText(/Prices may be a few seconds behind\./)).toBeOnTheScreen();
    expect(screen.getByText('try 3')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Dismiss message' })).not.toBeOnTheScreen();
  });

  it('lets the user dismiss a remote message', async () => {
    const dismiss = jest.fn();
    mockedNotices.mockReturnValue({ notices: [remote], dismiss });
    await render(<AppBanners />);

    await fireEvent.press(screen.getByRole('button', { name: 'Dismiss message' }));
    expect(dismiss).toHaveBeenCalledWith(remote);
  });
});
