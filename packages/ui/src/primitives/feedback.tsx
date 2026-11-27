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
  'h-badge inline-flex items-center gap-1.5 px-2 text-xs leading-none font-semibold whitespace-nowrap',
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

// A dismiss button always comes with its label, in the reader's language.
type Dismissible =
  | { onDismiss: () => void; dismissLabel: string }
  | { onDismiss?: undefined; dismissLabel?: undefined };

export type BannerProps = ComponentProps<'div'> &
  Dismissible & {
    tone?: BannerTone;
    icon?: ReactNode;
    action?: ReactNode;
    // Full-width strip under the web nav (W-Global) instead of the rounded card.
    bar?: boolean;
  };

export function Banner({
  tone = 'info',
  icon,
  action,
  onDismiss,
  dismissLabel,
  bar = false,
  className,
  children,
  ...props
}: BannerProps) {
  return (
    <div
      role="status"
      className={cn(
        'type-sm text-fg flex items-center gap-2.5 py-2.5 font-medium [&>svg]:size-4 [&>svg]:shrink-0',
        BANNER_TONE[tone],
        bar ? 'border-x-0 border-t-0 border-b px-6' : 'rounded-control-lg border ps-3.5 pe-2',
        className,
      )}
      {...props}
    >
      {icon}
      <div className="min-w-0 flex-1">{children}</div>
      {action}
      {onDismiss ? (
        <IconButton label={dismissLabel} size={32} onClick={onDismiss}>
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

export type ToastProps = Omit<ComponentProps<'div'>, 'title'> &
  Dismissible & {
    icon?: ReactNode;
    title: string;
    description?: string;
    action?: ReactNode;
  };

export function Toast({
  icon,
  title,
  description,
  action,
  onDismiss,
  dismissLabel,
  className,
  ...props
}: ToastProps) {
  return (
    <div
      role="status"
      className={cn(
        'border-border bg-surface-2 shadow-e2 flex w-90 max-w-full items-start gap-3 rounded-lg border py-3.5 ps-4 pe-3.5 [&>svg]:mt-0.5 [&>svg]:size-5 [&>svg]:shrink-0',
        className,
      )}
      {...props}
    >
      {icon}
      <div className="min-w-0 flex-1">
        <p className="type-sm text-fg font-semibold">{title}</p>
        {description ? <p className="type-sm text-fg-2">{description}</p> : null}
      </div>
      {action}
      {onDismiss ? (
        <IconButton label={dismissLabel} size={32} onClick={onDismiss}>
          <X aria-hidden className="size-4" />
        </IconButton>
      ) : null}
    </div>
  );
}

export type CalloutTone = 'info' | 'warn' | 'neg' | 'neutral' | 'brand';

const CALLOUT_TONE: Record<CalloutTone, { box: string; icon: string }> = {
  info: { box: 'border-info/35 bg-info-subtle', icon: 'text-info' },
  warn: { box: 'border-warn/35 bg-warn-subtle', icon: 'text-warn' },
  neg: { box: 'border-neg/35 bg-neg-subtle', icon: 'text-neg' },
  neutral: { box: 'border-border bg-surface-3', icon: 'text-fg-2' },
  brand: { box: 'border-brand/35 bg-brand-subtle', icon: 'text-brand-fg' },
};

export interface CalloutProps extends Omit<ComponentProps<'div'>, 'title'> {
  tone?: CalloutTone;
  icon?: ReactNode;
  title?: ReactNode;
  action?: ReactNode;
  urgent?: boolean;
}

export function Callout({
  tone = 'info',
  icon,
  title,
  action,
  urgent = false,
  className,
  children,
  ...props
}: CalloutProps) {
  return (
    <div
      role={urgent ? 'alert' : undefined}
      className={cn(
        'type-sm text-fg rounded-control-lg flex items-start gap-3 border px-4 py-3.5',
        CALLOUT_TONE[tone].box,
        className,
      )}
      {...props}
    >
      {icon ? (
        <span aria-hidden className={cn('mt-px shrink-0 [&>svg]:size-4', CALLOUT_TONE[tone].icon)}>
          {icon}
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children}
      </div>
      {action ? <div className="shrink-0 self-center">{action}</div> : null}
    </div>
  );
}

export type ProgressTone = 'brand' | 'warn' | 'pos' | 'neg' | 'info';

const PROGRESS_FILL: Record<ProgressTone, string> = {
  brand: 'bg-brand',
  warn: 'bg-warn',
  pos: 'bg-pos',
  neg: 'bg-neg',
  info: 'bg-info',
};

export interface ProgressBarProps {
  value: number;
  label: string;
  valueText?: string;
  tone?: ProgressTone;
  thin?: boolean;
  className?: string;
}

export function ProgressBar({
  value,
  label,
  valueText,
  tone = 'warn',
  thin = false,
  className,
}: ProgressBarProps) {
  const percent = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-valuetext={valueText}
      className={cn(
        'bg-surface-3 w-full overflow-hidden',
        thin ? 'h-1 rounded-full' : 'h-2 rounded-xs',
        className,
      )}
    >
      <span
        className={cn(
          'block h-full rounded-[inherit] transition-[width] duration-200 ease-linear motion-reduce:transition-none',
          PROGRESS_FILL[tone],
        )}
        style={{ width: `${String(percent)}%` }}
      />
    </div>
  );
}

export function CountdownBar({
  remaining,
  label,
  valueText,
  className,
}: {
  remaining: number;
  label: string;
  valueText?: string;
  className?: string;
}) {
  return (
    <ProgressBar
      value={remaining}
      label={label}
      valueText={valueText}
      tone="brand"
      thin
      className={className}
    />
  );
}

export function CountBadge({
  count,
  max = 9,
  className,
}: {
  count: number;
  max?: number;
  className?: string;
}) {
  if (count <= 0) return null;
  return (
    <span
      aria-hidden
      className={cn(
        'bg-neg text-on-brand border-surface inline-grid h-4.5 min-w-4.5 place-items-center rounded-full border-2 px-1.25 text-[0.6875rem] leading-none font-bold tabular-nums',
        className,
      )}
    >
      {count > max ? `${String(max)}+` : String(count)}
    </span>
  );
}

export function UnreadDot({ label, className }: { label?: string; className?: string }) {
  return (
    <span
      aria-hidden={label ? undefined : true}
      className={cn('bg-brand size-2 shrink-0 rounded-full', className)}
    >
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  );
}
