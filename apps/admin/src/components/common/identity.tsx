import { type Role } from '@sarwa/contracts';
import { useAdminI18n } from '@sarwa/core/admin';
import { Badge, cn } from '@sarwa/ui';

export function UserAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'bg-sector-tech-subtle text-sector-tech type-avatar-sm grid size-8 shrink-0 place-items-center rounded-full',
        className,
      )}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

export function RoleBadge({ role, className }: { role: Role; className?: string }) {
  const { t } = useAdminI18n();
  return (
    <Badge
      tone={role === 'ADMIN' ? 'brand' : 'outline'}
      className={cn('h-4.5 text-[0.625rem] tracking-[0.04em]', className)}
    >
      {t.admin.roles[role]}
    </Badge>
  );
}
