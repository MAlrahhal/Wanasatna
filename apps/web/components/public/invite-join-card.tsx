'use client';

import { UserIcon } from '@/components/public/public-field';
import { RoomResumePanel } from '@/components/public/active-room-banner';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { SystemStatus } from '@/components/ui/system-status';
import { HOME_ROOM_ACTIONS_ID } from '@/lib/public/routes';
import { presentRoomActionError } from '@/lib/ui/system-copy';
import type { ActiveRoomSession } from '@/lib/room-v2';

function LinkIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M10 14a5 5 0 0 0 7.07 0l1.41-1.41a5 5 0 0 0-7.07-7.07L10 6.93"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M14 10a5 5 0 0 0-7.07 0L5.52 11.41a5 5 0 0 0 7.07 7.07L14 17.07"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 11V8a4 4 0 1 1 8 0v3" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

type InviteJoinCardProps = {
  playerName: string;
  joinCode: string;
  onPlayerNameChange: (value: string) => void;
  onJoinRoom: () => void;
  isJoining: boolean;
  playerNameError?: string;
  actionError?: string;
  resumeClaims?: ActiveRoomSession[];
  onResumeClaim?: (claim: ActiveRoomSession) => void;
};

export function InviteJoinCard({
  playerName,
  joinCode,
  onPlayerNameChange,
  onJoinRoom,
  isJoining,
  playerNameError,
  actionError,
  resumeClaims = [],
  onResumeClaim,
}: InviteJoinCardProps) {
  return (
    <main className="flex items-start justify-center px-4 py-6 sm:min-h-[calc(100vh-5rem)] sm:items-center sm:py-10">
      <section id={HOME_ROOM_ACTIONS_ID} className="w-full max-w-md">
        {actionError && !isJoining ? (
          <div className="mb-4">
            <SystemStatus tone="error" {...presentRoomActionError(actionError)} />
          </div>
        ) : null}
        {resumeClaims.length > 0 && onResumeClaim ? (
          <div className="mb-4 flex flex-col gap-3">
            {resumeClaims.map((claim) => (
              <RoomResumePanel
                key={`${claim.roomId}:${claim.playerId}`}
                claim={claim}
                busy={isJoining}
                onResume={() => onResumeClaim(claim)}
              />
            ))}
          </div>
        ) : null}
        <article className="wanas-panel border border-wanas-accent p-4 shadow-[0_0_0_1px_rgba(0,210,255,0.25)] sm:p-8">
          <div className="mb-4 flex flex-col items-center text-center sm:mb-6">
            <span className="mb-2 flex size-12 items-center justify-center rounded-full bg-wanas-accent/15 text-wanas-accent sm:mb-3">
              <LinkIcon />
            </span>
            <h1 className="text-2xl font-extrabold text-wanas-text-primary">دخول الغرفة</h1>
            <p className="mt-2 max-w-sm text-sm leading-7 text-wanas-text-muted">
              لقد فتحت رابط دعوة للانضمام إلى غرفة. أدخل اسمك للمتابعة.
            </p>
          </div>
          <div className="space-y-4">
            <Field
              id="join-name"
              label="اسمك"
              value={playerName}
              onChange={onPlayerNameChange}
              placeholder="اكتب اسمك"
              icon={<UserIcon />}
              disabled={isJoining}
              error={playerNameError}
              autoComplete="nickname"
            />
            <Field
              id="join-code"
              label="رمز الغرفة"
              value={joinCode}
              onChange={() => undefined}
              readOnly
              icon={<LockIcon />}
              dir="ltr"
              helpText="تم تزويدك برمز الغرفة عبر رابط الدعوة."
              inputClassName="font-mono tracking-[0.35em]"
            />
            <Button
              type="button"
              size="lg"
              className="w-full"
              onClick={onJoinRoom}
              disabled={isJoining}
              loading={isJoining}
            >
              {isJoining ? 'جاري الدخول…' : 'دخول الغرفة'}
            </Button>
          </div>
        </article>
      </section>
    </main>
  );
}
