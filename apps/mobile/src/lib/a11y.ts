import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

export function useScreenReader(): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    void AccessibilityInfo.isScreenReaderEnabled().then(setEnabled);
    const sub = AccessibilityInfo.addEventListener('screenReaderChanged', setEnabled);
    return () => {
      sub.remove();
    };
  }, []);
  return enabled;
}

// Gestures like slide-to-confirm get a plain button when the user can't or shouldn't drag.
export function usePlainControls(): boolean {
  const reducedMotion = useReducedMotion();
  return useScreenReader() || reducedMotion;
}
