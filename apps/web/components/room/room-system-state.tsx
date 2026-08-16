'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { SystemStatus, type SystemStatusTone } from '@/components/ui/system-status';
import { SYSTEM_COPY, presentRoomActionError } from '@/lib/ui/system-copy';

type RoomSystemStateProps = {
  kind: 'connecting' | 'reconnecting' | 'kicked' | 'error';
  message?: string | null;
  onRetry?: () => void;
};

export function GameSystemLoading() {
  return <SystemStatus tone="loading" title={SYSTEM_COPY.loading} className="mx-auto max-w-lg" />;
}

export function GameSystemError({
  message,
  onRetry,
}: {
  message?: string | null;
  onRetry?: () => void;
}) {
  const presented = presentRoomActionError(message);
  return (
    <SystemStatus
      tone="error"
      title={presented.title}
      description={presented.description}
      className="mx-auto max-w-lg"
      action={
        onRetry ? (
          <Button type="button" className="min-h-11" onClick={onRetry}>
            {SYSTEM_COPY.retry}
          </Button>
        ) : undefined
      }
    />
  );
}

export function SpectatorNotice() {
  return <SystemStatus tone="info" title={SYSTEM_COPY.spectator} />;
}

export function RoomSystemState({ kind, message, onRetry }: RoomSystemStateProps) {
  const router = useRouter();
  const presented = presentRoomActionError(message);
  const tone: SystemStatusTone =
    kind === 'connecting' ? 'connecting' : kind === 'reconnecting' ? 'reconnecting' : 'error';
  const title =
    kind === 'connecting'
      ? SYSTEM_COPY.connecting
      : kind === 'reconnecting'
        ? SYSTEM_COPY.reconnecting
        : kind === 'kicked'
          ? SYSTEM_COPY.kickedTitle
          : presented.title;
  const description =
    kind === 'kicked'
      ? SYSTEM_COPY.kickedHelper
      : kind === 'connecting' || kind === 'reconnecting'
        ? undefined
        : presented.description;
  const terminalNoRetry =
    kind === 'kicked' ||
    presented.title === SYSTEM_COPY.roomMissing ||
    presented.title === SYSTEM_COPY.roomClosed ||
    presented.title === SYSTEM_COPY.reconnectExpired;

  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col justify-center p-4 sm:p-6">
      <SystemStatus
        tone={tone}
        title={title}
        description={description}
        action={
          kind === 'connecting' || kind === 'reconnecting' ? undefined : (
            <div className="flex flex-col gap-2 sm:flex-row">
              {kind === 'error' && onRetry && !terminalNoRetry ? (
                <Button type="button" variant="secondary" className="min-h-11 flex-1" onClick={onRetry}>
                  {SYSTEM_COPY.retry}
                </Button>
              ) : null}
              <Button type="button" className="min-h-11 flex-1" onClick={() => router.replace('/')}>
                {SYSTEM_COPY.backHome}
              </Button>
            </div>
          )
        }
      />
    </div>
  );
}
