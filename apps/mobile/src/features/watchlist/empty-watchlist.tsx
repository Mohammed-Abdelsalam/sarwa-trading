import { Star } from 'lucide-react-native';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { shadows } from '@sarwa/tokens';

import { Button } from '../../components/ui/button';
import { Text } from '../../components/ui/text';
import { useColors, useThemeName } from '../../lib/theme';

// Illustration geometry copied from the canvas (M-Watchlist); the one place fixed pixel offsets are allowed.
function EmptyWatchlistArt() {
  const colors = useColors();
  const shadow = { boxShadow: shadows[useThemeName()].e2 };
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className="mb-2 h-[136px] w-[168px]"
    >
      <View
        style={{ transform: [{ rotate: '-8deg' }] }}
        className="absolute left-3.5 top-[26px] h-[92px] w-[140px] rounded-[18px] bg-surface-3"
      />
      <View
        style={shadow}
        className="absolute left-3.5 top-[18px] h-24 w-[140px] gap-2.5 rounded-[18px] border border-border bg-surface p-4"
      >
        <View className="flex-row items-center gap-2">
          <View className="h-6 w-6 rounded-control-sm bg-brand-subtle" />
          <View className="h-2 w-14 rounded-xs bg-border-strong" />
        </View>
        <Svg width={108} height={34} viewBox="0 0 108 34">
          <Path
            d="M2 28 L20 22 L34 25 L52 12 L66 16 L84 6 L106 9"
            fill="none"
            stroke={colors['brand-fg']}
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </View>
      <View
        style={shadow}
        className="absolute right-0 top-0 h-[52px] w-[52px] items-center justify-center rounded-full bg-brand"
      >
        <Star size={24} color={colors['on-brand']} fill={colors['on-brand']} />
      </View>
    </View>
  );
}

export function EmptyWatchlist({ onBrowse }: { onBrowse: () => void }) {
  return (
    <View className="flex-1 items-center justify-center gap-4 px-10 pb-16">
      <EmptyWatchlistArt />
      <Text variant="h2" className="text-center">
        Your watchlist is empty
      </Text>
      <Text className="text-center text-fg-2">
        Tap the star on any stock to follow its live price here.
      </Text>
      <Button size="lg" className="mt-2 min-w-state-action" onPress={onBrowse}>
        Browse markets
      </Button>
    </View>
  );
}
