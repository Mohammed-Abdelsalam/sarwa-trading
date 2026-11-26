import { View } from 'react-native';

import { type Sector } from '@sarwa/contracts';

import { cx } from '../../lib/theme';
import { Text } from '../ui/text';

const SECTOR_CLASSES: Record<Sector, [string, string]> = {
  tech: ['bg-sector-tech-subtle', 'text-sector-tech'],
  fin: ['bg-sector-fin-subtle', 'text-sector-fin'],
  energy: ['bg-sector-energy-subtle', 'text-sector-energy'],
  health: ['bg-sector-health-subtle', 'text-sector-health'],
  consumer: ['bg-sector-consumer-subtle', 'text-sector-consumer'],
  media: ['bg-sector-media-subtle', 'text-sector-media'],
};

export function StockAvatar({
  symbol,
  sector,
  size = 40,
}: {
  symbol: string;
  sector: Sector;
  size?: 40 | 56;
}) {
  const [bg, fg] = SECTOR_CLASSES[sector];
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className={cx('items-center justify-center', bg)}
      style={{ width: size, height: size, borderRadius: size === 40 ? 12 : 16 }}
    >
      <Text
        className={fg}
        style={{
          fontFamily: 'Manrope_800ExtraBold',
          fontSize: size === 40 ? 16 : 22,
          lineHeight: size === 40 ? 20 : 26,
        }}
      >
        {symbol.charAt(0)}
      </Text>
    </View>
  );
}
