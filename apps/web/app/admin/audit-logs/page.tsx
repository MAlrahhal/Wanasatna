import { Suspense } from 'react';
import { AdminAuditLogsClient } from '@/components/admin/admin-audit-logs-client';
import { AdminShell } from '@/components/admin/admin-shell-client';

export default function AdminAuditLogsPage() {
  return (
    <AdminShell>
      <Suspense fallback={<p className="text-wanas-text-muted text-sm">جاري التحميل…</p>}>
        <AdminAuditLogsClient />
      </Suspense>
    </AdminShell>
  );
}
