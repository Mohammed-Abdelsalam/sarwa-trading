import { useState } from 'react';

import { type AuditAction } from '@sarwa/contracts';
import {
  AUDIT_PAGE_SIZE,
  auditChanges,
  auditPreview,
  useAuditLog,
  useDebouncedValue,
} from '@sarwa/core/admin';

export type ActionFilter = AuditAction | 'all';

export function useAuditPage() {
  const [action, setAction] = useState<ActionFilter>('all');
  const [actor, setActor] = useState('');
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);
  const actorQuery = useDebouncedValue(actor.trim());
  const audit = useAuditLog({
    page,
    action: action === 'all' ? undefined : action,
    actor: actorQuery || undefined,
  });
  const data = audit.data;

  return {
    action,
    actor,
    page,
    pageSize: data?.pageSize ?? AUDIT_PAGE_SIZE,
    total: data?.total ?? 0,
    filtered: action !== 'all' || actor.trim() !== '',
    expanded,
    rows: (data?.items ?? []).map((entry) => ({
      ...entry,
      at: Date.parse(entry.createdAt),
      changes: auditChanges(entry.payload),
      preview: auditPreview(entry.payload),
      json: JSON.stringify(entry.payload, null, 2),
    })),
    isLoading: audit.isPending,
    isError: audit.isError && !data,
    actions: {
      retry: () => void audit.refetch(),
      setAction: (next: ActionFilter) => {
        setAction(next);
        setPage(1);
      },
      setActor: (next: string) => {
        setActor(next);
        setPage(1);
      },
      clear: () => {
        setAction('all');
        setActor('');
        setPage(1);
      },
      setPage,
      toggle: (id: string) => {
        setExpanded((current) => (current === id ? null : id));
      },
      copy: (json: string) => {
        void navigator.clipboard.writeText(json).catch(() => undefined);
      },
    },
  };
}

export type AuditPageModel = ReturnType<typeof useAuditPage>;
