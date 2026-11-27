import { type ErrorBoundaryProps, router } from 'expo-router';
import { AlertTriangle, SearchX } from 'lucide-react-native';
import { View } from 'react-native';

import { getMessages } from '@sarwa/core';

import { useCopy } from '../../lib/i18n';
import { useThemeVars } from '../../lib/theme';
import { savedLocale } from '../../providers/app-providers';
import { Button } from '../ui/button';
import { StateView } from '../ui/state-view';

const backToMarkets = () => {
  router.replace('/markets');
};

// Rendered in place of the root layout, outside the providers, so it reads the language and sets the theme itself.
export function ErrorFallback({ retry }: ErrorBoundaryProps) {
  const locale = savedLocale();
  const { errorPage } = getMessages(locale);
  return (
    <View
      style={[{ flex: 1, direction: locale === 'ar' ? 'rtl' : 'ltr' }, useThemeVars()]}
      className="justify-center bg-bg px-6"
    >
      <StateView
        icon={AlertTriangle}
        tone="neg"
        title={errorPage.title}
        description={errorPage.body}
        action={<Button onPress={() => void retry()}>{errorPage.retry}</Button>}
      />
    </View>
  );
}

export function NotFoundScreen() {
  const { t } = useCopy();
  return (
    <View className="flex-1 justify-center bg-bg px-6">
      <StateView
        icon={SearchX}
        title={t.notFound.title}
        description={t.notFound.body}
        action={
          <Button variant="secondary" onPress={backToMarkets}>
            {t.stock.backToMarkets}
          </Button>
        }
      />
    </View>
  );
}
