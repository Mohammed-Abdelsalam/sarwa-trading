import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { type ReactNode, useRef } from 'react';

import { cn } from '../lib/cn';
import { IconButton } from './button';

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  header?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  closeLabel?: string;
  // Screen readers start on the title instead of the first field (the auth gate).
  focusTitle?: boolean;
  className?: string;
}

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  header,
  children,
  footer,
  closeLabel,
  focusTitle = false,
  className,
}: DialogProps) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="bg-scrim fixed inset-0 z-40" />
        <DialogPrimitive.Content
          className={cn(
            'max-w-dialog fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-32px)] w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto',
            'border-border bg-surface-2 shadow-e3 rounded-dialog border p-6 focus:outline-none',
            className,
          )}
          onOpenAutoFocus={
            focusTitle
              ? (event) => {
                  event.preventDefault();
                  titleRef.current?.focus();
                }
              : undefined
          }
          {...(description ? {} : { 'aria-describedby': undefined })}
        >
          <div className="flex items-start gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              {header}
              <DialogPrimitive.Title
                ref={titleRef}
                tabIndex={focusTitle ? -1 : undefined}
                className="type-h2 text-fg focus:outline-none"
              >
                {title}
              </DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description className="type-sm text-fg-2">
                  {description}
                </DialogPrimitive.Description>
              ) : null}
            </div>
            {closeLabel ? (
              <DialogPrimitive.Close asChild>
                <IconButton label={closeLabel} size={32}>
                  <X aria-hidden className="size-4" />
                </IconButton>
              </DialogPrimitive.Close>
            ) : null}
          </div>
          {children}
          {footer ? <div className="flex justify-end gap-2 pt-2">{footer}</div> : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
