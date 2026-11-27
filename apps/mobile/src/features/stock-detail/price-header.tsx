import { View } from 'react-native';

import { type Period, type Quote } from '@sarwa/contracts';
import {
  change,
  changePct,
  type ChartType,
  formatChange,
  formatPct,
  formatPrice,
  formatQuoteLabel,
  ohlc,
  type ScrubPoint,
} from '@sarwa/core';

import { ChangePill } from '../../components/trading/change-pill';
import { PriceFlash } from '../../components/trading/price-flash';
import { Skeleton } from '../../components/ui/skeleton';
import { Text } from '../../components/ui/text';
import { useCopy } from '../../lib/i18n';

export function PriceHeader({
  quote,
  scrubbed,
  period,
  type,
}: {
  quote: Quote | undefined;
  scrubbed: ScrubPoint | null;
  period: Period;
  type: ChartType;
}) {
  const copy = useCopy();
  const { t, f } = copy;
  return (
    <View className="min-h-24 gap-1.5 px-5 pb-1.5 pt-3.5">
      {scrubbed ? (
        <>
          <Text variant="display">{formatPrice(f, scrubbed.candle.c)}</Text>
          <View className="flex-row gap-1">
            <ChangePill
              value={scrubbed.changePct}
              label={formatPct(f, scrubbed.changePct)}
              variant="inline"
            />
            <Text variant="sm" className="text-fg-3">
              · {f.chartDate(scrubbed.candle.t, period)}
            </Text>
          </View>
          {type === 'candle' ? (
            <View className="flex-row gap-3">
              {ohlc(copy, scrubbed.candle).map(({ label, value }) => (
                <Text key={label} variant="caption" className="text-fg-3">
                  {label}{' '}
                  <Text variant="caption" weight={600} className="text-fg">
                    {value}
                  </Text>
                </Text>
              ))}
            </View>
          ) : null}
        </>
      ) : quote ? (
        // No live region: the price ticks several times a second and would never stop being read.
        <View accessible accessibilityLabel={formatQuoteLabel(copy, quote)} className="gap-1.5">
          <View className="self-start">
            <PriceFlash price={quote.price} size="display" />
          </View>
          <View className="flex-row gap-1">
            <ChangePill
              value={change(quote)}
              label={`${formatChange(f, change(quote))} (${formatPct(f, changePct(quote))})`}
              variant="inline"
            />
            <Text variant="sm" className="text-fg-3">
              · {t.stock.today({ time: f.time(quote.ts) })}
            </Text>
          </View>
        </View>
      ) : (
        <Skeleton className="h-12 w-48" />
      )}
    </View>
  );
}
