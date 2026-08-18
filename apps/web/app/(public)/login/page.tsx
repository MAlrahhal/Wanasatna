import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'تسجيل الدخول',
  robots: { index: false, follow: false },
};

/** Isolated leftover public login — no public links. Admin uses /admin/login. */
export default function LoginPage() {
  redirect('/');
}
