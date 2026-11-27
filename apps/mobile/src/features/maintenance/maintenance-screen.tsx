import { Clock, RefreshCw, TrendingUp, Wrench } from 'lucide-react-native';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useRefreshAppConfig } from '@sarwa/core';

import { Button } from '../../components/ui/button';
import { Text } from '../../components/ui/text';
import { useCopy } from '../../lib/i18n';
import { useColors } from '../../lib/theme';

const RETRY_MS = 30_000;

// Illustration geometry copied from the canvas (M-Global maintenance).
function MaintenanceArt() {
  const colors = useColors();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className="mb-2.5 h-[132px] w-[132px]"
    >
      <View className="absolute inset-0 rounded-[40px] bg-brand-subtle" />
      <View className="absolute inset-[26px] items-center justify-center rounded-[26px] bg-brand">
        <Wrench size={32} color={colors['on-brand']} />
      </View>
      <View className="absolute -end-1.5 top-2 h-[34px] w-[34px] items-center justify-center rounded-full border border-border bg-surface">
        <Clock size={16} color={colors.warn} />
      </View>
    </View>
  );
}

export function MaintenanceScreen() {
  const colors = useColors();
  const checkAgain = useRefreshAppConfig({ every: RETRY_MS });
  const { m, f } = useCopy();

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <View className="flex-1 items-center justify-center gap-4 px-9 pb-20">
        <MaintenanceArt />
        <Text variant="h1" className="text-center">
          {m.maintenance.title}
        </Text>
        <Text className="text-center text-fg-2">{m.maintenance.body}</Text>
        <View className="mt-3 w-full gap-2">
          <Button
            size="lg"
            icon={<RefreshCw size={16} color={colors['on-brand']} />}
            onPress={checkAgain}
          >
            {m.maintenance.checkAgain}
          </Button>
          <Text variant="caption" className="text-center text-fg-3">
            {m.maintenance.autoRetry({ seconds: f.number(RETRY_MS / 1000) })}
          </Text>
        </View>
      </View>
      <View className="flex-row items-center justify-center gap-2 pb-10">
        <View className="h-6 w-6 items-center justify-center rounded-control-sm bg-brand">
          <TrendingUp size={14} color={colors['on-brand']} />
        </View>
        <Text variant="symbol" className="text-fg-3">
          Mini Trading
        </Text>
      </View>
    </SafeAreaView>
  );
}
