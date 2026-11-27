import { useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { AUDIT_ACTIONS, type AuditAction } from '@sarwa/contracts';
import { AUDIT_PAGE_SIZE, auditChanges, auditPreview, useAuditLog } from '@sarwa/core/admin';

import { oneOf, pageParam, setSearchParams, useSearchParamText } from '../../lib/search-params';

export type ActionFilter = AuditAction | 'all';

export function useAuditPage() {
  const params = useSearchParams();
  const action = oneOf<ActionFilter>(params.get('action'), AUDIT_ACTIONS, 'all');
  const actor = useSearchParamText(params, 'actor', { page: null });
  const page = pageParam(params.get('page'));
  const [expanded, setExpanded] = useState<string | null>(null);
  const audit = useAuditLog({
    page,
    action: action === 'all' ? undefined : action,
    actor: actor.value || undefined,
  });
  const data = audit.data;

  return {
    action,
    actor: actor.text,
    page,
    pageSize: data?.pageSize ?? AUDIT_PAGE_SIZE,
    total: data?.total ?? 0,
    filtered: action !== 'all' || actor.text.trim() !== '',
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
        setSearchParams({ action: next === 'all' ? null : next, page: null });
      },
      setActor: actor.set,
      clear: () => {
        actor.clear({ action: null });
      },
      setPage: (next: number) => {
        setSearchParams({ page: next > 1 ? next : null });
      },
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
