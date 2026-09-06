import type { Socket } from 'socket.io-client';
import { GAME_SHELL_STATE_EVENT } from '@wanasatna/shared';

export type PluginResyncSocket = Pick<Socket, 'on' | 'off'>;

/**
 * Plugin views recover from PHASE_CHANGED (empty payload → re-SYNC) and from
 * GAME_SHELL_STATE (reconnect / bound ROOM_SYNC). Mount also SYNCs once.
 */
export function bindPluginViewResync(
  socket: PluginResyncSocket,
  phaseChangedEvent: string,
  syncView: () => void | Promise<void>,
  options?: {
    onPhaseChanged?: () => void;
    extraBind?: () => () => void;
  },
): () => void {
  const onPhaseChanged = () => {
    options?.onPhaseChanged?.();
    void syncView();
  };
  const onShellState = () => {
    void syncView();
  };

  socket.on(phaseChangedEvent, onPhaseChanged);
  socket.on(GAME_SHELL_STATE_EVENT, onShellState);
  const extraOff = options?.extraBind?.();
  void syncView();

  return () => {
    socket.off(phaseChangedEvent, onPhaseChanged);
    socket.off(GAME_SHELL_STATE_EVENT, onShellState);
    extraOff?.();
  };
}
