// What a role may see of other people's contact details. The server masks before responding, so a
// VIEWER's browser never receives the raw values.
export type PiiView = 'full' | 'masked';

export const piiViewOf = (role: string): PiiView => (role === 'ADMIN' ? 'full' : 'masked');

const EMAILS = /[^\s@]+@[^\s@]+/g;

export function maskEmail(email: string): string {
  const at = email.indexOf('@');
  return at < 1 ? '•••' : `${email.charAt(0)}•••${email.slice(at)}`;
}

export function maskIp(ip: string): string {
  const v4 = ip.replace(/^::ffff:/, '').split('.');
  if (v4.length === 4) return `${v4[0] ?? ''}.${v4[1] ?? ''}.•.•`;
  // Only groups written before a "::" are real leading groups; "::1" has none to show.
  const [head = '', tail] = ip.split('::');
  const groups = head.split(':').filter(Boolean).slice(0, 2);
  return tail !== undefined && groups.length < 2
    ? `${groups.join(':')}::•`
    : `${groups.join(':')}:•:•`;
}

// Audit payloads hold before/after snapshots, so emails and ips can sit at any depth.
export function maskDeep(value: unknown): unknown {
  if (typeof value === 'string') return value.replace(EMAILS, maskEmail);
  if (Array.isArray(value)) return value.map(maskDeep);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, inner]) => [
        key,
        key === 'ip' && typeof inner === 'string' ? maskIp(inner) : maskDeep(inner),
      ]),
    );
  }
  return value;
}
