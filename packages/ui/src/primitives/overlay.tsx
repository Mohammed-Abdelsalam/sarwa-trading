import * as DialogPrimitive from '@radix-ui/react-dialog';
import * as MenuPrimitive from '@radix-ui/react-dropdown-menu';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { Check, X } from 'lucide-react';
import { type ComponentProps, type ReactNode } from 'react';

import { cn } from '../lib/cn';
import { IconButton } from './button';

interface PanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  hideTitle?: boolean;
  description?: ReactNode;
  header?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
}

function PanelHeading({
  title,
  hideTitle,
  description,
}: Pick<PanelProps, 'title' | 'hideTitle' | 'description'>) {
  return (
    <>
      <DialogPrimitive.Title className={hideTitle ? 'sr-only' : 'type-h2 text-fg'}>
        {title}
      </DialogPrimitive.Title>
      {description ? (
        <DialogPrimitive.Description className="type-sm text-fg-2">
          {description}
        </DialogPrimitive.Description>
      ) : null}
    </>
  );
}

export type DrawerSize = 'sm' | 'md' | 'lg';

const DRAWER_WIDTH: Record<DrawerSize, string> = {
  sm: 'max-w-90',
  md: 'max-w-105',
  lg: 'max-w-140',
};

export interface DrawerProps extends PanelProps {
  closeLabel: string;
  size?: DrawerSize;
  scrim?: boolean;
}

export function Drawer({
  open,
  onOpenChange,
  title,
  hideTitle,
  description,
  header,
  closeLabel,
  size = 'md',
  scrim = true,
  children,
  footer,
  className,
}: DrawerProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className={cn('fixed inset-0 z-40', scrim && 'bg-scrim')} />
        <DialogPrimitive.Content
          className={cn(
            'fixed inset-y-0 end-0 z-50 flex w-full flex-col gap-4 overflow-y-auto',
            'border-border bg-surface-2 shadow-e3 border-s px-5.5 py-5 focus:outline-none',
            DRAWER_WIDTH[size],
            className,
          )}
          {...(description ? {} : { 'aria-describedby': undefined })}
        >
          <div className="flex items-start gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              {header}
              <PanelHeading title={title} hideTitle={hideTitle} description={description} />
            </div>
            <DialogPrimitive.Close asChild>
              <IconButton label={closeLabel} size={32}>
                <X aria-hidden className="size-4" />
              </IconButton>
            </DialogPrimitive.Close>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-4">{children}</div>
          {footer ? <div className="grid auto-cols-fr grid-flow-col gap-2">{footer}</div> : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export function Sheet({
  open,
  onOpenChange,
  title,
  hideTitle,
  description,
  header,
  children,
  footer,
  className,
}: PanelProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="bg-scrim fixed inset-0 z-40" />
        <DialogPrimitive.Content
          className={cn(
            'fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col',
            'bg-surface-2 shadow-e3 rounded-t-[1.5rem] focus:outline-none',
            className,
          )}
          {...(description ? {} : { 'aria-describedby': undefined })}
        >
          <span
            aria-hidden
            className="bg-border-strong mx-auto mt-2 mb-1 h-1.25 w-10 rounded-full"
          />
          <div className="flex flex-col gap-1 px-5 pt-2">
            {header}
            <PanelHeading title={title} hideTitle={hideTitle} description={description} />
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
            {children}
          </div>
          {footer ? (
            <div className="border-border bg-surface grid auto-cols-fr grid-flow-col gap-2.5 border-t px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {footer}
            </div>
          ) : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

const floating = 'border-border bg-surface-2 shadow-e2 z-50 border focus:outline-none';

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverClose = PopoverPrimitive.Close;

export function PopoverContent({
  className,
  sideOffset = 8,
  align = 'end',
  ...props
}: ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        sideOffset={sideOffset}
        align={align}
        className={cn(floating, 'rounded-control-lg', className)}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}

export const Menu = MenuPrimitive.Root;
export const MenuTrigger = MenuPrimitive.Trigger;

export function MenuContent({
  className,
  sideOffset = 6,
  align = 'end',
  ...props
}: ComponentProps<typeof MenuPrimitive.Content>) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Content
        sideOffset={sideOffset}
        align={align}
        className={cn(floating, 'rounded-control-lg flex min-w-52 flex-col p-1.5', className)}
        {...props}
      />
    </MenuPrimitive.Portal>
  );
}

export function MenuItem({
  icon,
  danger = false,
  className,
  children,
  ...props
}: ComponentProps<typeof MenuPrimitive.Item> & { icon?: ReactNode; danger?: boolean }) {
  return (
    <MenuPrimitive.Item
      className={cn(
        'rounded-control-sm flex h-9 cursor-pointer items-center gap-2.5 px-2.5 text-sm outline-none select-none',
        'data-[highlighted]:bg-surface-3 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-40',
        danger ? 'text-neg' : 'text-fg',
        className,
      )}
      {...props}
    >
      {icon ? (
        <span aria-hidden className={cn('[&>svg]:size-4', danger ? 'text-neg' : 'text-fg-3')}>
          {icon}
        </span>
      ) : null}
      {children}
    </MenuPrimitive.Item>
  );
}

export const MenuRadioGroup = MenuPrimitive.RadioGroup;

export function MenuRadioItem({
  className,
  children,
  ...props
}: ComponentProps<typeof MenuPrimitive.RadioItem>) {
  return (
    <MenuPrimitive.RadioItem
      className={cn(
        'rounded-control-sm text-fg flex h-9 cursor-pointer items-center gap-2.5 px-2.5 text-sm outline-none select-none',
        'data-[highlighted]:bg-surface-3 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-40',
        className,
      )}
      {...props}
    >
      <span aria-hidden className="text-brand-fg grid size-4 place-items-center">
        <MenuPrimitive.ItemIndicator>
          <Check className="size-4" />
        </MenuPrimitive.ItemIndicator>
      </span>
      {children}
    </MenuPrimitive.RadioItem>
  );
}

export function MenuLabel({ className, ...props }: ComponentProps<typeof MenuPrimitive.Label>) {
  return (
    <MenuPrimitive.Label
      className={cn('type-overline text-fg-3 px-2.5 pt-2 pb-1.5', className)}
      {...props}
    />
  );
}

export function MenuSeparator({
  className,
  ...props
}: ComponentProps<typeof MenuPrimitive.Separator>) {
  return (
    <MenuPrimitive.Separator
      className={cn('bg-border -mx-1.5 my-1.5 h-px', className)}
      {...props}
    />
  );
}

export function Tooltip({
  content,
  children,
  side = 'top',
  delayDuration = 300,
  className,
}: {
  content: ReactNode;
  children: ReactNode;
  side?: ComponentProps<typeof TooltipPrimitive.Content>['side'];
  delayDuration?: number;
  className?: string;
}) {
  return (
    <TooltipPrimitive.Provider delayDuration={delayDuration}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={side}
            sideOffset={6}
            className={cn(
              'bg-fg text-bg shadow-e2 rounded-control-sm z-50 px-2.5 py-1.5 text-xs leading-4 font-medium',
              className,
            )}
          >
            {content}
            <TooltipPrimitive.Arrow className="fill-fg" width={10} height={5} />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
