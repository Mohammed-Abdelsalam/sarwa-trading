// Server-side Next.js settings shared by the web and admin apps. Plain CommonJS because next.config
// loads it before any TypeScript is compiled.
const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Only features every target browser recognises, so consoles stay free of policy warnings.
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
];

// The socket shares the API origin, so the same host is allowed over ws(s) too.
function apiOrigins(apiUrl) {
  const http = new URL(apiUrl);
  const ws = new URL(apiUrl);
  ws.protocol = http.protocol === 'https:' ? 'wss:' : 'ws:';
  return [http.origin, ws.origin];
}

// Built per request in proxy.ts. An app that reaches the API only through its rewrite passes no apiUrl.
function contentSecurityPolicy({ nonce, dev = false, https = false, apiUrl }) {
  return [
    "default-src 'self'",
    // React needs eval in development only, to rebuild server error stacks.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}`,
    // Inline style attributes (chart geometry, Radix positioning) can't carry a nonce.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    ["connect-src 'self'", ...(apiUrl ? apiOrigins(apiUrl) : [])].join(' '),
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(https ? ['upgrade-insecure-requests'] : []),
  ].join('; ');
}

let forwarding = false;

// Next fills X-Forwarded-For only when it is missing, so its /api rewrite passed a client's made-up
// address to the API as trusted. Appending the socket address, as any proxy should, makes the last
// hop real; the API (trust proxy) reads the chain from the right.
function forwardClientAddress() {
  if (forwarding) return;
  forwarding = true;
  process
    .getBuiltinModule('node:diagnostics_channel')
    .subscribe('http.server.request.start', ({ request, socket }) => {
      const address = socket.remoteAddress;
      if (!address) return;
      const chain = request.headers['x-forwarded-for'];
      request.headers['x-forwarded-for'] = chain ? `${chain}, ${address}` : address;
    });
}

module.exports = { securityHeaders, contentSecurityPolicy, forwardClientAddress };
