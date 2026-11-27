import '../global.css';

import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { Manrope_700Bold, Manrope_800ExtraBold } from '@expo-google-fonts/manrope';
import { isRunningInExpoGo } from 'expo';
import { useFonts } from 'expo-font';
import { SplashScreen, Stack, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform, View } from 'react-native';

import { useAppConfig } from '@sarwa/core';

import { ErrorFallback } from '../components/layout/route-fallbacks';
import { fontName } from '../components/ui/text';
import { AccountOverlays } from '../features/gating/account-overlays';
import { MaintenanceScreen } from '../features/maintenance/maintenance-screen';
import { useColors } from '../lib/theme';
import { AppProviders } from '../providers/app-providers';

export { ErrorFallback as ErrorBoundary };

// A deep link into a stack screen still has the tabs underneath to go back to.
export const unstable_settings = { initialRouteName: '(tabs)' };

void SplashScreen.preventAutoHideAsync();

const FONTS = {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
};

// Builds embed the fonts through the expo-font plugin; only Expo Go and web load them at runtime.
const RUNTIME_FONTS =
  isRunningInExpoGo() || Platform.OS === 'web'
    ? Object.fromEntries(Object.entries(FONTS).map(([file, font]) => [fontName(file), font]))
    : {};

function RootNavigator() {
  const colors = useColors();
  const [group] = useSegments() as string[];
  // The overlay keeps the stack mounted, so the user returns to the same screen and sign-in stays open.
  const maintenance = (useAppConfig()?.maintenanceMode ?? false) && group !== '(auth)';

  return (
    <>
      <View
        className="flex-1"
        accessibilityElementsHidden={maintenance}
        importantForAccessibility={maintenance ? 'no-hide-descendants' : 'auto'}
      >
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="(auth)" options={{ presentation: 'modal' }} />
          <Stack.Screen name="suspended" options={{ gestureEnabled: false }} />
          <Stack.Screen name="stocks/[symbol]" />
          <Stack.Screen name="order/new" options={{ presentation: 'modal' }} />
          <Stack.Screen name="orders/index" />
          <Stack.Screen name="orders/[id]" />
          <Stack.Screen name="alerts" />
          <Stack.Screen name="notifications" />
          <Stack.Screen name="search" />
          <Stack.Screen name="settings" />
        </Stack>
        <AccountOverlays />
      </View>
      {maintenance ? (
        <View className="absolute inset-0" accessibilityViewIsModal>
          <MaintenanceScreen />
        </View>
      ) : null}
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(RUNTIME_FONTS);

  // A font that fails to load falls back to the system font rather than keeping the splash up.
  const ready = fontsLoaded || fontError !== null;

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;
  return (
    <AppProviders>
      <StatusBar style="auto" />
      <RootNavigator />
    </AppProviders>
  );
}
