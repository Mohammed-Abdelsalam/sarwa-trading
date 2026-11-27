import { act, renderHook } from '@testing-library/react';

import { useCountdown } from '../../src/hooks/time';

describe('useCountdown', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('counts from when the deadline is set, not from when the screen mounted', () => {
    const onDone = jest.fn();
    const { result, rerender } = renderHook(({ until }) => useCountdown(until, onDone), {
      initialProps: { until: null as number | null },
    });
    act(() => {
      jest.advanceTimersByTime(5 * 60_000);
    });

    rerender({ until: Date.now() + 42_000 });
    act(() => {
      jest.advanceTimersByTime(0);
    });
    expect(result.current).toBe(42);

    act(() => {
      jest.advanceTimersByTime(42_000);
    });
    expect(result.current).toBe(0);
    expect(onDone).toHaveBeenCalled();
  });
});
