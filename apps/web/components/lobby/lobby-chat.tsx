'use client';

import { useState } from 'react';
import type { LobbyChatMessage } from '@/lib/lobby/types';
import { cn } from '@/lib/utils';

type LobbyChatProps = {
  initialMessages: LobbyChatMessage[];
};

export function LobbyChat({ initialMessages }: LobbyChatProps) {
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState('');

  function handleSendMessage() {
    const trimmed = draft.trim();

    if (!trimmed) {
      return;
    }

    setMessages((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        playerName: 'أنت',
        message: trimmed,
        createdAt: new Date().toLocaleTimeString('ar-SA', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      },
    ]);
    setDraft('');
  }

  return (
    <section className="flex h-full min-h-[420px] flex-col rounded-2xl border border-border bg-card shadow-sm">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-base font-semibold text-foreground">الدردشة</h2>
        <p className="mt-1 text-xs text-muted-foreground">واجهة تجريبية — بدون اتصال بالخادم.</p>
      </div>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
        {messages.map((message) => (
          <article
            key={message.id}
            className={cn(
              'rounded-xl px-3 py-2',
              message.isSystem ? 'bg-muted/50' : 'bg-background border border-border',
            )}
          >
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-foreground">{message.playerName}</span>
              <span className="text-[11px] text-muted-foreground">{message.createdAt}</span>
            </div>
            <p className="text-sm leading-6 text-foreground">{message.message}</p>
          </article>
        ))}
      </div>

      <div className="border-t border-border p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                handleSendMessage();
              }
            }}
            placeholder="اكتب رسالة..."
            className="h-10 flex-1 rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none ring-ring/50 placeholder:text-muted-foreground focus:ring-2"
          />
          <button
            type="button"
            onClick={handleSendMessage}
            className="inline-flex h-10 shrink-0 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            إرسال
          </button>
        </div>
      </div>
    </section>
  );
}
