import { act, renderHook } from '@testing-library/react';

import { useAuditLog } from '@sarwa/core/admin';

import { useAuditPage } from '../../src/features/audit/use-audit-page';
import { query } from '../utils';

jest.mock('@sarwa/core/admin', () => ({
  ...jest.requireActual<object>('@sarwa/core/admin'),
  useAuditLog: jest.fn(),
}));

describe('useAuditPage', () => {
  it('filters by actor once typing pauses, not on every keystroke', () => {
    jest.useFakeTimers();
    jest.mocked(useAuditLog).mockReturnValue(query({ items: [], total: 0, page: 1, pageSize: 25 }));
    const { result } = renderHook(() => useAuditPage());
    const actors = () => jest.mocked(useAuditLog).mock.calls.map(([filter]) => filter.actor);

    for (const text of ['m', 'ma', 'may']) {
      act(() => {
        result.current.actions.setActor(text);
      });
    }
    expect(result.current.actor).toBe('may');
    expect(actors()).not.toContain('m');
    expect(actors()).not.toContain('ma');

    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(actors().at(-1)).toBe('may');
    expect(actors()).not.toContain('ma');
    jest.useRealTimers();
  });
});
