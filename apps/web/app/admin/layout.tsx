import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ADMIN_COPY } from '@/lib/admin/copy';

export const metadata: Metadata = {
  title: ADMIN_COPY.panelTitle,
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <div className="flex min-h-full flex-1 flex-col bg-wanas-bg">{children}</div>;
}
