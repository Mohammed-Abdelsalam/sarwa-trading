import { API_URL } from './api-url';

// The socket shares the API origin, so the same host is allowed over ws(s) too.
function apiOrigins(apiUrl: string): string[] {
  const http = new URL(apiUrl);
  const ws = new URL(apiUrl);
  ws.protocol = http.protocol === 'https:' ? 'wss:' : 'ws:';
  return [http.origin, ws.origin];
}

export function contentSecurityPolicy({
  nonce,
  dev = false,
  https = false,
  apiUrl = API_URL,
}: {
  nonce: string;
  dev?: boolean;
  https?: boolean;
  apiUrl?: string;
}): string {
  return [
    "default-src 'self'",
    // React needs eval in development only, to rebuild server error stacks.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}`,
    // Inline style attributes (chart geometry, Radix positioning) can't carry a nonce.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    `connect-src 'self' ${apiOrigins(apiUrl).join(' ')}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(https ? ['upgrade-insecure-requests'] : []),
  ].join('; ');
}
