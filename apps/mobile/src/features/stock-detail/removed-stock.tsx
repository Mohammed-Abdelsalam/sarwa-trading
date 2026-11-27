import { router } from 'expo-router';
import { Ban, Star } from 'lucide-react-native';
import { View } from 'react-native';

import { Button } from '../../components/ui/button';
import { Text } from '../../components/ui/text';
import { useCopy } from '../../lib/i18n';
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
  const { t } = useCopy();
  return (
    <View className="flex-1 items-center justify-center gap-4 px-9 pb-24">
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View className="h-art w-art items-center justify-center rounded-art border border-border bg-surface">
          <Text variant="avatar-lg" className="text-fg-2">
            {symbol.charAt(0)}
          </Text>
        </View>
        <View className="absolute -bottom-1 -end-1 h-9 w-9 items-center justify-center rounded-full bg-neg">
          <Ban size={16} color={colors['on-brand']} />
        </View>
      </View>
      <Text variant="mono" className="text-fg-3">
        stock/{symbol}
      </Text>
      <Text variant="h2" className="text-center">
        {t.stock.removedTitle}
      </Text>
      <Text className="text-center text-fg-2">{t.stock.removedBody({ symbol })}</Text>
      <View className="mt-2 w-full gap-2.5">
        <Button
          size="lg"
          onPress={() => {
            router.navigate('/markets');
          }}
        >
          {t.stock.backToMarkets}
        </Button>
        {watched ? (
          <Button
            size="lg"
            variant="secondary"
            icon={<Star size={16} color={colors.fg} />}
            onPress={onRemove}
          >
            {t.stock.removeFromWatchlist}
          </Button>
        ) : null}
      </View>
    </View>
  );
}
