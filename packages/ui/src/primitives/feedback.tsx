import { cva } from 'class-variance-authority';
import { X } from 'lucide-react';
import { type ComponentProps, type ReactNode } from 'react';

import { type BadgeTone, type BannerTone, type StateTone } from '@sarwa/tokens';

import { cn } from '../lib/cn';
import { IconButton } from './button';

export function Card({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'border-border bg-surface shadow-e1 rounded-lg border dark:shadow-none',
        className,
      )}
      {...props}
    />
  );
}

const badgeVariants = cva(
  'h-badge inline-flex items-center gap-1.5 whitespace-nowrap px-2 text-xs font-semibold leading-none',
  {
    variants: {
      tone: {
        neutral: 'bg-flat-subtle text-fg-2',
        pos: 'bg-pos-subtle text-pos',
        neg: 'bg-neg-subtle text-neg',
        warn: 'bg-warn-subtle text-warn',
        info: 'bg-info-subtle text-info',
        brand: 'bg-brand-subtle text-brand-fg',
        outline: 'border-border-strong text-fg-2 border bg-transparent',
      } satisfies Record<BadgeTone, string>,
      square: { true: 'rounded-sm', false: 'rounded-full' },
    },
    defaultVariants: { tone: 'neutral', square: false },
  },
);

export interface BadgeProps extends ComponentProps<'span'> {
  tone?: BadgeTone;
  square?: boolean;
}

export function Badge({ tone, square, className, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone, square }), className)} {...props} />;
}

export function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      aria-hidden
      className={cn('skeleton-shimmer animate-shimmer rounded-sm', className)}
      {...props}
    />
  );
}

const BANNER_TONE: Record<BannerTone, string> = {
  info: 'border-info/30 bg-info-subtle [&>svg]:text-info',
  warn: 'border-warn/30 bg-warn-subtle [&>svg]:text-warn',
  neutral: 'border-border bg-surface-3 [&>svg]:text-fg-2',
  brand: 'border-brand/35 bg-brand-subtle [&>svg]:text-brand-fg',
};

export interface BannerProps extends ComponentProps<'div'> {
  tone?: BannerTone;
  icon?: ReactNode;
  action?: ReactNode;
  onDismiss?: () => void;
}

export function Banner({
  tone = 'info',
  icon,
  action,
  onDismiss,
  className,
  children,
  ...props
}: BannerProps) {
  return (
    <div
      role="status"
      className={cn(
        'type-sm text-fg rounded-control-lg flex items-center gap-2.5 border py-2.5 pl-3.5 pr-2 font-medium',
        BANNER_TONE[tone],
        className,
      )}
      {...props}
    >
      {icon}
      <div className="min-w-0 flex-1">{children}</div>
      {action}
      {onDismiss ? (
        <IconButton label="Dismiss message" size={32} onClick={onDismiss}>
          <X aria-hidden className="size-4" />
        </IconButton>
      ) : null}
    </div>
  );
}

export interface StateViewProps {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  footnote?: string;
  tone?: StateTone;
  className?: string;
}

export function StateView({
  icon,
  title,
  description,
  action,
  footnote,
  tone = 'neutral',
  className,
}: StateViewProps) {
  return (
    <div
      className={cn('flex flex-col items-center gap-3 px-6 py-8 text-center', className)}
      role={tone === 'neg' ? 'alert' : undefined}
    >
      <div
        aria-hidden
        className={cn(
          'size-art rounded-art grid place-items-center [&>svg]:size-8',
          tone === 'neutral' && 'bg-surface-3 text-fg-2',
          tone === 'neg' && 'bg-neg-subtle text-neg',
          tone === 'brand' && 'bg-brand-subtle text-brand-fg',
        )}
      >
        {icon}
      </div>
      <h3 className="type-h3 text-fg">{title}</h3>
      {description ? <p className="type-sm text-fg-2 max-w-sm">{description}</p> : null}
      {action}
      {footnote ? <p className="type-caption text-fg-3">{footnote}</p> : null}
    </div>
  );
}
