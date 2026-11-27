import * as SliderPrimitive from '@radix-ui/react-slider';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import { ChevronDown } from 'lucide-react';
import { type ComponentProps, type ReactNode, useId } from 'react';

import { type InputSize } from '@sarwa/tokens';

import { cn } from '../lib/cn';

const inputBase = [
  'h-10 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-fg outline-none dark:bg-surface-2',
  'transition-[border-color,box-shadow] duration-120 placeholder:text-fg-3 hover:border-fg-3',
  'focus:border-brand focus:ring-3 focus:ring-brand-subtle',
  'aria-invalid:border-neg aria-invalid:ring-3 aria-invalid:ring-neg-subtle',
  'disabled:cursor-not-allowed disabled:opacity-50',
];

export interface InputProps extends Omit<ComponentProps<'input'>, 'prefix'> {
  icon?: ReactNode;
  prefix?: ReactNode;
  suffix?: ReactNode;
  inputSize?: InputSize;
}

const affix = 'text-fg-3 pointer-events-none absolute [&>svg]:size-4';

export function Input({ icon, prefix, suffix, inputSize = 'md', className, ...props }: InputProps) {
  const lead = icon ?? prefix;
  const input = (
    <input
      className={cn(
        inputBase,
        inputSize === 'lg' && 'rounded-control-lg type-body h-11',
        icon !== undefined ? 'ps-10' : prefix !== undefined && 'ps-7',
        suffix !== undefined && 'pe-8',
        className,
      )}
      {...props}
    />
  );
  if (lead === undefined && suffix === undefined) return input;
  return (
    <div className="relative flex w-full items-center">
      {lead === undefined ? null : (
        <span className={cn(affix, 'start-3')} aria-hidden>
          {lead}
        </span>
      )}
      {input}
      {suffix === undefined ? null : (
        <span className={cn(affix, 'end-3')} aria-hidden>
          {suffix}
        </span>
      )}
    </div>
  );
}

export function Select({ className, ...props }: ComponentProps<'select'>) {
  return (
    <div className="relative inline-flex items-center">
      <select
        className={cn(inputBase, 'cursor-pointer appearance-none pe-9', className)}
        {...props}
      />
      <ChevronDown aria-hidden className="text-fg-3 pointer-events-none absolute end-3 size-4" />
    </div>
  );
}

export interface FieldProps {
  label: string;
  hint?: string;
  error?: string | undefined;
  children: (props: {
    id: string;
    'aria-invalid': boolean;
    'aria-describedby': string | undefined;
  }) => ReactNode;
}

export function Field({ label, hint, error, children }: FieldProps) {
  const id = useId();
  const messageId = `${id}-message`;
  const message = error ?? hint;
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="type-sm text-fg font-semibold">
        {label}
      </label>
      {children({
        id,
        'aria-invalid': error !== undefined,
        'aria-describedby': message ? messageId : undefined,
      })}
      {message ? (
        <p
          id={messageId}
          className={cn('text-xs', error ? 'text-neg font-medium' : 'text-fg-3')}
          role={error ? 'alert' : undefined}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}

export function Switch({ className, ...props }: ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        'bg-border-strong ease-standard h-switch relative w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200',
        'focus-visible:outline-focus focus-visible:outline-2 focus-visible:outline-offset-2',
        'data-[state=checked]:bg-brand disabled:cursor-not-allowed disabled:opacity-40',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="ease-standard shadow-e1 block size-5 translate-x-0.75 rounded-full bg-white transition-transform duration-200 data-[state=checked]:translate-x-5.25 rtl:-translate-x-0.75 rtl:data-[state=checked]:-translate-x-5.25" />
    </SwitchPrimitive.Root>
  );
}

export function Slider({ className, ...props }: ComponentProps<typeof SliderPrimitive.Root>) {
  return (
    <SliderPrimitive.Root
      className={cn(
        'relative flex h-7 w-full touch-none items-center select-none data-[disabled]:opacity-40',
        className,
      )}
      {...props}
    >
      <SliderPrimitive.Track className="bg-border-strong relative h-1.5 grow rounded-full">
        <SliderPrimitive.Range className="bg-brand absolute h-full rounded-full" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb className="border-brand shadow-e2 focus-visible:outline-focus size-thumb block rounded-full border-2 bg-white focus-visible:outline-2 focus-visible:outline-offset-4" />
    </SliderPrimitive.Root>
  );
}
