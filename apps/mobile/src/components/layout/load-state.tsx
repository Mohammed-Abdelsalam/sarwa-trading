import { AlertTriangle, type LucideIcon } from 'lucide-react-native';
import { ActivityIndicator, View } from 'react-native';

import { useCopy } from '../../lib/i18n';
import { useColors } from '../../lib/theme';
import { Button } from '../ui/button';
import { StateView } from '../ui/state-view';

export function LoadError({ title, onRetry }: { title?: string; onRetry: () => void }) {
  const { t, m } = useCopy();
  return (
    <StateView
      icon={AlertTriangle}
      tone="neg"
      title={title ?? m.loadFailed}
      description={t.common.loadErrorBody}
      action={
        <Button variant="secondary" onPress={onRetry}>
          {t.common.retry}
        </Button>
      }
    />
  );
}

export function Loading() {
  const colors = useColors();
  return (
    <View accessibilityRole="progressbar" className="items-center py-12">
      <ActivityIndicator color={colors['brand-fg']} />
    </View>
  );
}

export function Empty({ icon, title }: { icon: LucideIcon; title: string }) {
  return <StateView icon={icon} title={title} />;
}
