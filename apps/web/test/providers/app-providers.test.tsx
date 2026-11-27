import { render } from '@testing-library/react';

import { type TradingEventListener } from '@sarwa/core';

import { createBrowserClient } from '../../src/lib/client';
import { AppProviders } from '../../src/providers/app-providers';
import { createTestClient } from '../fixtures';

jest.mock('../../src/lib/client', () => ({ createBrowserClient: jest.fn() }));

describe('AppProviders browser notifications', () => {
  it('survives a browser where the Notification constructor throws (Android Chrome)', () => {
    const listeners: TradingEventListener[] = [];
    const client = createTestClient({});
    client.market.onTradingEvent = (listener) => {
      listeners.push(listener);
      return () => undefined;
    };
    jest.mocked(createBrowserClient).mockReturnValue(client);
    const NotificationMock = jest.fn(() => {
      throw new TypeError('Illegal constructor');
    });
    Object.assign(NotificationMock, { permission: 'granted' });
    Object.defineProperty(window, 'Notification', { configurable: true, value: NotificationMock });
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });

    render(<AppProviders preferences={{ locale: 'en', digits: 'latn' }}>app</AppProviders>);
    const notification = {
      id: 'n-1',
      payload: { kind: 'market_notice', message: 'Markets close early' },
      readAt: null,
      createdAt: 1,
    };
    const event = { name: 'notification', payload: { v: 1, notification } };

    expect(() => {
      for (const listener of listeners) listener(event as Parameters<TradingEventListener>[0]);
    }).not.toThrow();
    expect(NotificationMock).toHaveBeenCalledTimes(1);
  });
});
