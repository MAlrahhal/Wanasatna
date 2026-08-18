import { AdminShell } from '@/components/admin/admin-shell-client';
import { AdminRoomsClient } from '@/components/admin/admin-rooms-client';

export default function AdminRoomsPage() {
  return (
    <AdminShell>
      <AdminRoomsClient />
    </AdminShell>
  );
}
