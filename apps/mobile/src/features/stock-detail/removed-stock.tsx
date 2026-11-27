import { router } from 'expo-router';
import { Ban, Star } from 'lucide-react-native';
import { View } from 'react-native';

import { Button } from '../../components/ui/button';
import { Text } from '../../components/ui/text';
import { useColors } from '../../lib/theme';

// Deep link to a stock that was disabled or removed (X-A11y): explain it instead of a generic 404.
export function RemovedStock({
  symbol,
  watched,
  onRemove,
}: {
  symbol: string;
  watched: boolean;
  onRemove: () => void;
}) {
  const colors = useColors();
  return (
    <View className="flex-1 items-center justify-center gap-4 px-9 pb-24">
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View className="h-art w-art items-center justify-center rounded-art border border-border bg-surface">
          <Text variant="avatar-lg" className="text-fg-2">
            {symbol.charAt(0)}
          </Text>
        </View>
        <View className="absolute -bottom-1 -right-1 h-9 w-9 items-center justify-center rounded-full bg-neg">
          <Ban size={16} color={colors['on-brand']} />
        </View>
      </View>
      <Text variant="mono" className="text-fg-3">
        stock/{symbol}
      </Text>
      <Text variant="h2" className="text-center">
        This stock is no longer available
      </Text>
      <Text className="text-center text-fg-2">
        {`${symbol} was removed from Mini Trading. You opened an old link — prices for it are no longer streaming.`}
      </Text>
      <View className="mt-2 w-full gap-2.5">
        <Button
          size="lg"
          onPress={() => {
            router.navigate('/');
          }}
        >
          Back to Markets
        </Button>
        {watched ? (
          <Button
            size="lg"
            variant="secondary"
            icon={<Star size={16} color={colors.fg} />}
            onPress={onRemove}
          >
            Remove from Watchlist
          </Button>
        ) : null}
      </View>
    </View>
  );
}
