export interface AuditChange {
  key: string;
  before: string | null;
  after: string | null;
}

const show = (value: unknown): string | null =>
  value === undefined ? null : typeof value === 'string' ? value : JSON.stringify(value);

const record = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

// Audit payloads carry { before, after }; anything else is shown as plain "after" values.
export function auditChanges(payload: Record<string, unknown>): AuditChange[] {
  const hasDiff = 'before' in payload || 'after' in payload;
  const before = hasDiff ? record(payload.before) : {};
  const after = hasDiff ? record(payload.after) : payload;
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])];
  return keys.map((key) => ({ key, before: show(before[key]), after: show(after[key]) }));
}

export function auditPreview(payload: Record<string, unknown>): string {
  const text = JSON.stringify(payload);
  return text === '{}' ? '—' : text;
}
