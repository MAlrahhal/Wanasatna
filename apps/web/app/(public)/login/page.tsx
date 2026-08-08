import type { Metadata } from 'next';
import { LoginPageClient } from './login-page-client';

export const metadata: Metadata = {
  title: 'تسجيل الدخول',
};

export default function LoginPage() {
  return <LoginPageClient />;
}
