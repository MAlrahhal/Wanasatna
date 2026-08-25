import type { Metadata } from 'next';
import { MarathonPageClient } from './marathon-page-client';

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function MarathonPage() {
  return <MarathonPageClient />;
}
