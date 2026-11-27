import { PanelLeft } from 'lucide-react';
import Link from 'next/link';
import { type ReactElement } from 'react';

import { useAdminI18n } from '@sarwa/core/admin';
import { Badge, cn, Drawer, Logo, Tooltip } from '@sarwa/ui';

import { NAV, type NavKey } from './nav';

const item =
  'text-fg-2 hover:bg-surface-3 hover:text-fg focus-visible:outline-focus flex h-10 items-center gap-3 rounded-[10px] px-3 text-sm font-semibold whitespace-nowrap focus-visible:outline-2 [&>svg]:size-4.5 [&>svg]:shrink-0';

function Brand({ showName }: { showName: boolean }) {
  const { t } = useAdminI18n();
  return (
    <div className="flex h-13 items-center gap-2.5 px-2 pt-1 pb-4">
      <Logo showName={showName} className="text-[0.9375rem]" />
      {showName ? (
        <Badge tone="brand" className="h-5 text-[0.6875rem]">
          {t.admin.shell.admin}
        </Badge>
      ) : null}
    </div>
  );
}

function NavLinks({
  active,
  collapsed = false,
  onNavigate,
}: {
  active: NavKey;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const { t } = useAdminI18n();
  return (
    <nav className="flex flex-col gap-0.5" aria-label={t.admin.shell.navLabel}>
      {NAV.map(({ key, href, icon: Icon }) => {
        const label = t.admin.nav[key];
        const link = (
          <Link
            href={href}
            onClick={onNavigate}
            aria-current={key === active ? 'page' : undefined}
            aria-label={collapsed ? label : undefined}
            className={cn(
              item,
              key === active &&
                'bg-brand-subtle text-brand-fg hover:bg-brand-subtle hover:text-brand-fg',
              collapsed && 'size-11 justify-center px-0',
            )}
          >
            <Icon aria-hidden />
            {collapsed ? null : <span>{label}</span>}
          </Link>
        );
        return (
          <span key={key} className="contents">
            {collapsed ? (
              <Tooltip content={label} side="right">
                {link}
              </Tooltip>
            ) : (
              link
            )}
          </span>
        );
      })}
    </nav>
  );
}

function VersionCard({ version }: { version: string | null }) {
  const { t } = useAdminI18n();
  if (version === null) return null;
  return (
    <div className="bg-surface-3 mx-1 mb-3 flex flex-col gap-1.5 rounded-lg p-3">
      <span className="type-caption text-fg-3">{t.admin.shell.simulator}</span>
      <span className="type-sm font-semibold tabular-nums">{version}</span>
    </div>
  );
}

export function Sidebar({
  active,
  collapsed,
  version,
  onToggle,
  className,
}: {
  active: NavKey;
  collapsed: boolean;
  version: string | null;
  onToggle: () => void;
  className?: string;
}) {
  const { t } = useAdminI18n();
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
        className,
      )}
    >
      <Brand showName={!collapsed} />
      <NavLinks active={active} collapsed={collapsed} />
      <div className="flex-1" />
      {collapsed ? null : <VersionCard version={version} />}
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

// Below lg the sidebar opens from the start edge as a modal: focus is trapped and Esc closes it.
export function NavDrawer({
  open,
  active,
  version,
  onClose,
}: {
  open: boolean;
  active: NavKey;
  version: string | null;
  onClose: () => void;
}) {
  const { t } = useAdminI18n();
  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={t.admin.shell.navLabel}
      hideTitle
      header={<Brand showName />}
      closeLabel={t.common.close}
      size="sm"
      className="bg-surface start-0 end-auto max-w-72 gap-2 border-s-0 border-e px-3 py-4"
    >
      <NavLinks active={active} onNavigate={onClose} />
      <div className="flex-1" />
      <VersionCard version={version} />
    </Drawer>
  );
}
