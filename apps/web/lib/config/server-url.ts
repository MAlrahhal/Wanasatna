/**
 * Public Socket.IO / API base URL for the browser client.
 * NEXT_PUBLIC_* is inlined at build time — set it for Railway before `next build`.
 */
export function getServerUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SERVER_URL?.trim();

  if (configured) {
    return configured.replace(/\/$/, '');
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'NEXT_PUBLIC_SERVER_URL is required in production. Set it to the public Railway backend URL.',
    );
  }

  return 'http://localhost:4000';
}
