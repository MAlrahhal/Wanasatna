/**
 * Drops stale plugin SYNC acknowledgements so a slower older request cannot
 * overwrite a newer authoritative view after PHASE_CHANGED.
 */
export class AckGenerationGate {
  private seq = 0;

  next(): number {
    this.seq += 1;
    return this.seq;
  }

  invalidate(): void {
    this.seq += 1;
  }

  isCurrent(requestId: number): boolean {
    return requestId === this.seq;
  }
}

export async function runLatestAck<T>(
  gate: AckGenerationGate,
  work: () => Promise<T>,
): Promise<T | undefined> {
  const requestId = gate.next();
  const result = await work();

  if (!gate.isCurrent(requestId)) {
    return undefined;
  }

  return result;
}
