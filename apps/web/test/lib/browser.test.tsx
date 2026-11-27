import { act, renderHook } from '@testing-library/react';

import { replaceSearchParam, useSearchParam } from '../../src/lib/browser';

jest.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }));

describe('replaceSearchParam', () => {
  afterEach(() => {
    window.history.replaceState(null, '', '/');
  });

  it('sets and removes a query param without navigating', () => {
    replaceSearchParam('q', 'apple');
    expect(window.location.search).toBe('?q=apple');

    replaceSearchParam('q', null);
    expect(window.location.search).toBe('');
  });

  it('passes null history state so Next syncs useSearchParams', () => {
    window.history.replaceState({ __NA: true }, '', '/');
    const replaceState = jest.spyOn(window.history, 'replaceState');

    replaceSearchParam('period', '1M');

    expect(replaceState).toHaveBeenCalledWith(null, '', new URL('http://localhost/?period=1M'));
  });

  it('updates readers of the param in the same render', () => {
    const { result } = renderHook(() => useSearchParam('symbol'));
    expect(result.current).toBeNull();

    act(() => {
      replaceSearchParam('symbol', 'MSFT');
    });

    expect(result.current).toBe('MSFT');
  });
});
