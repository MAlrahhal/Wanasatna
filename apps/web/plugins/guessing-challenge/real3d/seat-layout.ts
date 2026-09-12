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
export const SPECTATOR_CAMERA_POSITION: [number, number, number] = [4.3, 1.58, -0.335];
export const SPECTATOR_CAMERA_FOV = 52;
/** Faces inward from the side aisle, centered on the midpoint between both teams. */
export const SPECTATOR_CAMERA_YAW = Math.PI / 2;

export type SpectatorTeamId = 'blue' | 'red';

export const SPECTATOR_CARD_WIDTH = 0.66;
export const SPECTATOR_CARD_HEIGHT = 0.44;
const SPECTATOR_CARD_Y = 1.3;
const SPECTATOR_CARD_SINGLE_X = 0.62;
const SPECTATOR_CARD_DUO_X = 1.03;
const SPECTATOR_CARD_PITCH = -0.12;
const SPECTATOR_CARD_YAW_TILT = 0.055;
const SPECTATOR_CARD_ROLL = 0.035;

const SPECTATOR_TEAM_Z: Record<SpectatorTeamId, number> = {
  blue: 1.48,
  red: -2.15,
};

const SPECTATOR_CARD_Z: Record<SpectatorTeamId, number> = {
  blue: 0.7,
  red: -1.37,
};

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

export function spectatorTeamZ(teamId: SpectatorTeamId): number {
  return SPECTATOR_TEAM_Z[teamId];
}

export function spectatorCardPosition(
  teamId: SpectatorTeamId,
  playerCount: number,
): [number, number, number] {
  return [
    playerCount > 1 ? SPECTATOR_CARD_DUO_X : SPECTATOR_CARD_SINGLE_X,
    SPECTATOR_CARD_Y,
    SPECTATOR_CARD_Z[teamId],
  ];
}

/** Mirrored, hand-held tilt: readable from the aisle without looking camera-rigid. */
export function spectatorCardRotation(
  teamId: SpectatorTeamId,
  position: [number, number, number],
): [number, number, number] {
  const direction = teamId === 'blue' ? 1 : -1;
  return [
    SPECTATOR_CARD_PITCH,
    spectatorCardYaw(position) + direction * SPECTATOR_CARD_YAW_TILT,
    direction * SPECTATOR_CARD_ROLL,
  ];
}

export function spectatorPlayerPositions(
  teamId: SpectatorTeamId,
  playerCount: number,
): [number, number, number][] {
  if (playerCount <= 1) {
    return [[0, 0, SPECTATOR_TEAM_Z[teamId]]];
  }
  return teamId === 'blue'
    ? [
        [-0.62, 0, 1.7],
        [0.62, 0, 1.25],
      ]
    : [
        [-0.62, 0, -2.35],
        [0.62, 0, -1.9],
      ];
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
