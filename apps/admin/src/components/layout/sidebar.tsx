import { PanelLeft } from 'lucide-react';
import Link from 'next/link';
import { type ReactElement } from 'react';

import { useI18n } from '@sarwa/core';
import { Badge, cn, Logo, Tooltip } from '@sarwa/ui';

import { NAV, type NavKey } from './nav';

const item =
  'text-fg-2 hover:bg-surface-3 hover:text-fg focus-visible:outline-focus flex h-10 items-center gap-3 rounded-[10px] px-3 text-sm font-semibold whitespace-nowrap focus-visible:outline-2 [&>svg]:size-4.5 [&>svg]:shrink-0';

export function Sidebar({
  active,
  collapsed,
  version,
  onToggle,
}: {
  active: NavKey;
  collapsed: boolean;
  version: string | null;
  onToggle: () => void;
}) {
  const { t } = useI18n();
  const withTip = (label: string, node: ReactElement) =>
    collapsed ? (
      <Tooltip content={label} side="right">
        {node}
      </Tooltip>
    ) : (
      node
    );

  return (
    <aside
      data-collapsed={collapsed}
      className={cn(
        'border-border bg-surface flex shrink-0 flex-col gap-0.5 border-e px-3 py-4 transition-[width] duration-200',
        collapsed ? 'w-19 items-center' : 'w-61',
      )}
    >
      <div className="flex h-13 items-center gap-2.5 px-2 pt-1 pb-4">
        <Logo showName={!collapsed} className="text-[0.9375rem]" />
        {collapsed ? null : (
          <Badge tone="brand" className="h-5 text-[0.6875rem]">
            {t.admin.shell.admin}
          </Badge>
        )}
      </div>
      <nav className="flex flex-col gap-0.5" aria-label={t.admin.shell.navLabel}>
        {NAV.map(({ key, href, icon: Icon }) => {
          const current = key === active;
          return (
            <span key={key} className="contents">
              {withTip(
                t.admin.nav[key],
                <Link
                  href={href}
                  aria-current={current ? 'page' : undefined}
                  aria-label={collapsed ? t.admin.nav[key] : undefined}
                  className={cn(
                    item,
                    current &&
                      'bg-brand-subtle text-brand-fg hover:bg-brand-subtle hover:text-brand-fg',
                    collapsed && 'size-11 justify-center px-0',
                  )}
                >
                  <Icon aria-hidden />
                  {collapsed ? null : <span>{t.admin.nav[key]}</span>}
                </Link>,
              )}
            </span>
          );
        })}
      </nav>
      <div className="flex-1" />
      {collapsed || version === null ? null : (
        <div className="bg-surface-3 mx-1 mb-3 flex flex-col gap-1.5 rounded-lg p-3">
          <span className="type-caption text-fg-3">{t.admin.shell.simulator}</span>
          <span className="type-sm font-semibold tabular-nums">{version}</span>
        </div>
      )}
      {withTip(
        t.admin.shell.expandSidebar,
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? t.admin.shell.expandSidebar : t.admin.shell.collapseSidebar}
          aria-expanded={!collapsed}
          className={cn(item, 'w-full cursor-pointer', collapsed && 'size-11 justify-center px-0')}
        >
          <PanelLeft aria-hidden className="rtl:-scale-x-100" />
          {collapsed ? null : <span>{t.admin.shell.collapse}</span>}
        </button>,
      )}
    </aside>
  );
}
