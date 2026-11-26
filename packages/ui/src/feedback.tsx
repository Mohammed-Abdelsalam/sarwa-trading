import { cva, type VariantProps } from 'class-variance-authority';
import { type ComponentProps, type ReactNode } from 'react';

import { cn } from './cn';

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
  'inline-flex h-[22px] items-center gap-1.5 px-2 text-xs leading-none font-semibold whitespace-nowrap',
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
      },
      square: { true: 'rounded-sm', false: 'rounded-full' },
    },
    defaultVariants: { tone: 'neutral', square: false },
  },
);

export interface BadgeProps extends ComponentProps<'span'>, VariantProps<typeof badgeVariants> {}

export function Badge({ tone, square, className, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone, square }), className)} {...props} />;
}

export function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      aria-hidden
      className={cn(
        'animate-shimmer rounded-sm bg-[linear-gradient(90deg,var(--color-surface-3)_25%,var(--color-border)_40%,var(--color-surface-3)_60%)] bg-[length:400%_100%]',
        className,
      )}
      {...props}
    />
  );
}

const bannerVariants = cva(
  'text-fg flex items-center gap-2.5 rounded-[12px] border py-2.5 pr-2 pl-3.5 text-[13px] leading-[18px] font-medium',
  {
    variants: {
      tone: {
        info: 'border-info/30 bg-info-subtle [&>svg]:text-info',
        warning: 'border-warn/30 bg-warn-subtle [&>svg]:text-warn',
        neutral: 'border-border bg-surface-3 [&>svg]:text-fg-2',
        brand: 'border-brand/35 bg-brand-subtle [&>svg]:text-brand-fg',
      },
    },
    defaultVariants: { tone: 'info' },
  },
);

export interface BannerProps extends ComponentProps<'div'>, VariantProps<typeof bannerVariants> {
  icon?: ReactNode;
  action?: ReactNode;
}

export function Banner({ tone, icon, action, className, children, ...props }: BannerProps) {
  return (
    <div role="status" className={cn(bannerVariants({ tone }), className)} {...props}>
      {icon}
      <div className="min-w-0 flex-1">{children}</div>
      {action}
    </div>
  );
}

export interface StateViewProps {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  tone?: 'neutral' | 'neg' | 'brand';
  className?: string;
}

export function StateView({
  icon,
  title,
  description,
  action,
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
          'grid size-[72px] place-items-center rounded-[22px] [&>svg]:size-8',
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
    </div>
  );
}
