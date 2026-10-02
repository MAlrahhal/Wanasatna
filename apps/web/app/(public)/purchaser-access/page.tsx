import type { Metadata } from 'next';
import { PurchaserAccessClient } from './purchaser-access-client';

export const metadata: Metadata = {
  title: 'الدخول للمشترين',
  robots: { index: false, follow: false },
};

export default function PurchaserAccessPage() {
  return <PurchaserAccessClient />;
}
