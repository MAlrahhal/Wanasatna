import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { shouldBlockDevRoutes } from '@/lib/dev/dev-routes';

export const metadata: Metadata = {
  title: 'UI Playground',
  robots: { index: false, follow: false },
};

export default function DevLayout({ children }: { children: ReactNode }) {
  if (shouldBlockDevRoutes()) {
    notFound();
  }

  return children;
}
