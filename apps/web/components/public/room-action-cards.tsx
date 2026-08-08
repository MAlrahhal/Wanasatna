'use client';

import { KeyIcon, PublicField, UserIcon } from '@/components/public/public-field';
import { HOME_ROOM_ACTIONS_ID } from '@/lib/public/routes';
import { cn } from '@/lib/utils';

type RoomActionCardsProps = {
  playerName: string;
  joinCode: string;
  onPlayerNameChange: (value: string) => void;
  onJoinCodeChange: (value: string) => void;
  onCreateRoom: () => void;
  onJoinRoom: () => void;
  isCreating: boolean;
  isJoining: boolean;
  playerNameError?: boolean;
  joinCodeError?: boolean;
};

export function RoomActionCards({
  playerName,
  joinCode,
  onPlayerNameChange,
  onJoinCodeChange,
  onCreateRoom,
  onJoinRoom,
  isCreating,
  isJoining,
  playerNameError,
  joinCodeError,
}: RoomActionCardsProps) {
  return (
    <section id={HOME_ROOM_ACTIONS_ID} className="scroll-mt-24">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <article className="wanas-panel border-t-2 border-t-wanas-accent p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-[var(--wanas-radius-control)] bg-wanas-accent font-bold text-[color:var(--wanas-background)] shadow-[0_3px_0_var(--wanas-brand-navy)]">
              +
            </span>
            <div>
              <h2 className="text-lg font-bold text-wanas-text-primary">إنشاء غرفة</h2>
              <p className="text-sm text-wanas-text-muted">ابدأ غرفة جديدة وشارك الرمز</p>
            </div>
          </div>
          <div className="space-y-4">
            <PublicField
              id="create-name"
              label="اسمك"
              value={playerName}
              onChange={onPlayerNameChange}
              placeholder="أدخل اسمك"
              icon={<UserIcon />}
              disabled={isCreating}
              hasError={playerNameError}
            />
            <button
              type="button"
              onClick={onCreateRoom}
              disabled={isCreating || isJoining}
              aria-busy={isCreating}
              className={cn(
                'inline-flex h-12 w-full items-center justify-center gap-2 rounded-[var(--wanas-radius-control)] border border-wanas-accent bg-wanas-accent text-sm font-bold text-[color:var(--wanas-background)] shadow-[0_4px_0_var(--wanas-brand-navy)]',
                'hover:-translate-y-0.5 hover:border-wanas-accent-hover hover:bg-wanas-accent-hover active:translate-y-1 active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wanas-accent/40 focus-visible:ring-offset-2',
                'disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-60 disabled:shadow-none',
              )}
            >
              {isCreating ? (
                <>
                  <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  جاري الإنشاء...
                </>
              ) : (
                'إنشاء غرفة'
              )}
            </button>
          </div>
        </article>

        <article className="wanas-panel border-t-2 border-t-wanas-brand-navy p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-[var(--wanas-radius-control)] bg-wanas-brand-navy font-bold text-wanas-text-on-brand shadow-[0_3px_0_var(--wanas-brand-navy-hover)]">
              ↪
            </span>
            <div>
              <h2 className="text-lg font-bold text-wanas-text-primary">الانضمام إلى غرفة</h2>
              <p className="text-sm text-wanas-text-muted">أدخل الرمز الذي شاركه معك صاحب الغرفة</p>
            </div>
          </div>
          <div className="space-y-4">
            <PublicField
              id="join-name"
              label="اسمك"
              value={playerName}
              onChange={onPlayerNameChange}
              placeholder="أدخل اسمك"
              icon={<UserIcon />}
              disabled={isJoining}
              hasError={playerNameError}
            />
            <PublicField
              id="join-code"
              label="رمز الغرفة"
              value={joinCode}
              onChange={onJoinCodeChange}
              placeholder="٠٠٠٠٠٠"
              icon={<KeyIcon />}
              disabled={isJoining}
              hasError={joinCodeError}
              inputMode="numeric"
              inputClassName="font-mono tracking-[0.35em] placeholder:tracking-normal"
            />
            <button
              type="button"
              onClick={onJoinRoom}
              disabled={isJoining || isCreating}
              aria-busy={isJoining}
              className={cn(
                'inline-flex h-12 w-full items-center justify-center gap-2 rounded-[var(--wanas-radius-control)] border border-wanas-accent bg-wanas-accent text-sm font-bold text-[color:var(--wanas-background)] shadow-[0_4px_0_var(--wanas-brand-navy)]',
                'hover:-translate-y-0.5 hover:border-wanas-accent-hover hover:bg-wanas-accent-hover active:translate-y-1 active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wanas-accent/40 focus-visible:ring-offset-2',
                'disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-60 disabled:shadow-none',
              )}
            >
              {isJoining ? (
                <>
                  <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  جاري الانضمام...
                </>
              ) : (
                'انضم الآن'
              )}
            </button>
          </div>
        </article>
      </div>
    </section>
  );
}
