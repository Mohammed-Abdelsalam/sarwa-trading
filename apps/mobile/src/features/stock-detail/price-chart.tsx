import { AlertTriangle, RefreshCw } from 'lucide-react-native';
import { Fragment, type ReactNode } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';

import { type Period } from '@sarwa/contracts';
import { type CandleShape, type ChartType, type ScrubPoint } from '@sarwa/core';
import { layout } from '@sarwa/tokens';

import { Button } from '../../components/ui/button';
import { Skeleton } from '../../components/ui/skeleton';
import { Text } from '../../components/ui/text';
import { useCopy } from '../../lib/i18n';
import { useColors } from '../../lib/theme';
import { usePriceChart } from './use-price-chart';

const HEIGHT = layout.detail.chartHeight;
const VOLUME_HEIGHT = layout.detail.volumeHeight;
const GRID_LINES = [0.25, 0.5, 0.75];
// The loading placeholder line from the canvas (M-Detail), drawn dashed under the skeleton.
const PLACEHOLDER_PATH = 'M0 120 L40 100 L80 108 L120 70 L160 82 L200 50 L240 64 L280 30 L350 44';

const AnimatedLine = Animated.createAnimatedComponent(Line);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// A bar centred on x, drawn as a path because react-native-svg deprecates Rect's x/y props.
const bar = (x: number, width: number, top: number, height: number) =>
  `M${String(x - width / 2)} ${String(top)}h${String(width)}v${String(height)}h${String(-width)}Z`;

type PeriodChange = ReturnType<typeof usePriceChart>['periodChange'];

export function ChartSkeleton() {
  const colors = useColors();
  const { t } = useCopy();
  return (
    <View
      accessibilityLabel={t.chart.loading}
      className="justify-end gap-2.5 px-5 pb-5 pt-3"
      style={{ height: HEIGHT }}
    >
      <Svg width="100%" height={150} viewBox="0 0 350 150" opacity={0.5}>
        <Path
          d={PLACEHOLDER_PATH}
          fill="none"
          stroke={colors['border-strong']}
          strokeWidth={3}
          strokeDasharray="6 8"
          strokeLinecap="round"
        />
      </Svg>
      <Skeleton className="h-10 w-full rounded-md" />
      <Skeleton className="h-2.5 w-full" />
    </View>
  );
}

function ChartError({ period, onRetry }: { period: Period; onRetry: () => void }) {
  const colors = useColors();
  const { t } = useCopy();
  return (
    <View style={{ height: HEIGHT }} className="px-5 pb-3 pt-2">
      <View
        accessibilityRole="alert"
        className="flex-1 items-center justify-center gap-2.5 rounded-lg border border-dashed border-border-strong px-6"
      >
        <View className="h-11 w-11 items-center justify-center rounded-lg bg-neg-subtle">
          <AlertTriangle size={20} color={colors.neg} />
        </View>
        <Text variant="h3">{t.chart.unavailable}</Text>
        <Text variant="sm" className="max-w-60 text-center text-fg-2">
          {t.chart.unavailableBody({ period })}
        </Text>
        <Button
          variant="secondary"
          size="sm"
          icon={<RefreshCw size={16} color={colors.fg} />}
          onPress={onRetry}
        >
          {t.common.retry}
        </Button>
      </View>
    </View>
  );
}

function Candles({ shapes }: { shapes: readonly CandleShape[] }) {
  const colors = useColors();
  return shapes.map((shape) => {
    const color = shape.up ? colors.pos : colors.neg;
    return (
      <Fragment key={shape.x}>
        <Line
          x1={shape.x}
          x2={shape.x}
          y1={shape.wickTop}
          y2={shape.wickBottom}
          stroke={color}
          strokeWidth={1}
        />
        <Path
          testID="candle"
          d={bar(shape.x, shape.width, shape.bodyTop, shape.bodyHeight)}
          fill={color}
        />
      </Fragment>
    );
  });
}

