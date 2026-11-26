import { type Sector } from '@sarwa/contracts';

import { cn } from '../lib/cn';

const AVATAR_SIZES = {
  sm: 'size-8 rounded-[10px] text-[13px]',
  md: 'size-10 rounded-[12px] text-base',
  lg: 'size-14 rounded-[16px] text-[22px]',
} as const;

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
  size = 'md',
  className,
}: {
  symbol: string;
  sector: Sector;
  size?: keyof typeof AVATAR_SIZES;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'font-display grid shrink-0 place-items-center font-extrabold leading-none',
        AVATAR_SIZES[size],
        SECTOR_STYLES[sector],
        className,
      )}
    >
      {symbol.charAt(0)}
    </span>
  );
}
