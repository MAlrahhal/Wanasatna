import { Suspense } from 'react';
import { AdminRoomHistoryClient } from '@/components/admin/admin-room-history-client';
import { AdminShell } from '@/components/admin/admin-shell-client';

export default function AdminRoomHistoryPage() {
  return (
    <AdminShell>
      <Suspense fallback={<p className="text-wanas-text-muted text-sm">جاري التحميل…</p>}>
        <AdminRoomHistoryClient />
      </Suspense>
    </AdminShell>
  );
}
