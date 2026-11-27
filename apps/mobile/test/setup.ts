import { type ViewProps } from 'react-native';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual<object>('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  selectionAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
}));

// Reanimated 4.7 crashes in Jest on its native initializer, so tests use a tiny explicit mock.
jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual<{ View: React.ComponentType<ViewProps> }>('react-native');
  const identity = <T>(value: T) => value;
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: identity },
    createAnimatedComponent: identity,
    useAnimatedProps: <T>(props: () => T) => props(),
    Easing: { bezier: () => identity },
    useSharedValue: <T>(initial: T) => {
      let value = initial;
      return {
        get: () => value,
        set: (next: T) => {
          value = next;
        },
      };
    },
    useAnimatedStyle: <T>(style: () => T) => style(),
    useReducedMotion: () => false,
    FadeInDown: {},
    FadeOutDown: {},
    withTiming: identity,
    withSpring: identity,
    withRepeat: identity,
    withSequence: <T>(...steps: T[]) => steps.at(-1),
    interpolateColor: () => 'transparent',
  };
});
