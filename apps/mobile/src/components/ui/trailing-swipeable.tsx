import { type ReactNode } from 'react';
import { View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';

import { useCopy } from '../../lib/i18n';

// The swipeable lays out in physical LTR, so the actions go on whichever side is trailing.
export function TrailingSwipeable({
  actions,
  children,
}: {
  actions: () => ReactNode;
  children: ReactNode;
}) {
  const { dir } = useCopy();
  const render = () => <View style={{ direction: dir }}>{actions()}</View>;
  const trailing =
    dir === 'rtl'
      ? { renderLeftActions: render, leftThreshold: 48, overshootLeft: false }
      : { renderRightActions: render, rightThreshold: 48, overshootRight: false };
  return (
    <View style={{ direction: 'ltr' }}>
      <ReanimatedSwipeable friction={2} {...trailing}>
        <View style={{ direction: dir }}>{children}</View>
      </ReanimatedSwipeable>
    </View>
  );
}
