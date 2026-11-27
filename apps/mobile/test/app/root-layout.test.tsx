import { render, screen } from '@testing-library/react-native';
import { useFonts } from 'expo-font';
import { SplashScreen } from 'expo-router';

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
  };
});
jest.mock('../../src/providers/app-providers', () => ({
  AppProviders: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@sarwa/core', () => ({
  ...jest.requireActual<object>('@sarwa/core'),
  useAppConfig: () => undefined,
}));
jest.mock('../../src/lib/theme', () => ({ useColors: () => ({ bg: '#fff' }) }));

describe('RootLayout', () => {
  it('still opens the app when the fonts fail to load', async () => {
    jest.mocked(useFonts).mockReturnValue([false, new Error('offline')]);
    await render(<RootLayout />);

    expect(screen.getByText('app')).toBeOnTheScreen();
    expect(SplashScreen.hideAsync).toHaveBeenCalled();
  });
});
