import { type ErrorBoundaryProps, router } from 'expo-router';
import { AlertTriangle, SearchX } from 'lucide-react-native';
import { View } from 'react-native';

import { useThemeVars } from '../../lib/theme';
import { Button } from '../ui/button';
import { StateView } from '../ui/state-view';

const backToMarkets = () => {
  router.replace('/');
};

// Rendered in place of the root layout, so it sets the theme variables itself.
export function ErrorFallback({ retry }: ErrorBoundaryProps) {
  return (
    <View style={[{ flex: 1 }, useThemeVars()]} className="justify-center bg-bg px-6">
      <StateView
        icon={AlertTriangle}
        tone="neg"
        title="Something went wrong"
        description="The app hit an unexpected error. Your watchlist is safe."
        action={<Button label="Try again" onPress={() => void retry()} />}
      />
    </View>
  );
}

export function NotFoundScreen() {
  return (
    <View className="flex-1 justify-center bg-bg px-6">
      <StateView
        icon={SearchX}
        title="Page not found"
        description="This link doesn't lead anywhere in Mini Trading."
        action={<Button label="Back to Markets" variant="secondary" onPress={backToMarkets} />}
      />
    </View>
  );
}
