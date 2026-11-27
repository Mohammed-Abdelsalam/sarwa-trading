import { useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { AUDIT_ACTIONS, AUDIT_GROUPS, type AuditAction, type AuditGroup } from '@sarwa/contracts';
import { AUDIT_PAGE_SIZE, auditChanges, auditPreview, useAuditLog } from '@sarwa/core/admin';

import { oneOf, pageParam, setSearchParams, useSearchParamText } from '../../lib/search-params';

export type ActionFilter = AuditAction | 'all';
export type GroupFilter = AuditGroup | 'all';

export function useAuditPage() {
  const params = useSearchParams();
  const action = oneOf<ActionFilter>(params.get('action'), AUDIT_ACTIONS, 'all');
  const group = oneOf<GroupFilter>(params.get('group'), AUDIT_GROUPS, 'all');
  const actor = useSearchParamText(params, 'actor', { page: null });
  const page = pageParam(params.get('page'));
  const [expanded, setExpanded] = useState<string | null>(null);
  const audit = useAuditLog({
    page,
    action: action === 'all' ? undefined : action,
    group: group === 'all' ? undefined : group,
    actor: actor.value || undefined,
  });
  const data = audit.data;

  return {
    action,
    group,
    actor: actor.text,
    page,
    pageSize: data?.pageSize ?? AUDIT_PAGE_SIZE,
    total: data?.total ?? 0,
    filtered: action !== 'all' || group !== 'all' || actor.text.trim() !== '',
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
      // An action and its group would only narrow each other, so picking one drops the other.
      setAction: (next: ActionFilter) => {
        setSearchParams({ action: next === 'all' ? null : next, group: null, page: null });
      },
      setGroup: (next: GroupFilter) => {
        setSearchParams({ group: next === 'all' ? null : next, action: null, page: null });
      },
      setActor: actor.set,
      clear: () => {
        actor.clear({ action: null, group: null });
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
