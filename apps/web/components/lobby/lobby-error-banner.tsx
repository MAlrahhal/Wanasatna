type LobbyErrorBannerProps = {
  message: string;
};

export function LobbyErrorBanner({ message }: LobbyErrorBannerProps) {
  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      {message}
    </div>
  );
}
