import * as DialogPrimitive from '@radix-ui/react-dialog';
import { type ReactNode } from 'react';

import { cn } from './cn';

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
}

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
}: DialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="bg-scrim fixed inset-0 z-40" />
        <DialogPrimitive.Content
          className={cn(
            'fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-32px)] w-[calc(100vw-32px)] max-w-[440px] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto',
            'border-border bg-surface-2 shadow-e3 rounded-xl border p-6 focus:outline-none',
            className,
          )}
          {...(description ? {} : { 'aria-describedby': undefined })}
        >
          <div className="flex flex-col gap-1.5">
            <DialogPrimitive.Title className="type-h2 text-fg">{title}</DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="type-sm text-fg-2">
                {description}
              </DialogPrimitive.Description>
            ) : null}
          </div>
          {children}
          {footer ? <div className="flex justify-end gap-2 pt-2">{footer}</div> : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
