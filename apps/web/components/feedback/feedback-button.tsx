'use client';

import { useCallback, useState } from 'react';
import type { FeedbackSource } from '@wanasatna/shared';
import { Button, type ButtonProps } from '@/components/ui/button';
import { useOptionalGameShell } from '@/contexts/game-shell-context';
import { useOptionalRoom } from '@/contexts/room-context';
import { cn } from '@/lib/utils';
import { FeedbackDialog } from './feedback-dialog';

type FeedbackButtonProps = {
  source: FeedbackSource;
  roomId?: string | null;
  gameId?: string | null;
  compact?: boolean;
  initialView?: 'choices' | 'form';
  className?: string;
  variant?: ButtonProps['variant'];
  size?: ButtonProps['size'];
  onOpen?: () => void;
  label?: string;
};

function FeedbackIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 6h14v10H9l-4 3V6Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M8 10h8M8 13h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function FeedbackButton({
  source,
  roomId,
  gameId,
  compact = false,
  initialView = 'choices',
  className,
  variant = 'secondary',
  size = 'sm',
  onOpen,
  label = 'ملاحظات',
}: FeedbackButtonProps) {
  const [open, setOpen] = useState(false);
  const closeDialog = useCallback(() => setOpen(false), []);
  const roomContext = useOptionalRoom();
  const shellContext = useOptionalGameShell();
  const resolvedRoomId = roomId ?? roomContext?.room?.id ?? null;
  const resolvedGameId = gameId ?? shellContext?.state?.gameId ?? null;

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={cn(compact && 'size-11 min-h-11 min-w-11 px-0', className)}
        aria-label={compact ? label : undefined}
        onClick={() => {
          onOpen?.();
          setOpen(true);
        }}
      >
        <FeedbackIcon />
        {compact ? <span className="sr-only">{label}</span> : label}
      </Button>
      {open ? (
        <FeedbackDialog
          open
          onClose={closeDialog}
          source={source}
          roomId={resolvedRoomId}
          gameId={resolvedGameId}
          initialView={initialView}
        />
      ) : null}
    </>
  );
}

export function FinalResultsFeedbackCta() {
  return (
    <FeedbackButton
      source="FINAL_RESULTS"
      initialView="form"
      variant="ghost"
      size="sm"
      label="عندك اقتراح يخلي وناستنا أفضل؟ أرسله لنا 💙"
      className="mx-auto h-auto min-h-11 max-w-full whitespace-normal px-3 py-2 text-center text-sm"
    />
  );
}
