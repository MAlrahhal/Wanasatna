import { AdminShell } from '@/components/admin/admin-shell-client';
import { AdminRoomDetailClient } from '@/components/admin/admin-room-detail-client';

export default function AdminRoomDetailPage() {
  return (
    <AdminShell>
      <AdminRoomDetailClient />
    </AdminShell>
  );
}
