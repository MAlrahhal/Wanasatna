/**
 * 2v2 first-person seat / camera placement and remote look mapping.
 *
 * Scene convention: local camera looks down world -Z. LookControls +yaw = look left
 * (world -X). Bean faces are authored on local +Z.
 *
 * Teammate groups are rotated Y=π so they face -Z with the local player.
 * Opponent groups face the camera (rotationY ≈ 0).
 */

export const CAMERA_Y = 1.35;
export const CAMERA_Z = 1.65;
export const CAMERA_FOV = 55;

/** 2v2: sit slightly off center so the outer wall has space and seats mirror. */
const SEAT_CAMERA_X = 0.26;
/** Other-seat X in viewer space (seat 0 teammate on +X / right). */
const TEAMMATE_X = 1.32;
/**
 * Teammate world Z. Must stay well in front of the camera (z=1.65) after the
 * Y=π chair-back flip — previously z=1.4 put the chair in the near frustum.
 */
const TEAMMATE_Z = 0.32;

export type RemoteAvatarFacing = 'toward-camera' | 'same-as-local';

export function cameraPositionForSeat(
  matchMode: '1v1' | '2v2' | undefined,
  selfSeat: 0 | 1 | undefined,
): [number, number, number] {
  if (matchMode !== '2v2') {
    return [0, CAMERA_Y, CAMERA_Z];
  }
  const x = selfSeat === 1 ? SEAT_CAMERA_X : -SEAT_CAMERA_X;
  return [x, CAMERA_Y, CAMERA_Z];
}

export function teammateSeatPosition(selfSeat: 0 | 1): [number, number, number] {
  const x = selfSeat === 0 ? TEAMMATE_X : -TEAMMATE_X;
  return [x, 0, TEAMMATE_Z];
}

/**
 * Convert a LookControls yaw (-1..1, + = look left) into bean head/body yaw.
 *
 * +head.rot.y on a +Z-facing bean turns the face toward world +X (right).
 * Parent Y=π (teammate) flips that to world -X, which already matches look-left.
 * Camera-facing opponents have no π, so their yaw must be negated.
 */
export function mapRemoteLookYaw(lookYaw: number, facing: RemoteAvatarFacing): number {
  return facing === 'toward-camera' ? -lookYaw : lookYaw;
}

/** Pitch is authored as + = look up; Y=π does not invert nod. */
export function mapRemoteLookPitch(lookPitch: number): number {
  return lookPitch;
}
