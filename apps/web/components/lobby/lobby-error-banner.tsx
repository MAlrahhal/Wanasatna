import { SystemStatus } from '@/components/ui/system-status';
import { Button } from '@/components/ui/button';
import { SYSTEM_COPY, presentRoomActionError } from '@/lib/ui/system-copy';

type LobbyErrorBannerProps = {
  message: string;
  showHomeAction?: boolean;
  onHome?: () => void;
};

export function LobbyErrorBanner({ message, showHomeAction = false, onHome }: LobbyErrorBannerProps) {
  const presented = presentRoomActionError(message);
  const isGameEndedNotice = message === SYSTEM_COPY.gameEndedReturnLobby;

  return (
    <SystemStatus
      tone={isGameEndedNotice ? 'info' : 'error'}
      title={presented.title}
      description={presented.description}
      action={
        showHomeAction ? (
          <Button type="button" variant="secondary" size="sm" onClick={onHome}>
            {SYSTEM_COPY.backHome}
          </Button>
        ) : undefined
      }
    />
  );
}
