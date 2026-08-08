import type { Metadata } from 'next';
import { PremiumPageClient } from './premium-page-client';

export const metadata: Metadata = {
  title: 'بريميوم',
};

export default function PremiumPage() {
  return <PremiumPageClient />;
}
