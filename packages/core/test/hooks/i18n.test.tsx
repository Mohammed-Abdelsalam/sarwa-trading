import { act, renderHook, waitFor } from '@testing-library/react';

import { useI18n } from '../../src/hooks';
import { createMemoryStorage, createTestClient, createWrapper } from '../utils';

function renderI18n(stored: Record<string, string> = {}) {
  const { Wrapper } = createWrapper({
    ...createTestClient(),
    storage: createMemoryStorage(stored),
  });
  return renderHook(() => useI18n(), { wrapper: Wrapper });
}

describe('useI18n', () => {
  it('starts in English, left to right, with Western digits', async () => {
    const { result } = renderI18n();
    await waitFor(() => {
      expect(result.current.isLoaded).toBe(true);
    });

    expect(result.current).toMatchObject({ locale: 'en', digits: 'latn', dir: 'ltr' });
    expect(result.current.t.nav.portfolio).toBe('Portfolio');
  });

  it('switches to Arabic right to left and keeps the choice', async () => {
    const { result } = renderI18n();
    await waitFor(() => {
      expect(result.current.isLoaded).toBe(true);
    });

    act(() => {
      result.current.setLocale('ar');
      result.current.setDigits('arab');
    });

    await waitFor(() => {
      expect(result.current.dir).toBe('rtl');
    });
    expect(result.current.f.number(231)).toBe('٢٣١');
  });

  it('words a rejection for the symbol in the current language', async () => {
    const { result } = renderI18n({ 'sarwa.locale': 'en' });
    await waitFor(() => {
      expect(result.current.isLoaded).toBe(true);
    });

    expect(result.current.rejection({ code: 'SYMBOL_HALTED' }, 'TSLA').reason).toBe(
      'Trading paused — TSLA halted',
    );
  });
});