function VolumeBars({ shapes, width }: { shapes: readonly CandleShape[]; width: number }) {
  const colors = useColors();
  return (
    <Svg width={width} height={VOLUME_HEIGHT} accessibilityElementsHidden>
      {shapes.map((shape) => (
        <Path
          key={shape.x}
          d={bar(
            shape.x,
            shape.width,
            VOLUME_HEIGHT * (1 - shape.volume),
            VOLUME_HEIGHT * shape.volume,
          )}
          fill={colors['border-strong']}
        />
      ))}
    </Svg>
  );
}

export function PriceChart({
  symbol,
  period,
  type,
  onScrub,
  footer,
}: {
  symbol: string;
  period: Period;
  type: ChartType;
  onScrub: (point: ScrubPoint | null) => void;
  footer?: (change: PeriodChange) => ReactNode;
}) {
  const colors = useColors();
  const { f } = useCopy();
  const { width } = useWindowDimensions();
  const chart = usePriceChart({ symbol, period, type, width, height: HEIGHT, onScrub });
  const stroke = chart.rising ? colors.pos : colors.neg;

  return (
    <View>
      {chart.state === 'loading' ? (
        <ChartSkeleton />
      ) : chart.state === 'error' ? (
        <ChartError period={period} onRetry={chart.retry} />
      ) : (
        <>
          <GestureDetector gesture={chart.scrubGesture}>
            <View accessible accessibilityRole="image" accessibilityLabel={chart.summary}>
              <Svg width={width} height={HEIGHT}>
                <Defs>
                  <LinearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor={stroke} stopOpacity={0.28} />
                    <Stop offset="1" stopColor={stroke} stopOpacity={0} />
                  </LinearGradient>
                </Defs>
                {GRID_LINES.map((f) => (
                  <Line
                    key={f}
                    x1={0}
                    x2={width}
                    y1={HEIGHT * f}
                    y2={HEIGHT * f}
                    stroke={colors['chart-grid']}
                  />
                ))}
                {chart.baselineY === null ? null : (
                  <Line
                    x1={0}
                    x2={width}
                    y1={chart.baselineY}
                    y2={chart.baselineY}
                    stroke={colors['fg-3']}
                    strokeWidth={1}
                    strokeDasharray="2 4"
                  />
                )}
                {type === 'candle' ? (
                  <Candles shapes={chart.candles} />
                ) : (
                  <>
                    <Path d={chart.area} fill="url(#fill)" />
                    <Path
                      d={chart.line}
                      stroke={stroke}
                      strokeWidth={2}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      fill="none"
                    />
                  </>
                )}
                {chart.lastPoint ? (
                  <Circle
                    cx={chart.lastPoint.x}
                    cy={chart.lastPoint.y}
                    r={4}
                    fill={stroke}
                    stroke={colors.bg}
                    strokeWidth={2}
                  />
                ) : null}
                <AnimatedLine
                  animatedProps={chart.crosshairProps}
                  y1={0}
                  y2={HEIGHT}
                  stroke={colors['fg-2']}
                  strokeDasharray="3 3"
                />
                <AnimatedCircle animatedProps={chart.haloProps} r={9} fill={stroke} />
                <AnimatedCircle
                  animatedProps={chart.dotProps}
                  r={5}
                  fill={stroke}
                  stroke={colors.bg}
                  strokeWidth={2}
                />
              </Svg>
            </View>
          </GestureDetector>
          {type === 'candle' ? <VolumeBars shapes={chart.candles} width={width} /> : null}
          {/* The plot is never mirrored, so its time labels run oldest-left too. */}
          <View className="flex-row justify-between px-5 pt-1.5" style={{ direction: 'ltr' }}>
            {chart.axisLabels.map((candle, i) => (
              <Text
                key={candle?.t ?? i}
                variant="caption"
                className="text-fg-3"
                style={{ fontVariant: ['tabular-nums'] }}
              >
                {candle ? f.chartTime(candle.t, period) : ''}
              </Text>
            ))}
          </View>
        </>
      )}
      {footer?.(chart.periodChange)}
    </View>
  );
}
