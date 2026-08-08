'use client';

import type { GamePluginPlaceholderProps } from '@wanasatna/shared';

export function GamePluginPlaceholder({ title, message }: GamePluginPlaceholderProps) {
  return (
    <section className="rounded-2xl border border-dashed border-border bg-muted/20 p-8 text-center">
      <p className="text-sm font-medium text-foreground">{title}</p>
      {message ? <p className="mt-2 text-sm text-muted-foreground">{message}</p> : null}
    </section>
  );
}
