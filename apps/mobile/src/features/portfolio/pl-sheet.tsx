import { Button } from '../../components/ui/button';
import { Sheet } from '../../components/ui/sheet';
import { Text } from '../../components/ui/text';
import { useCopy } from '../../lib/i18n';

export function PlSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useCopy();
  return (
    <Sheet visible={visible} onClose={onClose}>
      <Text variant="h3" accessibilityRole="header">
        {t.portfolio.howPl}
      </Text>
      <Text className="text-fg-2">{t.portfolio.howPlBody}</Text>
      <Text variant="caption" className="text-fg-3">
        {t.paper.disclosure}
      </Text>
      <Button size="lg" variant="secondary" onPress={onClose}>
        {t.common.done}
      </Button>
    </Sheet>
  );
}
