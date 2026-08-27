'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { UiDialog } from '@/components/ui/dialog';
import { GameAudioControl } from '@/components/game/game-audio-control';
import { canViewRoomInvitationDetails } from '@/lib/room/navigation-guard';
import { buildRoomInviteUrl } from '@/lib/room/session';
import { SYSTEM_COPY, copyLinkFailedMessage } from '@/lib/ui/system-copy';
import { cn } from '@/lib/utils';

type LobbyHeaderProps = {
  roomCode: string;
  isLocked: boolean;
  isHost: boolean;
  canChangeAvatar: boolean;
  onLockRoom?: () => void;
  onUnlockRoom?: () => void;
  onLeaveRoom?: () => void;
  onEndRoom?: () => Promise<boolean>;
  onChangeAvatar?: () => void;
};

function HeaderIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

const CopyIcon = () => (
  <HeaderIcon>
    <rect x="8" y="8" width="11" height="11" rx="2" />
    <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
  </HeaderIcon>
);
const ShareIcon = () => (
  <HeaderIcon>
    <circle cx="18" cy="5" r="2.5" />
    <circle cx="6" cy="12" r="2.5" />
    <circle cx="18" cy="19" r="2.5" />
    <path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4" />
  </HeaderIcon>
);
const LockIcon = ({ locked }: { locked: boolean }) => (
  <HeaderIcon>
    <rect x="5" y="10" width="14" height="10" rx="2" />
    <path d={locked ? 'M8 10V7a4 4 0 0 1 8 0v3' : 'M16 10V7a4 4 0 0 0-7.7-1.5'} />
  </HeaderIcon>
);
const AvatarIcon = () => (
  <HeaderIcon>
    <circle cx="12" cy="8" r="3.5" />
    <path d="M5 20c.7-4 3-6 7-6s6.3 2 7 6" />
    <path d="m18 4 2 2-3 3" />
  </HeaderIcon>
);
const LeaveIcon = () => (
  <HeaderIcon>
    <path d="M10 5H5v14h5M14 8l4 4-4 4M8 12h10" />
  </HeaderIcon>
);
const EndRoomIcon = () => (
  <HeaderIcon>
    <path d="M12 3v9" />
    <path d="M7.2 5.8a8 8 0 1 0 9.6 0" />
  </HeaderIcon>
);

