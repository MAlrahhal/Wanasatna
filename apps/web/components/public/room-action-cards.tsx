'use client';

import { KeyIcon, UserIcon } from '@/components/public/public-field';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { HOME_ROOM_ACTIONS_ID } from '@/lib/public/routes';

type RoomActionCardsProps = {
  createPlayerName: string;
  joinPlayerName: string;
  joinCode: string;
  onCreatePlayerNameChange: (value: string) => void;
  onJoinPlayerNameChange: (value: string) => void;
  onJoinCodeChange: (value: string) => void;
  onCreateRoom: () => void;
  onJoinRoom: () => void;
  isCreating: boolean;
  isJoining: boolean;
  createPlayerNameError?: string;
  joinPlayerNameError?: string;
  joinCodeError?: string;
};

export function RoomActionCards({
  createPlayerName,
  joinPlayerName,
  joinCode,
  onCreatePlayerNameChange,
  onJoinPlayerNameChange,
  onJoinCodeChange,
  onCreateRoom,
  onJoinRoom,
  isCreating,
  isJoining,
  createPlayerNameError,
  joinPlayerNameError,
  joinCodeError,
}: RoomActionCardsProps) {
  const busy = isCreating || isJoining;

  return (
    <section id={HOME_ROOM_ACTIONS_ID} className="scroll-mt-20 lg:scroll-mt-24">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <article className="wanas-panel flex flex-col border-t-2 border-t-wanas-accent p-5 sm:p-6">
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
          <div className="flex flex-1 flex-col space-y-4">
            <Field
              id="create-name"
              label="اسمك"
              value={createPlayerName}
              onChange={onCreatePlayerNameChange}
              placeholder="اكتب اسمك"
              icon={<UserIcon />}
              disabled={busy}
              error={createPlayerNameError}
              autoComplete="nickname"
            />
            <div className="mt-auto">
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
          </div>
        </article>

        <article className="wanas-panel flex flex-col border-t-2 border-t-wanas-border p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-3">
            <span
              className="flex size-10 items-center justify-center rounded-[var(--wanas-radius-control)] bg-wanas-accent font-bold text-white shadow-[0_3px_0_var(--wanas-brand-navy)]"
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
              value={joinPlayerName}
              onChange={onJoinPlayerNameChange}
              placeholder="اكتب اسمك"
              icon={<UserIcon />}
              disabled={busy}
              error={joinPlayerNameError}
              autoComplete="nickname"
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
              autoComplete="one-time-code"
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
