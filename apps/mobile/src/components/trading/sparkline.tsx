import { memo } from 'react';
import Svg, { Path } from 'react-native-svg';

import { chartGeometry, type Direction } from '@sarwa/core';

import { useColors } from '../../lib/theme';

export const Sparkline = memo(function Sparkline({
  values,
  direction,
  width = 52,
  height = 24,
}: {
  values: readonly number[];
  direction: Direction;
  width?: number;
  height?: number;
}) {
  const colors = useColors();
  const stroke = { up: colors.pos, down: colors.neg, flat: colors.flat }[direction];
  return (
    <Svg width={width} height={height} accessibilityElementsHidden importantForAccessibility="no">
      <Path
        d={chartGeometry(values, width, height).line}
        stroke={stroke}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
});
