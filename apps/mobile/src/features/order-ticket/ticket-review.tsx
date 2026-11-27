import { AlertTriangle, Check, Info } from 'lucide-react-native';
import { Pressable, ScrollView, View } from 'react-native';

import { type Sector } from '@sarwa/contracts';

import { StockAvatar } from '../../components/trading/stock-avatar';
import { Button } from '../../components/ui/button';
import { Callout } from '../../components/ui/callout';
import { KeyValueRow } from '../../components/ui/key-value-row';
import { ProgressBar } from '../../components/ui/progress-bar';
import { Text } from '../../components/ui/text';
import { useCopy } from '../../lib/i18n';
import { cx, useColors } from '../../lib/theme';
import { SlideToConfirm } from './slide-to-confirm';
import { type useOrderTicketScreen } from './use-order-ticket-screen';

type Screen = ReturnType<typeof useOrderTicketScreen>;

function LargeOrderConfirm({
  large,
  onToggle,
}: {
  large: NonNullable<Screen['review']['large']>;
  onToggle: () => void;
}) {
  const { t } = useCopy();
  const colors = useColors();
  return (
    <View className="gap-2">
      <Callout
        tone="warn"
        icon={AlertTriangle}
        title={t.ticket.largeOrderTitle}
        body={large.body}
      />
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: large.confirmed }}
        onPress={onToggle}
        className="min-h-11 flex-row items-center gap-2.5"
      >
        <View
          className={cx(
            'h-5 w-5 items-center justify-center rounded-xs border-2',
            large.confirmed ? 'border-brand bg-brand' : 'border-border-strong',
          )}
        >
          {large.confirmed ? <Check size={14} color={colors['on-brand']} /> : null}
        </View>
        <Text variant="sm" className="flex-1">
          {large.toggleLabel}
        </Text>
      </Pressable>
    </View>
  );
}

export function TicketReview({
  symbol,
  sector,
  review,
  actions,
}: Pick<Screen, 'symbol' | 'review' | 'actions'> & { sector?: Sector }) {
  const { t } = useCopy();
  return (
    <>
      <ScrollView contentContainerClassName="gap-4 px-5 py-3">
        <View className="flex-row items-center gap-3">
          <StockAvatar symbol={symbol} sector={sector} />
          <View className="flex-1">
            <Text variant="h2" accessibilityRole="header">
              {review.headline}
            </Text>
            <Text variant="sm" className="text-fg-2">
              {review.subline}
            </Text>
          </View>
        </View>
        <View className="rounded-lg border border-border bg-surface px-4 py-2">
          {review.rows.map((row) => (
            <KeyValueRow key={row.key} label={row.label} value={row.value} total={row.total} />
          ))}
        </View>
        {review.countdown ? (
          <View className="gap-2">
            <View className="flex-row justify-between">
              <Text variant="sm" className="text-fg-2">
                {review.countdown.label}
              </Text>
              <Text variant="caption" className="text-fg-3">
                {t.ticket.autoRefreshes}
              </Text>
            </View>
            <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
              <ProgressBar
                fraction={review.countdown.fraction}
                label={review.countdown.label}
                thin
              />
            </View>
          </View>
        ) : null}
        {review.resting ? <Callout tone="info" icon={Info} body={review.resting} /> : null}
        {review.large ? (
          <LargeOrderConfirm large={review.large} onToggle={actions.toggleLargeConfirm} />
        ) : null}
        <Callout tone="info" icon={Info} body={review.note} />
        {review.error ? (
          <View className="gap-2">
            <Callout
              tone="neg"
              icon={AlertTriangle}
              title={review.error.title}
              body={review.error.body}
            />
            <Button variant="secondary" onPress={actions.retry}>
              {t.common.retry}
            </Button>
          </View>
        ) : null}
      </ScrollView>
      <View className="px-4 pb-4 pt-2">
        <SlideToConfirm
          confirm={review.confirm}
          sendingLabel={review.sendingLabel}
          onConfirm={actions.submit}
        />
      </View>
    </>
  );
}
