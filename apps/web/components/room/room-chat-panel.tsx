'use client';

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { MAX_ROOM_CHAT_CONTENT_LENGTH, type RoomChatMessage } from '@wanasatna/shared';
import { Button } from '@/components/ui/button';
import { useRoomChat } from '@/contexts/room-chat-context';
import { useRoom } from '@/contexts/room-context';
import { SYSTEM_COPY } from '@/lib/ui/system-copy';
import { cn } from '@/lib/utils';

type RoomChatPanelProps = {
  className?: string;
  variant?: 'lobby' | 'game';
};

const NEAR_BOTTOM_PX = 80;

function isOwnMessage(message: RoomChatMessage, playerId: string | undefined): boolean {
  return Boolean(playerId && message.playerId && message.playerId === playerId);
}

export function RoomChatPanel({ className, variant = 'lobby' }: RoomChatPanelProps) {
  const { player } = useRoom();
  const { messages, isLoading, isSending, loadError, sendError, reload, send } = useRoomChat();
  const [draft, setDraft] = useState('');
  const listRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef(true);
  const isGame = variant === 'game';

  useEffect(() => {
    const node = listRef.current;
    if (!node || !stickToBottomRef.current) {
      return;
    }
    node.scrollTop = node.scrollHeight;
  }, [messages]);

  function onScroll() {
    const node = listRef.current;
    if (!node) {
      return;
    }
    const distance = node.scrollHeight - node.scrollTop - node.clientHeight;
    stickToBottomRef.current = distance <= NEAR_BOTTOM_PX;
  }

  async function submit() {
    const content = draft;
    const sent = await send(content);
    if (sent) {
      setDraft('');
      stickToBottomRef.current = true;
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void submit();
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
  }

  return (
    <div
      dir="rtl"
      data-testid="room-chat"
      className={cn('flex min-h-0 flex-1 flex-col', className)}
    >
      <div
        ref={listRef}
        onScroll={onScroll}
        role="log"
        aria-label={SYSTEM_COPY.chatTitle}
        aria-live="off"
        className={cn(
          'min-h-0 flex-1 space-y-2 overflow-y-auto px-1',
          isGame ? 'text-[color:var(--wanas-game-text-primary)]' : 'text-wanas-text-primary',
        )}
      >
        {isLoading && messages.length === 0 ? (
          <p className={cn('py-6 text-center text-xs', isGame ? 'text-[color:var(--wanas-game-text-secondary)]' : 'text-wanas-text-muted')}>
            {SYSTEM_COPY.loading}
          </p>
        ) : null}
        {loadError ? (
          <div className="space-y-2 py-4 text-center">
            <p className="text-xs text-wanas-error">{loadError}</p>
            <Button type="button" size="sm" variant="outline" onClick={() => void reload()}>
              {SYSTEM_COPY.retry}
            </Button>
          </div>
        ) : null}
        {!isLoading && !loadError && messages.length === 0 ? (
          <p className={cn('py-6 text-center text-xs', isGame ? 'text-[color:var(--wanas-game-text-secondary)]' : 'text-wanas-text-muted')}>
            {SYSTEM_COPY.chatEmpty}
          </p>
        ) : null}
        {messages.map((message) => {
          const own = isOwnMessage(message, player?.id);
          return (
            <div
              key={message.id}
              className={cn('rounded-lg px-2.5 py-1.5 text-sm leading-6', own && 'bg-wanas-surface-soft')}
            >
              <p
                className={cn(
                  'text-[11px] font-semibold',
                  isGame ? 'text-[color:var(--wanas-game-text-secondary)]' : 'text-wanas-text-muted',
                )}
              >
                {message.senderName}
              </p>
              <p className="whitespace-pre-wrap break-words">{message.content}</p>
            </div>
          );
        })}
      </div>

      <form onSubmit={onSubmit} className="mt-2 flex items-end gap-2">
        <label className="sr-only" htmlFor={`room-chat-input-${variant}`}>
          {SYSTEM_COPY.chatPlaceholder}
        </label>
        <input
          id={`room-chat-input-${variant}`}
          dir="rtl"
          value={draft}
          maxLength={MAX_ROOM_CHAT_CONTENT_LENGTH}
          disabled={isSending}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={SYSTEM_COPY.chatPlaceholder}
          className={cn(
            'h-11 min-h-11 min-w-0 flex-1 rounded-[var(--wanas-radius-control)] border bg-wanas-surface-soft px-3 text-sm text-wanas-text-primary outline-none',
            'placeholder:text-wanas-text-muted focus:border-wanas-accent focus:ring-2 focus:ring-wanas-accent/25',
            isGame && 'border-[color:var(--wanas-game-panel-border)] bg-[color:var(--wanas-game-card)] text-[color:var(--wanas-game-text-primary)]',
          )}
        />
        <Button type="submit" size="sm" className="min-h-11 px-3" loading={isSending} disabled={isSending}>
          {SYSTEM_COPY.chatSend}
        </Button>
      </form>
      {sendError ? (
        <p role="alert" className="mt-1 text-xs text-wanas-error">
          {sendError}
        </p>
      ) : null}
    </div>
  );
}
