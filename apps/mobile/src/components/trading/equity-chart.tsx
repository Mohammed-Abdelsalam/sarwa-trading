import { useId, useState } from 'react';
import { View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { chartGeometry } from '@sarwa/core';

import { useColors } from '../../lib/theme';

export function EquityChart({
  values,
  height,
  rising,
  label,
}: {
  values: readonly number[];
  height: number;
  rising: boolean;
  label?: string;
}) {
  const colors = useColors();
  const [width, setWidth] = useState(0);
  const gradient = useId();
  const stroke = rising ? colors.pos : colors.neg;
  const geometry = chartGeometry(values, width, height, 4);

  return (
    <View
      accessible={label !== undefined}
      accessibilityRole={label ? 'image' : undefined}
      accessibilityLabel={label}
      importantForAccessibility={label ? 'yes' : 'no-hide-descendants'}
      style={{ height }}
      onLayout={(event) => {
        setWidth(event.nativeEvent.layout.width);
      }}
    >
      {width > 0 ? (
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={stroke} stopOpacity={0.22} />
              <Stop offset="1" stopColor={stroke} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Path d={geometry.area} fill={`url(#${gradient})`} />
          <Path d={geometry.line} stroke={stroke} strokeWidth={2} fill="none" />
        </Svg>
      ) : null}
    </View>
  );
}
