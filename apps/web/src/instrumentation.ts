// The Node server only: it puts the real client address at the end of X-Forwarded-For.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { forwardClientAddress } = await import('@sarwa/ui/next-config');
  forwardClientAddress();
}
