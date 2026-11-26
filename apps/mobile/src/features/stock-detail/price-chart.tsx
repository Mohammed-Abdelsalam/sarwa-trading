import { AlertTriangle, RefreshCw } from 'lucide-react-native';
import { useWindowDimensions, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';

import { type Candle, type Period } from '@sarwa/contracts';
import { formatCandleTime } from '@sarwa/core';

import { Button } from '../../components/ui/button';
import { Skeleton } from '../../components/ui/skeleton';
import { Text } from '../../components/ui/text';
import { useColors } from '../../lib/theme';
import { usePriceChart } from './use-price-chart';

const HEIGHT = 236;
const GRID_LINES = [0.25, 0.5, 0.75];

const AnimatedLine = Animated.createAnimatedComponent(Line);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export function PriceChart({
  symbol,
  period,
  onScrub,
}: {
  symbol: string;
  period: Period;
  onScrub: (candle: Candle | null) => void;
}) {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const chart = usePriceChart({ symbol, period, width, height: HEIGHT, onScrub });
  const stroke = chart.rising ? colors.pos : colors.neg;

  if (chart.state === 'loading') {
    return (
      <View
        accessibilityLabel="Loading chart"
        className="gap-3 px-5"
        style={{ height: HEIGHT + 24 }}
      >
        <Skeleton className="h-[200px] w-full rounded-lg" />
        <Skeleton className="h-3 w-full" />
      </View>
    );
  }

  if (chart.state === 'error') {
    return (
      <View
        accessibilityRole="alert"
        className="items-center justify-center gap-2 px-8"
        style={{ height: HEIGHT + 24 }}
      >
        <AlertTriangle size={24} color={colors.neg} />
        <Text variant="h3">Chart unavailable</Text>
        <Text variant="sm" className="text-center text-fg-2">
          {`We couldn't load ${period} history. Live price above is still updating.`}
        </Text>
        <Button
          label="Retry"
          variant="secondary"
          size="sm"
          icon={<RefreshCw size={16} color={colors.fg} />}
          onPress={chart.retry}
        />
      </View>
    );
  }

  return (
    <View>
      <GestureDetector gesture={chart.scrubGesture}>
        <View
          accessible
          accessibilityRole="image"
          accessibilityLabel={`${symbol} price chart, ${period}, ${chart.rising ? 'up' : 'down'} over the period`}
        >
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
            <Path d={chart.area} fill="url(#fill)" />
            <Path
              d={chart.line}
              stroke={stroke}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              fill="none"
            />
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
      <View className="flex-row justify-between px-5 pt-1.5">
        {chart.axisLabels.map((candle, i) => (
          <Text
            key={candle?.t ?? i}
            variant="caption"
            className="text-fg-3"
            style={{ fontVariant: ['tabular-nums'] }}
          >
            {candle ? formatCandleTime(candle.t, period) : ''}
          </Text>
        ))}
      </View>
    </View>
  );
}
