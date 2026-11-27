import { type ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { shadows } from '@sarwa/tokens';

import { useCopy } from '../../lib/i18n';
import { useThemeName, useThemeVars } from '../../lib/theme';

// A modal renders outside the root view, so it sets the theme and direction itself.
export function Sheet({
  visible,
  onClose,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const themeVars = useThemeVars();
  const { t, dir } = useCopy();
  const reducedMotion = useReducedMotion();
  return (
    <Modal
      visible={visible}
      transparent
      animationType={reducedMotion ? 'fade' : 'slide'}
      onRequestClose={onClose}
    >
      {/* Edge-to-edge Android no longer resizes the window for the keyboard, so both platforms pad. */}
      <KeyboardAvoidingView
        behavior="padding"
        style={[{ flex: 1, direction: dir }, themeVars]}
        className="justify-end"
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.common.close}
          onPress={onClose}
          className="absolute inset-0 bg-scrim"
        />
        <View
          accessibilityViewIsModal
          className="gap-3.5 rounded-t-[24px] bg-surface-2 px-5"
          style={{ paddingBottom: insets.bottom + 24, boxShadow: shadows[useThemeName()].e3 }}
        >
          <View className="mb-1 mt-2 h-[5px] w-10 self-center rounded-full bg-border-strong" />
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
