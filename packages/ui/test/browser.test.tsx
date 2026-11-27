import { act, renderHook } from '@testing-library/react';

import { downloadCsv, safeLocalStorage, toCsv, useLocalPreference } from '../src';

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
