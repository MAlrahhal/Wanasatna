import type { Metadata } from 'next';
import { Suspense, type ReactNode } from 'react';
import { PublicLayoutClient } from '@/components/public/public-layout-client';
import { HOME_DESCRIPTION } from '@/lib/public/seo';

export const metadata: Metadata = {
  description: HOME_DESCRIPTION,
};

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense>
      <PublicLayoutClient>{children}</PublicLayoutClient>
    </Suspense>
  );
}
