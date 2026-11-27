import { Bell, CircleCheck, Clock, type LucideIcon, Megaphone, TriangleAlert } from 'lucide-react';
import Link from 'next/link';

import {
  Button,
  cn,
  CountBadge,
  IconButton,
  Popover,
  PopoverContent,
  PopoverTrigger,
  UnreadDot,
} from '@sarwa/ui';

import {
  type NotificationRow,
  type NotificationTone,
  useNotificationCenter,
} from './use-notification-center';

export const NOTIFICATION_ICONS: Record<NotificationTone, { icon: LucideIcon; className: string }> =
  {
    pos: { icon: CircleCheck, className: 'text-pos' },
    neg: { icon: TriangleAlert, className: 'text-neg' },
    brand: { icon: Bell, className: 'text-brand-fg' },
    info: { icon: Megaphone, className: 'text-info' },
    muted: { icon: Clock, className: 'text-fg-3' },
  };

export function NotificationIcon({ tone }: { tone: NotificationTone }) {
  const { icon: Icon, className } = NOTIFICATION_ICONS[tone];
  return <Icon aria-hidden className={cn('mt-0.5 size-4.5 shrink-0', className)} />;
}

function Row({
  row,
  unreadLabel,
  onSelect,
}: {
  row: NotificationRow;
  unreadLabel: string;
  onSelect: (row: NotificationRow) => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={() => {
          onSelect(row);
        }}
        className="border-border hover:bg-surface-3 focus-visible:outline-focus grid w-full cursor-pointer grid-cols-[1.25rem_minmax(0,1fr)_0.5rem] gap-3 border-b px-4 py-3 text-start focus-visible:outline-2 focus-visible:-outline-offset-2"
      >
        <NotificationIcon tone={row.tone} />
        <span className="min-w-0">
          <span className="flex justify-between gap-2">
            <b className="type-sm">{row.title}</b>
            <span className="type-caption text-fg-3 whitespace-nowrap">{row.when}</span>
          </span>
          <span className="type-caption text-fg-2 block">{row.body}</span>
        </span>
        {row.unread ? <UnreadDot label={unreadLabel} className="mt-1.5" /> : <span />}
      </button>
    </li>
  );
}

export function NotificationCenter() {
  const center = useNotificationCenter();
  const { labels } = center;
  const groups = [
    { key: 'today', title: labels.today, rows: center.today },
    { key: 'earlier', title: labels.earlier, rows: center.earlier },
  ].filter((group) => group.rows.length > 0);

  return (
    <Popover open={center.open} onOpenChange={center.setOpen}>
      <PopoverTrigger asChild>
        <IconButton label={labels.bell} className="relative">
          <Bell aria-hidden className="size-5" />
          <CountBadge count={center.unreadCount} className="absolute end-1 top-1" />
        </IconButton>
      </PopoverTrigger>
      <PopoverContent
        aria-label={labels.title}
        className="flex max-h-[min(36rem,calc(100dvh-6rem))] w-100 max-w-[calc(100vw-2rem)] flex-col overflow-hidden"
      >
        <div className="border-border flex items-center justify-between border-b px-4 py-3.5">
          <b>{labels.title}</b>
          {center.unreadCount > 0 ? (
            <button
              type="button"
              onClick={center.markAllRead}
              className="type-sm text-brand-fg focus-visible:outline-focus cursor-pointer rounded-xs font-semibold focus-visible:outline-2"
            >
              {labels.markAllRead}
            </button>
          ) : null}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {groups.length === 0 ? (
            <p className="type-sm text-fg-3 px-4 py-8 text-center">{labels.empty}</p>
          ) : (
            groups.map((group) => (
              <section key={group.key} aria-label={group.title}>
                <h3 className="type-overline text-fg-3 px-4 pt-3 pb-1">{group.title}</h3>
                <ul>
                  {group.rows.map((row) => (
                    <Row
                      key={row.id}
                      row={row}
                      unreadLabel={labels.unread}
                      onSelect={center.select}
                    />
                  ))}
                </ul>
              </section>
            ))
          )}
          {center.hasMore ? (
            <Button
              variant="ghost"
              size="sm"
              loading={center.isLoadingMore}
              onClick={center.loadMore}
              className="mx-auto my-2 flex"
            >
              {labels.loadMore}
            </Button>
          ) : null}
        </div>
        <Link
          href="/settings"
          onClick={() => {
            center.setOpen(false);
          }}
          className="type-sm text-brand-fg focus-visible:outline-focus block p-3 text-center font-semibold focus-visible:outline-2 focus-visible:-outline-offset-2"
        >
          {labels.settings}
        </Link>
      </PopoverContent>
    </Popover>
  );
}
