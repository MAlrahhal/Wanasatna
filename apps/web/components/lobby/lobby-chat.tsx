'use client';

/**
 * Chat UI placeholder for Sprint 2.5.
 * Replace local state with socket-backed messages in the Chat sprint.
 */
import { useState } from 'react';
import { mockLobbyChatMessages } from '@/lib/lobby/mock-chat';
import { cn } from '@/lib/utils';

export function LobbyChat() {
  const [messages] = useState(mockLobbyChatMessages);
  const [draft, setDraft] = useState('');

  function handleSendMessage() {
    // Integration point: emit chat message via Socket.IO in a future sprint.
    setDraft('');
  }

  return (
    <section className="flex h-full min-h-[420px] flex-col rounded-2xl border border-border bg-card shadow-sm">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-base font-semibold text-foreground">الدردشة</h2>
        <p className="mt-1 text-xs text-muted-foreground">واجهة جاهزة — التكامل مع الخادم في Sprint لاحق.</p>
      </div>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
        {messages.map((message) => (
          <article
            key={message.id}
            className={cn(
              'rounded-xl px-3 py-2',
              message.isSystem ? 'bg-muted/50' : 'border border-border bg-background',
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
            placeholder="اكتب رسالة..."
            disabled
            className="h-10 flex-1 rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-60"
          />
          <button
            type="button"
            onClick={handleSendMessage}
            disabled
            className="inline-flex h-10 shrink-0 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground opacity-60"
          >
            إرسال
          </button>
        </div>
      </div>
    </section>
  );
}
