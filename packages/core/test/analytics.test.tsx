import { renderHook } from '@testing-library/react';

import { noopAnalytics } from '../src/analytics';
import { useTrack } from '../src/provider';
import { createTestClient, createWrapper } from './utils';

describe('useTrack', () => {
  it('sends events to the analytics provider the app plugged in', () => {
    const client = createTestClient();
    const { Wrapper } = createWrapper(client);
    const { result } = renderHook(() => useTrack(), { wrapper: Wrapper });

    result.current({ name: 'order_rejected', code: 'INSUFFICIENT_FUNDS' });

    expect(client.analytics.track).toHaveBeenCalledWith({
      name: 'order_rejected',
      code: 'INSUFFICIENT_FUNDS',
    });
  });

  it('does nothing by default, so apps without analytics need no setup', () => {
    expect(() => {
      noopAnalytics.track({ name: 'notifications_read', count: 3 });
    }).not.toThrow();
  });
});
