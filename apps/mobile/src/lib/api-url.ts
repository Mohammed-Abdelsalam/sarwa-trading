interface ApiUrlSource {
  configured?: string | undefined;
  hostUri?: string | undefined;
  dev: boolean;
}

// In development a phone in Expo Go can't reach "localhost", so it reuses the dev machine's LAN IP
// from the bundler URL. A release build must be told its API, and only over HTTPS.
export function resolveApiUrl({ configured, hostUri, dev }: ApiUrlSource): string {
  if (!dev) {
    if (!configured) throw new Error('Set EXPO_PUBLIC_API_URL for release builds');
    if (!configured.startsWith('https://')) throw new Error('Release builds must use an https API');
    return configured;
  }
  if (configured) return configured;
  return `http://${hostUri?.split(':')[0] ?? 'localhost'}:4000`;
}
