import { act, renderHook } from '@testing-library/react';

import { replaceSearchParam, useLocalPreference, useSearchParam } from '../../src/lib/browser';

jest.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }));

const VIEWS = ['table', 'grid'] as const;

describe('useLocalPreference', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('returns the fallback when nothing is saved', () => {
    const { result } = renderHook(() => useLocalPreference('pref.empty', VIEWS, 'table'));

    expect(result.current[0]).toBe('table');
  });

  it('saves the choice and shares it with other readers', () => {
    const { result: writer } = renderHook(() => useLocalPreference('pref.shared', VIEWS, 'table'));
    const { result: reader } = renderHook(() => useLocalPreference('pref.shared', VIEWS, 'table'));

    act(() => {
      writer.current[1]('grid');
    });

    expect(window.localStorage.getItem('pref.shared')).toBe('grid');
    expect(reader.current[0]).toBe('grid');
  });

  it('ignores a saved value that is no longer allowed', () => {
    window.localStorage.setItem('pref.stale', 'cards');

    const { result } = renderHook(() => useLocalPreference('pref.stale', VIEWS, 'table'));

    expect(result.current[0]).toBe('table');
  });
});

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
