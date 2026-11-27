import { type ErrorBoundaryProps, router } from 'expo-router';
import { AlertTriangle, SearchX } from 'lucide-react-native';
import { View } from 'react-native';

import { useCopy } from '../../lib/i18n';
import { useThemeVars } from '../../lib/theme';
import { Button } from '../ui/button';
import { StateView } from '../ui/state-view';

const backToMarkets = () => {
  router.replace('/markets');
};

// Rendered in place of the root layout, outside the providers, so its copy is static and it sets the theme itself.
export function ErrorFallback({ retry }: ErrorBoundaryProps) {
  return (
    <View style={[{ flex: 1 }, useThemeVars()]} className="justify-center bg-bg px-6">
      <StateView
        icon={AlertTriangle}
        tone="neg"
        title="Something went wrong"
        description="The app hit an unexpected error. Your watchlist is safe."
        action={<Button onPress={() => void retry()}>Try again</Button>}
      />
    </View>
  );
}

export function NotFoundScreen() {
  const { t, m } = useCopy();
  return (
    <View className="flex-1 justify-center bg-bg px-6">
      <StateView
        icon={SearchX}
        title={m.notFound.title}
        description={m.notFound.body}
        action={
          <Button variant="secondary" onPress={backToMarkets}>
            {t.stock.backToMarkets}
          </Button>
        }
      />
    </View>
  );
}
