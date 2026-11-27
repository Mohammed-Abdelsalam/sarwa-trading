import { screen } from '@testing-library/react-native';

import { MaintenanceScreen } from '../../../src/features/maintenance/maintenance-screen';
import { renderScreen } from '../../render';

describe('MaintenanceScreen', () => {
  it('explains the pause in English', async () => {
    await renderScreen(<MaintenanceScreen />);

    expect(screen.getByText("We'll be right back")).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Check again' })).toBeOnTheScreen();
  });

  it('follows the Arabic locale', async () => {
    await renderScreen(<MaintenanceScreen />, { locale: 'ar' });

    expect(screen.getByText('سنعود قريبًا')).toBeOnTheScreen();
    expect(screen.queryByText("We'll be right back")).not.toBeOnTheScreen();
  });
});
