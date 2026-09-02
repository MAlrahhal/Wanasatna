import { Suspense } from 'react';
import { AdminShell } from '@/components/admin/admin-shell-client';
import { AdminSpectateClient } from '@/components/admin/admin-spectate-client';

export default function AdminRoomSpectatePage() {
  return (
    <AdminShell>
      <Suspense fallback={<p className="text-wanas-text-muted text-sm">جاري التحميل…</p>}>
        <AdminSpectateClient />
      </Suspense>
    </AdminShell>
  );
}
