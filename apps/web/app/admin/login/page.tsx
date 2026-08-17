import type { Metadata } from 'next';
import { AdminLoginClient } from '@/components/admin/admin-login-client';
import { ADMIN_COPY } from '@/lib/admin/copy';

export const metadata: Metadata = {
  title: ADMIN_COPY.loginTitle,
  robots: { index: false, follow: false },
};

export default function AdminLoginPage() {
  return <AdminLoginClient />;
}
