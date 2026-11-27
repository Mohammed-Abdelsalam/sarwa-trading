import * as Device from 'expo-device';
import { Platform } from 'react-native';

// Names this phone in the Sessions list ("iPhone 15"); the server builds the rest of the label.
export function deviceModel(): string | undefined {
  return Device.modelName ?? undefined;
}

export function devicePlatform(): 'ios' | 'android' {
  return Platform.OS === 'android' ? 'android' : 'ios';
}