export function LobbyHeader({
  roomCode,
  isLocked,
  isHost,
  canChangeAvatar,
  onLockRoom,
  onUnlockRoom,
  onLeaveRoom,
  onEndRoom,
  onChangeAvatar,
}: LobbyHeaderProps) {
  const [copied, setCopied] = useState(false);
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [endRoomOpen, setEndRoomOpen] = useState(false);
  const leavingRef = useRef(false);
  const endingRef = useRef(false);
  const showInvitationDetails = canViewRoomInvitationDetails(isHost);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  useEffect(() => {
    if (!shareMessage) return;
    const timer = window.setTimeout(() => setShareMessage(null), 2500);
    return () => window.clearTimeout(timer);
  }, [shareMessage]);

  async function handleCopyCode() {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  async function handleCopyRoomLink() {
    const inviteUrl = buildRoomInviteUrl(roomCode);
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setShareMessage(SYSTEM_COPY.copiedLink);
    } catch {
      setShareMessage(copyLinkFailedMessage(inviteUrl));
    }
  }

  function handleConfirmLeave() {
    if (leavingRef.current) return;
    leavingRef.current = true;
    void Promise.resolve(onLeaveRoom?.()).finally(() => {
      leavingRef.current = false;
      setLeaveOpen(false);
    });
  }

  function handleConfirmEndRoom() {
    if (endingRef.current) return;
    endingRef.current = true;
    void Promise.resolve(onEndRoom?.()).finally(() => {
      endingRef.current = false;
      setEndRoomOpen(false);
    });
  }

  const actionClass =
    'h-11 min-h-11 w-full justify-start border-white/15 bg-white/[0.06] text-white shadow-none hover:border-white/30 hover:bg-white/10 focus-visible:ring-white/30 lg:h-9 lg:min-h-9 lg:w-auto lg:justify-center';

  return (
    <header className="from-wanas-brand-navy to-wanas-primary-dark relative rounded-2xl border border-white/10 bg-gradient-to-l text-white shadow-[0_12px_32px_rgba(27,46,94,0.22)]">
      <div className="flex min-h-20 items-center justify-between gap-3 px-3 py-3 sm:px-4 lg:min-h-0 lg:gap-5">
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
          {showInvitationDetails ? (
            <div className="min-w-0 rounded-xl border border-white/15 bg-black/10 px-3 py-2 shadow-inner">
              <p className="text-[10px] font-semibold tracking-wide text-white/60">رمز الغرفة</p>
              <p
                dir="ltr"
                className="mt-0.5 truncate font-mono text-xl font-black tracking-[0.2em] text-white sm:text-2xl"
              >
                {roomCode}
              </p>
            </div>
          ) : (
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/10">
              <AvatarIcon />
            </div>
          )}

          <div className="flex min-w-0 flex-col items-start gap-1.5 sm:flex-row sm:items-center">
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold',
                isLocked
                  ? 'border-red-300/30 bg-red-400/15 text-red-100'
                  : 'border-emerald-300/30 bg-emerald-400/15 text-emerald-100',
              )}
            >
              <span
                className={cn('size-1.5 rounded-full', isLocked ? 'bg-red-300' : 'bg-emerald-300')}
                aria-hidden
              />
              {isLocked ? 'الغرفة مقفلة' : 'الغرفة مفتوحة'}
            </span>
            {isHost ? (
              <span className="rounded-full border border-amber-200/25 bg-amber-300/15 px-2.5 py-1 text-[11px] font-bold text-amber-100">
                المضيف
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <GameAudioControl className="border-white/15 bg-white/[0.06] text-white hover:bg-white/10" />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="size-11 min-h-11 border-white/15 bg-white/[0.06] px-0 text-white shadow-none hover:border-white/30 hover:bg-white/10 lg:hidden"
            aria-expanded={menuOpen}
            aria-controls="lobby-header-menu"
            aria-label={menuOpen ? 'إغلاق قائمة الغرفة' : 'فتح قائمة الغرفة'}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? '✕' : '☰'}
          </Button>
        </div>

        <div
          id="lobby-header-menu"
          className={cn(
            'bg-wanas-brand-navy absolute inset-x-2 top-[calc(100%+0.5rem)] z-30 flex-col gap-2 rounded-2xl border border-white/10 p-3 shadow-xl lg:static lg:z-auto lg:flex lg:flex-row lg:flex-wrap lg:items-center lg:bg-transparent lg:p-0 lg:shadow-none',
            menuOpen ? 'flex' : 'hidden lg:flex',
          )}
        >
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={actionClass}
            disabled={!canChangeAvatar}
            title={canChangeAvatar ? undefined : 'يمكن تغيير الأيقونة بعد انتهاء اللعبة الحالية.'}
            onClick={onChangeAvatar}
          >
            <AvatarIcon />
            تغيير الأيقونة
          </Button>

          {showInvitationDetails ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={actionClass}
                onClick={() => void handleCopyCode()}
                aria-live="polite"
              >
                <CopyIcon />
                {copied ? 'تم النسخ' : 'نسخ الرمز'}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={actionClass}
                onClick={() => void handleCopyRoomLink()}
              >
                <ShareIcon />
                {shareMessage === SYSTEM_COPY.copiedLink ? 'تم نسخ الرابط' : 'مشاركة الغرفة'}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={actionClass}
                onClick={isLocked ? onUnlockRoom : onLockRoom}
              >
                <LockIcon locked={isLocked} />
                {isLocked ? 'فتح الغرفة' : 'قفل الغرفة'}
              </Button>
            </>
          ) : null}

          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(
              actionClass,
              'border-amber-300/25 bg-amber-300/10 text-amber-100 hover:border-amber-200/40 hover:bg-amber-300/15',
            )}
            onClick={() => setLeaveOpen(true)}
          >
            <LeaveIcon />
            مغادرة الغرفة
          </Button>

          {isHost ? (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="h-11 min-h-11 w-full justify-start border-red-300/30 bg-red-500/20 text-red-100 hover:bg-red-500/30 lg:h-9 lg:min-h-9 lg:w-auto lg:justify-center"
              onClick={() => setEndRoomOpen(true)}
            >
              <EndRoomIcon />
              إنهاء الغرفة
            </Button>
          ) : null}
        </div>
      </div>

      {shareMessage ? (
        <p
          className="bg-wanas-brand-navy absolute end-3 top-full z-40 mt-2 rounded-lg px-3 py-2 text-xs font-medium text-white shadow-lg"
          aria-live="polite"
        >
          {shareMessage}
        </p>
      ) : null}

      <UiDialog
        open={leaveOpen}
        title={SYSTEM_COPY.leaveConfirmTitle}
        description={SYSTEM_COPY.leaveConfirmBody}
        variant="warning"
        confirmLabel={SYSTEM_COPY.leave}
        cancelLabel={SYSTEM_COPY.cancel}
        onClose={() => {
          if (!leavingRef.current) setLeaveOpen(false);
        }}
        onConfirm={handleConfirmLeave}
      />

      <UiDialog
        open={endRoomOpen}
        title="إنهاء الغرفة؟"
        description="سيتم إنهاء الغرفة وإخراج جميع اللاعبين منها."
        variant="error"
        confirmLabel="إنهاء الغرفة"
        cancelLabel="إلغاء"
        onClose={() => {
          if (!endingRef.current) setEndRoomOpen(false);
        }}
        onConfirm={handleConfirmEndRoom}
      />
    </header>
  );
}
