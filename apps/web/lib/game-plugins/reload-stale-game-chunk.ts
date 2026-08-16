/** Stale/missing GameScreen chunks need a full reload so Next picks up the new asset manifest. */
export function reloadStaleGameChunk(): void {
  globalThis.location.reload();
}
