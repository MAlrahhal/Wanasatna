'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { MAX_ROOM_CHAT_CONTENT_LENGTH, type RoomChatMessage } from '@wanasatna/shared';
import { Button } from '@/components/ui/button';
import { PlayerAvatar } from '@/components/player/player-avatar';
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
  const inputRef = useRef<HTMLInputElement | null>(null);
  const sendButtonRef = useRef<HTMLButtonElement | null>(null);
  const submittingRef = useRef(false);
  const restoreFocusRef = useRef(false);
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

  async function submit(restoreFocus: boolean) {
    if (submittingRef.current) {
      return;
    }

    const content = draft;
    submittingRef.current = true;
    restoreFocusRef.current = restoreFocus;

    const cancelFocusRestore = (event: PointerEvent) => {
      if (event.target instanceof Node && !inputRef.current?.contains(event.target)) {
        restoreFocusRef.current = false;
      }
    };
    document.addEventListener('pointerdown', cancelFocusRestore, true);

    try {
      const sent = await send(content);
      if (!sent) {
        return;
      }

      setDraft('');
      stickToBottomRef.current = true;
      if (restoreFocusRef.current) {
        window.requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
      }
    } finally {
      document.removeEventListener('pointerdown', cancelFocusRestore, true);
      submittingRef.current = false;
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    void submit(
      document.activeElement === inputRef.current || submitter === sendButtonRef.current,
    );
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
              className={cn('flex items-start gap-2 rounded-xl px-3 py-2 text-sm leading-6', own && 'bg-wanas-surface-soft')}
            >
              {message.playerId ? (
                <PlayerAvatar playerId={message.playerId} playerName={message.senderName} className="mt-0.5 size-8" sizes="32px" />
              ) : null}
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    'truncate text-[11px] font-semibold',
                    isGame ? 'text-[color:var(--wanas-game-text-secondary)]' : 'text-wanas-text-muted',
                  )}
                  title={message.senderName}
                >
                  {message.senderName}
                </p>
                <p className="mt-0.5 whitespace-pre-wrap break-words">{message.content}</p>
              </div>
            </div>
          );
        })}
      </div>

      <form onSubmit={onSubmit} className="mt-2 flex items-end gap-2">
        <label className="sr-only" htmlFor={`room-chat-input-${variant}`}>
          {SYSTEM_COPY.chatPlaceholder}
        </label>
        <input
          ref={inputRef}
          id={`room-chat-input-${variant}`}
          dir="rtl"
          value={draft}
          maxLength={MAX_ROOM_CHAT_CONTENT_LENGTH}
          readOnly={isSending}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={(event) => {
            if (submittingRef.current && event.relatedTarget !== sendButtonRef.current) {
              restoreFocusRef.current = false;
            }
          }}
          placeholder={SYSTEM_COPY.chatPlaceholder}
          className={cn(
            'h-11 min-h-11 min-w-0 flex-1 rounded-[var(--wanas-radius-control)] border bg-wanas-surface-soft px-3 text-base text-wanas-text-primary outline-none lg:text-sm',
            'placeholder:text-wanas-text-muted focus:border-wanas-accent focus:ring-2 focus:ring-wanas-accent/25',
            isGame && 'border-[color:var(--wanas-game-panel-border)] bg-[color:var(--wanas-game-card)] text-[color:var(--wanas-game-text-primary)]',
          )}
        />
        <Button
          ref={sendButtonRef}
          type="submit"
          size="sm"
          className="min-h-11 px-3"
          loading={isSending}
          disabled={isSending}
        >
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
