/**
 * Force Home to exactly `/` — App Router soft-nav from `/lobby?code=` can otherwise
 * leave `?code=` on `/` (invite prefill after explicit Leave).
 */
export function replaceHomeClean(
  router: { replace: (href: string, options?: { scroll?: boolean }) => void },
): void {
  if (typeof window !== 'undefined') {
    const path = `${window.location.pathname}${window.location.search}`;
    if (path !== '/' && path !== '') {
      window.history.replaceState(window.history.state, '', '/');
    } else if (window.location.search) {
      window.history.replaceState(window.history.state, '', '/');
    }
  }
  router.replace('/');
}
