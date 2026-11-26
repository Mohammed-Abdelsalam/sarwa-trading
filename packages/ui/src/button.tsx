import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { type ComponentProps } from 'react';

import { cn } from './cn';

const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';

export const buttonVariants = cva(
  [
    'inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 border border-transparent font-semibold whitespace-nowrap select-none',
    'ease-standard transition-[background-color,border-color,transform] duration-[120ms] active:scale-[0.98]',
    'disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100',
    focusRing,
  ],
  {
    variants: {
      variant: {
        primary: 'bg-brand text-on-brand hover:bg-brand-hover active:bg-brand-press',
        secondary:
          'border-border bg-surface-3 text-fg hover:border-border-strong hover:bg-border active:bg-border-strong',
        ghost: 'text-fg hover:bg-surface-3 active:bg-border bg-transparent',
        danger: 'bg-danger hover:bg-danger-hover active:bg-danger-press text-white',
      },
      size: {
        sm: 'h-8 gap-1.5 rounded-[8px] px-3 text-[13px]',
        md: 'h-10 rounded-md px-4 text-sm',
        lg: 'h-12 rounded-[12px] px-5 text-[15px]',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps extends ComponentProps<'button'>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export function Button({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const Component = asChild ? Slot : 'button';
  return (
    <Component
      className={cn(buttonVariants({ variant, size }), loading && 'pointer-events-none', className)}
      disabled={disabled ?? loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {loading ? <Spinner /> : null}
          {children}
        </>
      )}
    </Component>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-block size-4 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent',
        className,
      )}
    />
  );
}

const iconButtonVariants = cva(
  [
    'text-fg-2 inline-grid shrink-0 cursor-pointer place-items-center border border-transparent transition-colors duration-[120ms]',
    'hover:bg-surface-3 hover:text-fg active:bg-border active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-40',
    focusRing,
  ],
  {
    variants: {
      size: { sm: 'size-8 rounded-[8px]', md: 'size-10 rounded-md', lg: 'size-11 rounded-[12px]' },
      solid: { true: 'border-border bg-surface-3', false: '' },
    },
    defaultVariants: { size: 'md', solid: false },
  },
);

export interface IconButtonProps
  extends ComponentProps<'button'>, VariantProps<typeof iconButtonVariants> {
  label: string;
}

export function IconButton({ label, size, solid, className, ...props }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(iconButtonVariants({ size, solid }), className)}
      {...props}
    />
  );
}
