// Only same-site paths survive the login redirect. Parsed the way the browser navigates, so tricks
// like "/\t/evil.com" can't leave the site.
export function safeNext(next: string | null): string {
  const origin = 'http://admin.local';
  if (!next?.startsWith('/')) return '/overview';
  const url = new URL(next, origin);
  return url.origin === origin && !url.pathname.startsWith('/login')
    ? `${url.pathname}${url.search}`
    : '/overview';
}
