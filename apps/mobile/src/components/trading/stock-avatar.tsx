import { View } from 'react-native';

import { type Sector } from '@sarwa/contracts';
import { type AvatarSize } from '@sarwa/tokens';

import { cx } from '../../lib/theme';
import { Text, type TextVariant } from '../ui/text';

const SECTOR_CLASSES: Record<Sector, [bg: string, fg: string]> = {
  tech: ['bg-sector-tech-subtle', 'text-sector-tech'],
  fin: ['bg-sector-fin-subtle', 'text-sector-fin'],
  energy: ['bg-sector-energy-subtle', 'text-sector-energy'],
  health: ['bg-sector-health-subtle', 'text-sector-health'],
  consumer: ['bg-sector-consumer-subtle', 'text-sector-consumer'],
  media: ['bg-sector-media-subtle', 'text-sector-media'],
};

const SIZE: Record<AvatarSize, [box: string, text: TextVariant]> = {
  32: ['h-8 w-8 rounded-md', 'avatar-sm'],
  40: ['h-10 w-10 rounded-control-lg', 'avatar'],
  56: ['h-14 w-14 rounded-avatar-lg', 'avatar-lg'],
};

export function StockAvatar({
  symbol,
  sector,
  size = 40,
}: {
  symbol: string;
  sector: Sector;
  size?: AvatarSize;
}) {
  const [bg, fg] = SECTOR_CLASSES[sector];
  const [box, text] = SIZE[size];
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className={cx('items-center justify-center', box, bg)}
    >
      <Text variant={text} className={fg}>
        {symbol.charAt(0)}
      </Text>
    </View>
  );
}
