import '../global.css';

import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { Manrope_700Bold, Manrope_800ExtraBold } from '@expo-google-fonts/manrope';
import { useFonts } from 'expo-font';
import { SplashScreen, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { useAppConfig } from '@sarwa/core';

import { ErrorFallback } from '../components/layout/route-fallbacks';
import { MaintenanceScreen } from '../features/maintenance/maintenance-screen';
import { useColors } from '../lib/theme';
import { AppProviders } from '../providers/app-providers';

export { ErrorFallback as ErrorBoundary };

void SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const colors = useColors();
  const maintenance = useAppConfig()?.maintenanceMode ?? false;

  if (maintenance) return <MaintenanceScreen />;
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="stock/[symbol]" />
      <Stack.Screen name="order/new" options={{ presentation: 'modal' }} />
      <Stack.Screen name="orders/index" />
      <Stack.Screen name="orders/[id]" />
      <Stack.Screen name="alerts" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="search" />
      <Stack.Screen name="settings" />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded) void SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;
  return (
    <AppProviders>
      <StatusBar style="auto" />
      <RootNavigator />
    </AppProviders>
  );
}
