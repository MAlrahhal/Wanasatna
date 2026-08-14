import { HomeField, KeyIcon, UserIcon } from '@/components/home/home-field';
import { Button } from '@/components/ui/button';

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
    <section id="quick-join" className="wanas-panel mx-auto w-full max-w-xl p-6 sm:p-8">
      <h2 className="mb-6 text-center text-xl font-bold text-wanas-text-primary">دخول الغرفة</h2>
      <div className="space-y-4">
        <HomeField
          id="join-name"
          label="اسمك"
          value={joinName}
          onChange={onJoinNameChange}
          placeholder="اكتب اسمك"
          icon={<UserIcon />}
          disabled={isSubmitting}
          hasError={joinNameError}
        />
        <HomeField
          id="join-code"
          label="رمز الغرفة"
          value={joinCode}
          onChange={(value) => onJoinCodeChange(value.replace(/\D/g, '').slice(0, 6))}
          placeholder="000000"
          icon={<KeyIcon />}
          disabled={isSubmitting}
          hasError={joinCodeError}
          inputMode="numeric"
          inputClassName="font-mono tracking-[0.3em] placeholder:tracking-normal"
        />
        <Button type="button" size="lg" className="w-full" onClick={onJoinRoom} disabled={isSubmitting} loading={isJoining}>
          {isJoining ? 'جاري الدخول…' : 'دخول الغرفة'}
        </Button>
      </div>
    </section>
  );
}
