import { render, screen } from '@testing-library/react-native';
import { useFonts } from 'expo-font';
import { SplashScreen, useSegments } from 'expo-router';

import { useAppConfig } from '@sarwa/core';

import RootLayout from '../../src/app/_layout';

import type { Text } from 'react-native';

jest.mock('../../src/global.css', () => ({}));
jest.mock('expo-font', () => ({ useFonts: jest.fn() }));
jest.mock('@expo-google-fonts/inter', () => ({}));
jest.mock('@expo-google-fonts/manrope', () => ({}));
jest.mock('expo-router', () => {
  const { Text: MockText } = jest.requireActual<{ Text: typeof Text }>('react-native');
  const Stack = () => <MockText>app</MockText>;
  Stack.Screen = function StackScreen() {
    return null;
  };
  return {
    SplashScreen: { preventAutoHideAsync: jest.fn(), hideAsync: jest.fn() },
    Stack,
    useSegments: jest.fn(() => ['(tabs)']),
  };
});
jest.mock('../../src/providers/app-providers', () => ({
  AppProviders: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@sarwa/core', () => ({
  ...jest.requireActual<object>('@sarwa/core'),
  useAppConfig: jest.fn(() => undefined),
}));
jest.mock('../../src/features/maintenance/maintenance-screen', () => {
  const { Text: MockText } = jest.requireActual<{ Text: typeof Text }>('react-native');
  return { MaintenanceScreen: () => <MockText>maintenance</MockText> };
});
jest.mock('../../src/features/gating/account-overlays', () => ({ AccountOverlays: () => null }));
jest.mock('../../src/lib/theme', () => ({ useColors: () => ({ bg: '#fff' }) }));

describe('RootLayout', () => {
  it('still opens the app when the fonts fail to load', async () => {
    jest.mocked(useFonts).mockReturnValue([false, new Error('offline')]);
    await render(<RootLayout />);

    expect(screen.getByText('app')).toBeOnTheScreen();
    expect(SplashScreen.hideAsync).toHaveBeenCalled();
  });

  describe('in maintenance', () => {
    beforeEach(() => {
      jest.mocked(useFonts).mockReturnValue([true, null]);
      jest
        .mocked(useAppConfig)
        .mockReturnValue({ maintenanceMode: true } as ReturnType<typeof useAppConfig>);
    });

    it('covers the app without unmounting its navigation', async () => {
      await render(<RootLayout />);

      expect(screen.getByText('maintenance')).toBeOnTheScreen();
      expect(screen.getByText('app', { includeHiddenElements: true })).toBeOnTheScreen();
    });

    it('leaves the sign-in screens reachable', async () => {
      jest.mocked(useSegments).mockReturnValue(['(auth)'] as never);
      await render(<RootLayout />);

      expect(screen.queryByText('maintenance')).not.toBeOnTheScreen();
      expect(screen.getByText('app')).toBeOnTheScreen();
    });
  });
});
