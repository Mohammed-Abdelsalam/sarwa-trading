import { type Sector } from '@sarwa/contracts';
import { type AvatarSize } from '@sarwa/tokens';

import { cn } from '../lib/cn';

const AVATAR_SIZES: Record<AvatarSize, string> = {
  32: 'type-avatar-sm size-8 rounded-md',
  40: 'type-avatar rounded-control-lg size-10',
  56: 'type-avatar-lg rounded-avatar-lg size-14',
};

const SECTOR_STYLES: Record<Sector, string> = {
  tech: 'bg-sector-tech-subtle text-sector-tech',
  fin: 'bg-sector-fin-subtle text-sector-fin',
  energy: 'bg-sector-energy-subtle text-sector-energy',
  health: 'bg-sector-health-subtle text-sector-health',
  consumer: 'bg-sector-consumer-subtle text-sector-consumer',
  media: 'bg-sector-media-subtle text-sector-media',
};

export function StockAvatar({
  symbol,
  sector,
  size = 40,
  className,
}: {
  symbol: string;
  sector: Sector;
  size?: AvatarSize;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'grid shrink-0 place-items-center',
        AVATAR_SIZES[size],
        SECTOR_STYLES[sector],
        className,
      )}
    >
      {symbol.charAt(0)}
    </span>
  );
}
