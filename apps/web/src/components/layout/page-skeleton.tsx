import { Skeleton } from '@sarwa/ui';

import { serverCopy } from '../../lib/seo';

// The instant placeholder a route shows while its server render streams in.
export async function PageSkeleton() {
  const { m } = await serverCopy();
  return (
    <div
      role="status"
      aria-label={m.loading}
      className="mx-auto flex w-full max-w-330 flex-col gap-4.5 px-4 py-6 md:px-8"
    >
      <Skeleton className="h-9 w-48" />
      <Skeleton className="h-5 w-72 max-w-full" />
      <Skeleton className="h-80 w-full rounded-lg" />
    </div>
  );
}
