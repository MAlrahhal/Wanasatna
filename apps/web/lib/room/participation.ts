/**
 * Tab-scoped Room participation validity.
 * Explicit Leave bumps the epoch so late ACKs / resume cannot re-apply Room A.
 */

let participationEpoch = 0;
let resumeSuspended = false;

/** Invalidate active participation for resume/apply guards (does not touch storage). */
export function bumpRoomParticipationEpoch(): number {
  participationEpoch += 1;
  return participationEpoch;
}

export function readRoomParticipationEpoch(): number {
  return participationEpoch;
}

/** Block socket manager resume / rebind until a fresh Room entry succeeds. */
export function suspendRoomResume(): void {
  resumeSuspended = true;
  bumpRoomParticipationEpoch();
}

export function allowRoomResume(): void {
  resumeSuspended = false;
}

export function isRoomResumeSuspended(): boolean {
  return resumeSuspended;
}

export function isParticipationEpochCurrent(epoch: number): boolean {
  return epoch === participationEpoch;
}
