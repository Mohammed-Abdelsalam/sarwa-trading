import { Wrench } from 'lucide-react-native';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useRefreshAppConfig } from '@sarwa/core';

import { Button } from '../../components/ui/button';
import { StateView } from '../../components/ui/state-view';
import { Text } from '../../components/ui/text';

const RETRY_MS = 30_000;

export function MaintenanceScreen() {
  const checkAgain = useRefreshAppConfig({ every: RETRY_MS });

  return (
    <SafeAreaView className="flex-1 items-center justify-center bg-bg px-6">
      <StateView
        icon={Wrench}
        tone="brand"
        title="We'll be right back"
        description="Mini Trading is getting a scheduled upgrade. Your watchlist is saved and live prices return as soon as we're done."
        action={
          <Button
            label="Check again"
            size="lg"
            className="mt-2 min-w-[220px]"
            onPress={checkAgain}
          />
        }
        footnote="We'll also retry automatically every 30 s."
      />
      <View className="absolute bottom-10">
        <Text variant="caption" className="text-fg-3">
          Mini Trading
        </Text>
      </View>
    </SafeAreaView>
  );
}
