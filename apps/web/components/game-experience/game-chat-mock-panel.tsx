'use client';

/**
 * Mock in-game chat panel — UI placeholder only.
 * @internal DEV_MOCK — no Socket.IO wiring; send is intentionally disabled.
 */
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const MOCK_MESSAGES = [
  { id: '1', author: 'سارة', text: 'يلا نبدأ!', time: '20:01' },
  { id: '2', author: 'أحمد', text: 'جاهزين 👍', time: '20:02' },
] as const;

type GameChatMockPanelProps = {
  className?: string;
};

export function GameChatMockPanel({ className }: GameChatMockPanelProps) {
  return (
    <aside
      aria-label="الدردشة"
      className={cn('wanas-game-panel flex min-h-0 flex-col p-3 sm:p-4', className)}
    >
      <div className="mb-2">
        <h2 className="text-xs font-semibold text-[color:var(--wanas-game-text-secondary)]">الدردشة</h2>
        <p className="mt-0.5 text-[10px] text-[color:var(--wanas-game-text-secondary)]">
          محادثة دائمة مستقلة عن اللعب.
        </p>
      </div>

      <ul className="mb-3 min-h-0 flex-1 space-y-2 overflow-y-auto">
        {MOCK_MESSAGES.map((message) => (
          <li key={message.id} className="px-0.5 py-1">
            <div className="mb-0.5 flex items-baseline justify-between gap-2">
              <span className="truncate text-xs font-bold text-[color:var(--wanas-game-text-primary)]">
                {message.author}
              </span>
              <time className="shrink-0 text-[10px] text-[color:var(--wanas-game-text-secondary)]">
                {message.time}
              </time>
            </div>
            <p className="text-xs leading-5 text-[color:var(--wanas-game-text-secondary)]">{message.text}</p>
          </li>
        ))}
      </ul>

      <form className="mt-auto flex gap-2" onSubmit={(event) => event.preventDefault()} aria-label="إرسال رسالة">
        <input
          type="text"
          disabled
          placeholder="اكتب رسالتك..."
          aria-disabled="true"
          className="h-10 min-h-[44px] min-w-0 flex-1 rounded-lg border border-[color:var(--wanas-game-panel-border)] bg-[color:var(--wanas-game-card)] px-3 text-xs text-[color:var(--wanas-game-text-primary)] opacity-60"
        />
        <Button type="submit" disabled className="min-h-[44px] shrink-0 px-3" aria-disabled="true" aria-label="إرسال">
          ➤
        </Button>
      </form>
    </aside>
  );
}
