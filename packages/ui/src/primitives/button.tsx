import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';
import { type ComponentProps, type ReactNode } from 'react';

import { type ButtonSize, type ButtonVariant, type IconButtonSize } from '@sarwa/tokens';

import { cn } from '../lib/cn';

const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';

export const buttonVariants = cva(
  [
    'inline-flex shrink-0 cursor-pointer select-none items-center justify-center gap-2 whitespace-nowrap border border-transparent',
    'ease-standard duration-120 active:scale-98 transition-[background-color,border-color,transform]',
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
        danger: 'bg-danger text-on-brand hover:bg-danger-hover active:bg-danger-press',
      } satisfies Record<ButtonVariant, string>,
      size: {
        sm: 'type-sm rounded-control-sm h-8 gap-1.5 px-3 font-semibold',
        md: 'type-button h-10 rounded-md px-4',
        lg: 'type-button-lg rounded-control-lg h-12 px-5',
      } satisfies Record<ButtonSize, string>,
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps extends ComponentProps<'button'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  asChild?: boolean;
  loading?: boolean;
}

export function Button({
  className,
  variant,
  size,
  icon,
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
          {loading ? <Spinner /> : icon}
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

const ICON_BUTTON_SIZE: Record<IconButtonSize, string> = {
  32: 'rounded-control-sm size-8',
  40: 'size-10 rounded-md',
  44: 'rounded-control-lg size-11',
};

export interface IconButtonProps extends ComponentProps<'button'> {
  label: string;
  size?: IconButtonSize;
  solid?: boolean;
}

export function IconButton({
  label,
  size = 40,
  solid = false,
  className,
  ...props
}: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'text-fg-2 duration-120 inline-grid shrink-0 cursor-pointer place-items-center border border-transparent transition-colors',
        'hover:bg-surface-3 hover:text-fg active:bg-border active:scale-96 disabled:cursor-not-allowed disabled:opacity-40',
        focusRing,
        ICON_BUTTON_SIZE[size],
        solid && 'border-border bg-surface-3',
        className,
      )}
      {...props}
    />
  );
}
