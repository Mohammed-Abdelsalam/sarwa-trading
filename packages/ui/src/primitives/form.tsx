import * as SliderPrimitive from '@radix-ui/react-slider';
import * as SwitchPrimitive from '@radix-ui/react-switch';
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

export interface InputProps extends ComponentProps<'input'> {
  icon?: ReactNode;
  inputSize?: InputSize;
}

export function Input({ icon, inputSize = 'md', className, ...props }: InputProps) {
  const input = (
    <input
      className={cn(
        inputBase,
        inputSize === 'lg' && 'rounded-control-lg type-body h-11',
        icon !== undefined && 'pl-10',
        className,
      )}
      {...props}
    />
  );
  if (icon === undefined) return input;
  return (
    <div className="relative flex w-full items-center">
      <span className="text-fg-3 pointer-events-none absolute left-3 [&>svg]:size-4" aria-hidden>
        {icon}
      </span>
      {input}
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
      <SwitchPrimitive.Thumb className="ease-standard shadow-e1 translate-x-0.75 data-[state=checked]:translate-x-5.25 block size-5 rounded-full bg-white transition-transform duration-200" />
    </SwitchPrimitive.Root>
  );
}

export function Slider({ className, ...props }: ComponentProps<typeof SliderPrimitive.Root>) {
  return (
    <SliderPrimitive.Root
      className={cn(
        'relative flex h-7 w-full touch-none select-none items-center data-[disabled]:opacity-40',
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
