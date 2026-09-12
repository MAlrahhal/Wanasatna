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
export const SPECTATOR_CAMERA_POSITION: [number, number, number] = [2.2, CAMERA_Y, -0.3];
export const SPECTATOR_CAMERA_FOV = 65;
/** Faces inward from the side aisle; teams sit roughly 45 degrees left and right. */
export const SPECTATOR_CAMERA_YAW = Math.PI / 2;

/** 2v2: sit slightly off center so the outer wall has space and seats mirror. */
const SEAT_CAMERA_X = 0.26;
/**
 * Other-seat X (seat 0 teammate on +X / right).
 */
const TEAMMATE_X = 1.22;
/**
 * Same depth as the local camera (z=1.65) so looking sideways is eye-to-eye.
 * Bean head is ~0.08 behind the seat origin after Y=π.
 */
const TEAMMATE_Z = 1.53;

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

export function cameraPositionForView(
  viewMode: 'player' | 'spectator' | undefined,
  matchMode: '1v1' | '2v2' | undefined,
  selfSeat: 0 | 1 | undefined,
): [number, number, number] {
  return viewMode === 'spectator'
    ? [...SPECTATOR_CAMERA_POSITION]
    : cameraPositionForSeat(matchMode, selfSeat);
}

export function cameraYawForView(viewMode: 'player' | 'spectator' | undefined): number {
  return viewMode === 'spectator' ? SPECTATOR_CAMERA_YAW : 0;
}

export function cameraFovForView(viewMode: 'player' | 'spectator' | undefined): number {
  return viewMode === 'spectator' ? SPECTATOR_CAMERA_FOV : CAMERA_FOV;
}

/** Rotate a card's +Z face toward the neutral spectator camera. */
export function spectatorCardYaw(position: [number, number, number]): number {
  return Math.atan2(
    SPECTATOR_CAMERA_POSITION[0] - position[0],
    SPECTATOR_CAMERA_POSITION[2] - position[2],
  );
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
