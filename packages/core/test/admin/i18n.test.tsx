import { renderHook, waitFor } from '@testing-library/react';

import { createFormatter, getAdminMessages, getMessages } from '@sarwa/i18n';

import { haltDurationLabel, useAdminI18n } from '../../src/admin/i18n';
import { createTestClient, createWrapper } from '../utils';

describe('admin copy', () => {
  it('adds the dashboard catalog under t.admin on top of the shared copy', async () => {
    const { Wrapper } = createWrapper(createTestClient());
    const { result } = renderHook(() => useAdminI18n(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isLoaded).toBe(true);
    });
    expect(result.current.t.admin).toBe(getAdminMessages('en'));
    expect(result.current.t.common).toBe(getMessages('en').common);
  });

  it('labels halt durations from the shared minutes copy', () => {
    const copy = {
      t: { ...getMessages('en'), admin: getAdminMessages('en') },
      f: createFormatter({ locale: 'en' }),
    };

    expect(haltDurationLabel('5m', copy)).toBe('5 min');
    expect(haltDurationLabel('manual', copy)).toBe('Manual');
  });
});
