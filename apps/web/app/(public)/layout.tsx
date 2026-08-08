import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { PublicLayoutClient } from '@/components/public/public-layout-client';
import { BRAND_NAME_AR } from '@/lib/public/brand';

export const metadata: Metadata = {
  title: {
    default: BRAND_NAME_AR,
    template: `%s | ${BRAND_NAME_AR}`,
  },
  description: 'منصة ألعاب جماعية عربية — العب مع أصدقائك مباشرة من المتصفح بدون تسجيل.',
};

export default function PublicLayout({ children }: { children: ReactNode }) {
  return <PublicLayoutClient>{children}</PublicLayoutClient>;
}
