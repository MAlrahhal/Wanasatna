import { AdminRoomHistoryDetailClient } from '@/components/admin/admin-room-history-detail-client';
import { AdminShell } from '@/components/admin/admin-shell-client';

export default function AdminRoomHistoryDetailPage() {
  return (
    <AdminShell>
      <AdminRoomHistoryDetailClient />
    </AdminShell>
  );
}
