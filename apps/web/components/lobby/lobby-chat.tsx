'use client';

/**
 * Chat UI placeholder for Sprint 2.5.
 * Replace local state with socket-backed messages in the Chat sprint.
 */
import { useState } from 'react';
import { mockLobbyChatMessages } from '@/lib/lobby/mock-chat';
import { cn } from '@/lib/utils';
import { LobbyPanel } from './lobby-ui';

type LobbyChatProps = {
  className?: string;
};

export function LobbyChat({ className }: LobbyChatProps) {
  const [messages] = useState(mockLobbyChatMessages);
  const [draft, setDraft] = useState('');

  function handleSendMessage() {
    setDraft('');
  }

  return (
    <LobbyPanel
      title="دردشة الغرفة"
      description="محادثة دائمة مستقلة عن اللعب."
      className={cn('h-full max-h-[560px] xl:max-h-[calc(100vh-220px)] xl:min-h-[420px]', className)}
      bodyClassName="flex min-h-0 flex-1 flex-col gap-0 p-0"
    >
      <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-4 py-3">
        {messages.length === 0 ? (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-wanas-border bg-wanas-surface-soft px-3 py-6 text-center">
            <p className="text-xs font-medium text-wanas-text-muted">ابدأوا السالفة هنا.</p>
          </div>
        ) : (
          messages.map((message) => (
            <article
              key={message.id}
              className={cn(
                'rounded-lg px-1 py-1.5',
                message.isSystem && 'bg-wanas-accent/8 px-2',
              )}
            >
              <div className="mb-0.5 flex items-baseline justify-between gap-2">
                <span className="truncate text-xs font-bold text-wanas-text-primary">{message.playerName}</span>
                <time className="shrink-0 text-[10px] text-wanas-text-subtle">{message.createdAt}</time>
              </div>
              <p className="text-xs leading-5 text-wanas-text-secondary">{message.message}</p>
            </article>
          ))
        )}
      </div>

      <div className="border-t border-wanas-border px-3 py-3">
        <p className="mb-2 text-[10px] font-medium text-wanas-text-subtle">إرسال الرسائل سيتوفر قريباً.</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="اكتب رسالتك..."
            disabled
            aria-disabled="true"
            aria-label="اكتب رسالتك"
            className="h-10 min-h-[44px] flex-1 rounded-xl border border-wanas-border bg-wanas-surface-soft px-3 text-xs text-wanas-text-primary outline-none placeholder:text-wanas-text-subtle disabled:cursor-not-allowed disabled:opacity-60"
          />
          <button
            type="button"
            onClick={handleSendMessage}
            disabled
            aria-disabled="true"
            aria-label="إرسال الرسالة"
            className="inline-flex size-10 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full bg-wanas-accent text-sm text-[color:var(--wanas-background)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            ➤
          </button>
        </div>
      </div>
    </LobbyPanel>
  );
}
