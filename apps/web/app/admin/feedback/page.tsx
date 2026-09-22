import { Suspense } from 'react';
import { AdminFeedbackClient } from '@/components/admin/admin-feedback-client';
import { AdminShell } from '@/components/admin/admin-shell-client';

export default function AdminFeedbackPage() {
  return (
    <AdminShell>
      <Suspense fallback={<p className="text-wanas-text-muted text-sm">جاري التحميل…</p>}>
        <AdminFeedbackClient />
      </Suspense>
    </AdminShell>
  );
}
