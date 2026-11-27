import { CheckCircle2, Info, Pencil } from 'lucide-react-native';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Loading, LoadError } from '../../components/layout/load-state';
import { TopBar } from '../../components/layout/top-bar';
import { OrderStatusBadge } from '../../components/trading/order-status-badge';
import { StockAvatar } from '../../components/trading/stock-avatar';
import { Button } from '../../components/ui/button';
import { Callout } from '../../components/ui/callout';
import { KeyValueRow } from '../../components/ui/key-value-row';
import { ProgressBar } from '../../components/ui/progress-bar';
import { Sheet } from '../../components/ui/sheet';
import { Text } from '../../components/ui/text';
import { FieldError, PriceField } from '../../components/ui/text-field';
import { useCopy } from '../../lib/i18n';
import { useColors } from '../../lib/theme';
import { Timeline } from './timeline';
import { useOrderDetailScreen } from './use-order-detail-screen';

const VALUE_COLOR = { up: 'text-pos', down: 'text-neg', flat: 'text-fg' } as const;

function CancelOutcomeCallout({
  outcome,
}: {
  outcome: 'canceled' | 'already_filled' | 'already_closed';
}) {
  const { t } = useCopy();
  if (outcome === 'already_filled') {
    return (
      <Callout
        tone="info"
        icon={CheckCircle2}
        title={t.orders.alreadyFilledTitle}
        body={t.orders.alreadyFilledBody}
      />
    );
  }
  return <Callout tone="info" icon={Info} body={t.orders.canceled} />;
}

export function OrderDetailScreen({ id }: { id: string }) {
  const colors = useColors();
  const { t } = useCopy();
  const screen = useOrderDetailScreen(id);
  const { order, actions } = screen;

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-bg">
      <TopBar title={t.orders.details} />
      {screen.isLoading ? (
        <Loading />
      ) : screen.isError || !order ? (
        <LoadError onRetry={actions.retry} />
      ) : (
        <>
          <ScrollView contentContainerClassName="gap-4 px-5 py-2">
            <View className="flex-row items-center gap-3">
              <StockAvatar symbol={order.symbol} sector={order.sector} />
              <View className="flex-1">
                <Text variant="h2" accessibilityRole="header">
                  {order.title}
                </Text>
                <Text variant="sm" className="text-fg-2" style={{ fontVariant: ['tabular-nums'] }}>
                  {order.subtitle}
                </Text>
              </View>
              <OrderStatusBadge status={order.status} />
            </View>

            {screen.outcome ? <CancelOutcomeCallout outcome={screen.outcome} /> : null}
            {screen.cancelFailed ? <FieldError message={t.common.loadErrorBody} /> : null}

            {order.progress ? (
              <View className="gap-2">
                <View className="flex-row justify-between">
                  <Text variant="sm" className="text-fg-2">
                    {t.orders.filledOf({
                      filled: order.progress.filled,
                      total: order.progress.total,
                    })}
                  </Text>
                  {order.progress.avg ? (
                    <Text variant="sm" className="text-fg-2">
                      {order.progress.avg}
                    </Text>
                  ) : null}
                </View>
                <ProgressBar
                  fraction={order.progress.fraction}
                  label={order.progress.label}
                  tone="warn"
                />
              </View>
            ) : null}

            <Timeline steps={order.timeline} />

            <View className="rounded-lg border border-border bg-surface px-4 py-1.5">
              {order.rows.map((row) => (
                <KeyValueRow
                  key={row.key}
                  label={row.label}
                  value={row.value}
                  valueClassName={row.direction ? VALUE_COLOR[row.direction] : undefined}
                />
              ))}
            </View>
          </ScrollView>

          {screen.canCancel ? (
            <View className="flex-row gap-2.5 px-4 pb-4 pt-2">
              {screen.canModify ? (
                <Button
                  variant="secondary"
                  size="lg"
                  className="flex-1"
                  icon={<Pencil size={16} color={colors.fg} />}
                  onPress={actions.startModify}
                >
                  {t.orders.modify}
                </Button>
              ) : null}
              <Button
                variant="danger"
                size="lg"
                className="flex-1"
                loading={screen.isCanceling}
                disabled={screen.isCanceling}
                onPress={actions.cancel}
              >
                {screen.cancelLabel}
              </Button>
            </View>
          ) : null}

          <Sheet visible={screen.modify.open} onClose={actions.closeModify}>
            <Text variant="h3" accessibilityRole="header">
              {t.orders.modify}
            </Text>
            <PriceField
              label={screen.modify.label}
              prefix={screen.modify.prefix}
              value={screen.modify.text}
              onChangeText={actions.setPriceText}
              error={screen.modify.failed ? t.common.loadErrorBody : undefined}
            />
            <Button
              size="lg"
              loading={screen.modify.saving}
              disabled={screen.modify.saving || screen.modify.text === ''}
              onPress={actions.saveModify}
            >
              {t.common.save}
            </Button>
          </Sheet>
        </>
      )}
    </SafeAreaView>
  );
}
