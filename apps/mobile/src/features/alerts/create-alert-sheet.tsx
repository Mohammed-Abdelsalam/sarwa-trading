import { View } from 'react-native';

import { StockAvatar } from '../../components/trading/stock-avatar';
import { Button } from '../../components/ui/button';
import { Segmented } from '../../components/ui/segmented';
import { Sheet } from '../../components/ui/sheet';
import { Text } from '../../components/ui/text';
import { PriceField } from '../../components/ui/text-field';
import { useCopy } from '../../lib/i18n';
import { useStockIndex } from '../../lib/sectors';
import { useCreateAlertForm } from './use-create-alert';

function CreateAlertForm({ symbol, onClose }: { symbol: string; onClose: () => void }) {
  const { t, m } = useCopy();
  const { sectorOf } = useStockIndex();
  const form = useCreateAlertForm(symbol, onClose);
  const { actions } = form;

  return (
    <>
      <View className="flex-row items-center gap-3">
        <StockAvatar symbol={symbol} sector={sectorOf(symbol)} />
        <View className="flex-1">
          <Text variant="h3" accessibilityRole="header">
            {form.title}
          </Text>
          <Text variant="caption" className="text-fg-3" style={{ fontVariant: ['tabular-nums'] }}>
            {form.now}
          </Text>
        </View>
      </View>
      <Segmented
        full
        label={t.alerts.newAlert}
        options={form.conditions}
        value={form.condition}
        onChange={actions.setCondition}
      />
      <PriceField
        label={form.fieldLabel}
        prefix={form.prefix}
        signed={form.signed}
        value={form.text}
        onChangeText={actions.setText}
        hint={form.hint}
        error={form.error}
      />
      <View className="flex-row items-center justify-between">
        <Text variant="sm">{t.alerts.repeat}</Text>
        <Segmented
          label={t.alerts.repeat}
          options={form.repeats}
          value={form.repeat}
          onChange={actions.setRepeat}
          size="sm"
        />
      </View>
      <Text variant="caption" className="text-fg-3">
        {m.alerts.inAppOnly}
      </Text>
      <Button
        size="lg"
        disabled={!form.canSubmit}
        loading={form.submitting}
        onPress={actions.submit}
      >
        {t.alerts.create}
      </Button>
    </>
  );
}

export function CreateAlertSheet({
  symbol,
  onClose,
}: {
  symbol: string | null;
  onClose: () => void;
}) {
  return (
    <Sheet visible={symbol !== null} onClose={onClose}>
      {symbol ? <CreateAlertForm symbol={symbol} onClose={onClose} /> : null}
    </Sheet>
  );
}
