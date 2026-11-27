import { act, renderHook, waitFor } from '@testing-library/react';

import { usePreference } from '../../src/hooks';
import { createMemoryStorage, createTestClient, createWrapper } from '../utils';

const TYPES = ['area', 'candle'] as const;

function renderPreference(stored: Record<string, string> = {}) {
  const storage = createMemoryStorage(stored);
  const { Wrapper } = createWrapper({ ...createTestClient(), storage });
  const view = renderHook(() => usePreference('chart.type', TYPES, 'area'), { wrapper: Wrapper });
  return { ...view, storage };
}

describe('usePreference', () => {
  it('waits for storage, then returns the saved choice', async () => {
    const { result } = renderPreference({ 'chart.type': 'candle' });
    expect(result.current.isLoaded).toBe(false);

    await waitFor(() => {
      expect(result.current.isLoaded).toBe(true);
    });
    expect(result.current.value).toBe('candle');
  });

  it('falls back when an unknown value is saved', async () => {
    const { result } = renderPreference({ 'chart.type': 'bars' });

    await waitFor(() => {
      expect(result.current.isLoaded).toBe(true);
    });
    expect(result.current.value).toBe('area');
  });

  it('applies a new choice at once and saves it', async () => {
    const { result, storage } = renderPreference();
    await waitFor(() => {
      expect(result.current.isLoaded).toBe(true);
    });

    act(() => {
      result.current.setValue('candle');
    });

    await waitFor(() => {
      expect(result.current.value).toBe('candle');
    });
    await expect(storage.getItem('chart.type')).resolves.toBe('candle');
  });
});
