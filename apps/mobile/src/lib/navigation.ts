import { router } from 'expo-router';

import { SymbolSchema } from '@sarwa/contracts';

const WEB_URL = (process.env.EXPO_PUBLIC_WEB_URL ?? 'http://localhost:3000').replace(/\/$/, '');

// A deep link can open a stack screen with no history; back then lands on the tabs, not outside the app.
export function goBack(): void {
  if (router.canGoBack()) router.back();
  else router.replace('/(tabs)');
}

export function parseSymbol(param: string | string[] | undefined): string | null {
  if (typeof param !== 'string') return null;
  const parsed = SymbolSchema.safeParse(param.toUpperCase());
  return parsed.success ? parsed.data : null;
}

// Shared links open the web page (or the app, through universal and app links).
export function stockWebUrl(symbol: string): string {
  return `${WEB_URL}/stocks/${encodeURIComponent(symbol)}`;
}
