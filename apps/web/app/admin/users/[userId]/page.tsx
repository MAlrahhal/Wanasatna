import { AdminShell } from '@/components/admin/admin-shell-client';
import { AdminUserDetailClient } from '@/components/admin/admin-user-detail-client';

export default function AdminUserDetailPage() {
  return (
    <AdminShell>
      <AdminUserDetailClient />
    </AdminShell>
  );
}
