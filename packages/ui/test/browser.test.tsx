import { act, renderHook } from '@testing-library/react';

import {
  downloadCsv,
  safeLocalStorage,
  toCsv,
  useLocalPreference,
  usePageLifecycle,
  useTheme,
} from '../src';

const VIEWS = ['table', 'grid'] as const;

function mockDarkScheme(matches: boolean) {
  const media = { matches, addEventListener: jest.fn(), removeEventListener: jest.fn() };
  window.matchMedia = jest.fn(() => media) as unknown as typeof window.matchMedia;
  return media;
}

describe('usePageLifecycle', () => {
  it('follows tab visibility and the network state', () => {
    const { result } = renderHook(() => usePageLifecycle());
    expect(result.current).toEqual({ foreground: true, online: true });

    const hidden = jest.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    const offline = jest.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
      window.dispatchEvent(new Event('offline'));
    });

    expect(result.current).toEqual({ foreground: false, online: false });
    hidden.mockRestore();
    offline.mockRestore();
  });
});

describe('useTheme', () => {
  afterEach(() => {
    document.documentElement.classList.remove('light', 'dark');
    window.localStorage.clear();
  });

  it('follows the system scheme until the user picks one', () => {
    mockDarkScheme(true);
    const { result, unmount } = renderHook(() => useTheme('theme'));

    expect(result.current.theme).toBe('dark');
    unmount();
  });

  it('toggles the class on <html>, saves the choice and updates every reader', () => {
    mockDarkScheme(false);
    const { result: first } = renderHook(() => useTheme('theme'));
    const { result: second } = renderHook(() => useTheme('theme'));
    expect(first.current.theme).toBe('light');

    act(() => {
      first.current.toggle();
    });

    expect(document.documentElement).toHaveClass('dark');
    expect(window.localStorage.getItem('theme')).toBe('dark');
    expect(second.current.theme).toBe('dark');

    act(() => {
      second.current.toggle();
    });
    expect(first.current.theme).toBe('light');
  });

  it('still switches when storage is blocked', () => {
    mockDarkScheme(false);
    const blocked = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    const { result } = renderHook(() => useTheme('theme'));

    act(() => {
      result.current.toggle();
    });

    expect(result.current.theme).toBe('dark');
    blocked.mockRestore();
  });
});

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

  it('keeps the choice in memory when storage is blocked', () => {
    const blocked = () => {
      throw new Error('SecurityError');
    };
    const get = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(blocked);
    const set = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(blocked);
    const { result } = renderHook(() => useLocalPreference('pref.blocked', VIEWS, 'table'));

    act(() => {
      result.current[1]('grid');
    });

    expect(result.current[0]).toBe('grid');
    get.mockRestore();
    set.mockRestore();
  });

  it('ignores a saved value that is no longer allowed', () => {
    window.localStorage.setItem('pref.stale', 'cards');

    const { result } = renderHook(() => useLocalPreference('pref.stale', VIEWS, 'table'));

    expect(result.current[0]).toBe('table');
  });
});

describe('safeLocalStorage', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('reads as empty and swallows writes when storage is blocked', async () => {
    const blocked = () => {
      throw new Error('SecurityError');
    };
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(blocked);
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(blocked);

    await expect(safeLocalStorage.getItem('k')).resolves.toBeNull();
    await expect(safeLocalStorage.setItem('k', 'v')).resolves.toBeUndefined();
  });
});

describe('csv', () => {
  it('quotes cells that hold commas, quotes or new lines', () => {
    expect(toCsv(['a', 'b'], [['1,5', 'say "hi"']])).toBe('a,b\n"1,5","say ""hi"""');
  });

  it('downloads a dated UTF-8 file and frees its URL', () => {
    const click = jest
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    URL.createObjectURL = jest.fn(() => 'blob:csv');
    URL.revokeObjectURL = jest.fn();

    downloadCsv('orders', 'a,b');

    expect(click).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:csv');
    click.mockRestore();
  });
});
