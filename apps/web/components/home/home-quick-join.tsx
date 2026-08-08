import { HomeField, KeyIcon, UserIcon } from '@/components/home/home-field';
import { cn } from '@/lib/utils';

type HomeQuickJoinProps = {
  joinName: string;
  joinCode: string;
  onJoinNameChange: (value: string) => void;
  onJoinCodeChange: (value: string) => void;
  onJoinRoom: () => void;
  isJoining: boolean;
  isSubmitting: boolean;
  joinNameError?: boolean;
  joinCodeError?: boolean;
};

export function HomeQuickJoin({
  joinName,
  joinCode,
  onJoinNameChange,
  onJoinCodeChange,
  onJoinRoom,
  isJoining,
  isSubmitting,
  joinNameError = false,
  joinCodeError = false,
}: HomeQuickJoinProps) {
  return (
    <section
      id="quick-join"
      className="mx-auto w-full max-w-xl rounded-[1.75rem] border border-[#E2E8F0] bg-white p-6 shadow-sm transition-shadow hover:shadow-md sm:p-8"
    >
      <div className="mb-6 flex items-center justify-center gap-2">
        <span className="flex size-10 items-center justify-center rounded-full bg-[#EFF6FF] text-[#2563EB]">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M12 3 4 7v6c0 4.4 3.4 8.5 8 9 4.6-.5 8-4.6 8-9V7l-8-4Z"
              stroke="currentColor"
              strokeWidth="1.5"
            />
          </svg>
        </span>
        <h2 className="text-xl font-bold text-[#0F172A]">انضمام سريع</h2>
      </div>

      <div className="space-y-4">
        <HomeField
          id="join-name"
          label="اسمك"
          value={joinName}
          onChange={onJoinNameChange}
          placeholder="أدخل اسمك"
          icon={<UserIcon />}
          disabled={isSubmitting}
          hasError={joinNameError}
        />

        <HomeField
          id="join-code"
          label="رمز الغرفة"
          value={joinCode}
          onChange={(value) => onJoinCodeChange(value.replace(/\D/g, '').slice(0, 6))}
          placeholder="أدخل رمز الغرفة"
          icon={<KeyIcon />}
          disabled={isSubmitting}
          hasError={joinCodeError}
          inputMode="numeric"
          inputClassName="font-mono tracking-[0.3em] placeholder:tracking-normal"
        />

        <button
          type="button"
          onClick={onJoinRoom}
          disabled={isSubmitting}
          aria-busy={isJoining}
          className={cn(
            'inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#3B82F6] px-5 text-sm font-semibold text-white transition-all duration-200',
            'hover:bg-[#2563EB] hover:shadow-md hover:shadow-[#3B82F6]/20',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]/40 focus-visible:ring-offset-2',
            'active:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:shadow-none',
          )}
        >
          {isJoining ? (
            <>
              <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              جاري الانضمام...
            </>
          ) : (
            <>
              انضم الآن
              <span aria-hidden>←</span>
            </>
          )}
        </button>
      </div>
    </section>
  );
}
