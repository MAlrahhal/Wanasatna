'use client';

import { KeyIcon, UserIcon } from '@/components/public/public-field';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { HOME_ROOM_ACTIONS_ID } from '@/lib/public/routes';

type RoomActionCardsProps = {
  playerName: string;
  joinCode: string;
  onPlayerNameChange: (value: string) => void;
  onJoinCodeChange: (value: string) => void;
  onCreateRoom: () => void;
  onJoinRoom: () => void;
  isCreating: boolean;
  isJoining: boolean;
  playerNameError?: string;
  joinCodeError?: string;
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
  const busy = isCreating || isJoining;

  return (
    <section id={HOME_ROOM_ACTIONS_ID} className="scroll-mt-24">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <article className="wanas-panel border-t-2 border-t-wanas-accent p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-3">
            <span
              className="flex size-10 items-center justify-center rounded-[var(--wanas-radius-control)] bg-wanas-accent font-bold text-white shadow-[0_3px_0_var(--wanas-brand-navy)]"
              aria-hidden
            >
              +
            </span>
            <div>
              <h2 className="text-lg font-bold text-wanas-text-primary">إنشاء غرفة</h2>
              <p className="text-sm text-wanas-text-muted">ابدأ غرفة جديدة وشارك الرمز</p>
            </div>
          </div>
          <div className="space-y-4">
            <Field
              id="create-name"
              label="اسمك"
              value={playerName}
              onChange={onPlayerNameChange}
              placeholder="اكتب اسمك"
              icon={<UserIcon />}
              disabled={busy}
              error={playerNameError}
            />
            <Button
              type="button"
              size="lg"
              className="w-full"
              onClick={onCreateRoom}
              disabled={busy}
              loading={isCreating}
            >
              {isCreating ? 'جاري الإنشاء…' : 'إنشاء غرفة'}
            </Button>
          </div>
        </article>

        <article className="wanas-panel border-t-2 border-t-wanas-border p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-3">
            <span
              className="flex size-10 items-center justify-center rounded-[var(--wanas-radius-control)] bg-wanas-surface-muted font-bold text-wanas-text-primary"
              aria-hidden
            >
              #
            </span>
            <div>
              <h2 className="text-lg font-bold text-wanas-text-primary">دخول الغرفة</h2>
              <p className="text-sm text-wanas-text-muted">أدخل الرمز الذي شاركه معك صاحب الغرفة</p>
            </div>
          </div>
          <div className="space-y-4">
            <Field
              id="join-name"
              label="اسمك"
              value={playerName}
              onChange={onPlayerNameChange}
              placeholder="اكتب اسمك"
              icon={<UserIcon />}
              disabled={busy}
              error={playerNameError}
            />
            <Field
              id="join-code"
              label="رمز الغرفة"
              value={joinCode}
              onChange={onJoinCodeChange}
              placeholder="000000"
              icon={<KeyIcon />}
              disabled={busy}
              error={joinCodeError}
              inputMode="numeric"
              dir="ltr"
              inputClassName="font-mono tracking-[0.35em] placeholder:tracking-normal"
            />
            <Button
              type="button"
              size="lg"
              className="w-full"
              onClick={onJoinRoom}
              disabled={busy}
              loading={isJoining}
            >
              {isJoining ? 'جاري الدخول…' : 'دخول الغرفة'}
            </Button>
          </div>
        </article>
      </div>
    </section>
  );
}
