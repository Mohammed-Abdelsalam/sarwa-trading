import { type CustomerDetail, type CustomerRow } from '@sarwa/contracts';
import { useAdminI18n } from '@sarwa/core/admin';
import { Badge } from '@sarwa/ui';

import { UserAvatar } from '../../components/common/identity';

export function CustomerStatusBadge({
  customer,
}: {
  customer: Pick<CustomerRow, 'status' | 'deletionRequestedAt'>;
}) {
  const { t } = useAdminI18n();
  const copy = t.admin.customers;
  if (customer.status === 'active' && customer.deletionRequestedAt !== null) {
    return <Badge tone="warn">{copy.deletionPending}</Badge>;
  }
  const tone =
    customer.status === 'active' ? 'pos' : customer.status === 'suspended' ? 'neg' : 'neutral';
  return <Badge tone={tone}>{copy.statuses[customer.status]}</Badge>;
}

export function VerifiedBadge({ verified }: { verified: boolean }) {
  const { t } = useAdminI18n();
  const copy = t.admin.customers;
  return verified ? (
    <Badge tone="outline">{copy.verifiedBadge}</Badge>
  ) : (
    <Badge tone="warn">{copy.unverifiedBadge}</Badge>
  );
}

export function CustomerHeader({
  detail,
  purgesAt,
  now,
}: {
  detail: CustomerDetail;
  purgesAt: number | null;
  now: number;
}) {
  const { t, f } = useAdminI18n();
  const copy = t.admin.customer;
  const { customer } = detail;
  const facts = [
    customer.email,
    customer.handle,
    copy.joined({ date: f.date(customer.createdAt) }),
    customer.lastActiveAt === null
      ? null
      : copy.lastActive({
          time: f.relative(customer.lastActiveAt, now),
          device: detail.lastActiveDevice ?? t.admin.customers.platforms[customer.signupPlatform],
        }),
  ].filter((fact): fact is string => fact !== null);

  return (
    <div className="flex items-start gap-4">
      <UserAvatar name={customer.name} className="type-h3 size-14" />
      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="type-h1 text-fg">{customer.name}</h1>
          <CustomerStatusBadge customer={customer} />
          <Badge tone={customer.emailVerified ? 'pos' : 'warn'}>
            {customer.emailVerified ? copy.emailVerified : copy.emailUnverified}
          </Badge>
        </div>
        <p className="type-sm text-fg-2 flex flex-wrap gap-x-3 gap-y-1 tabular-nums">
          {facts.map((fact, i) => (
            <span key={fact} className={i === 1 ? 'type-mono' : undefined}>
              {fact}
            </span>
          ))}
        </p>
        {purgesAt !== null ? (
          <p className="type-sm text-warn font-semibold">
            {copy.deletionPending({ date: f.date(purgesAt) })}
          </p>
        ) : null}
      </div>
    </div>
  );
}
