import { act, renderHook } from '@testing-library/react';

import { type AppConfig, PERIODS } from '@sarwa/contracts';
import { useAdminConfig, useAdminSession, useAdminStats, useUpdateConfig } from '@sarwa/core/admin';

import { useConfigPage } from '../../src/features/config/use-config-page';
import { mutation, query, session } from '../utils';

jest.mock('@sarwa/core/admin', () => ({
  ...jest.requireActual<object>('@sarwa/core/admin'),
  useAdminSession: jest.fn(),
  useAdminConfig: jest.fn(),
  useAdminStats: jest.fn(),
  useUpdateConfig: jest.fn(),
}));

const config = (overrides: Partial<AppConfig> = {}): AppConfig => ({
  maintenanceMode: false,
  banner: null,
  enabledPeriods: [...PERIODS],
  updatedAt: 1,
  ...overrides,
});

describe('useConfigPage', () => {
  it('saves only the fields this admin edited, keeping changes another admin saved meanwhile', () => {
    const save = mutation();
    jest.mocked(useAdminSession).mockReturnValue(session());
    jest.mocked(useAdminStats).mockReturnValue(query(undefined));
    jest.mocked(useUpdateConfig).mockReturnValue(save as never);
    jest.mocked(useAdminConfig).mockReturnValue(query(config()));
    const { result, rerender } = renderHook(() => useConfigPage());

    act(() => {
      result.current.actions.setMaintenance(true);
    });
    jest
      .mocked(useAdminConfig)
      .mockReturnValue(
        query(
          config({ banner: { message: 'Close at 1pm', tone: 'warning' }, enabledPeriods: ['1D'] }),
        ),
      );
    rerender();

    expect(result.current.draft?.bannerMessage).toBe('Close at 1pm');
    expect(result.current.draft?.enabledPeriods).toEqual(['1D']);
    expect(result.current.changes).toBe(1);
    act(() => {
      result.current.actions.save();
    });
    expect(save.mutate).toHaveBeenCalledWith({ maintenanceMode: true }, expect.anything());
  });
});
