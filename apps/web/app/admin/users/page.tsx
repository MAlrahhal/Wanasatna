import { AdminShell } from '@/components/admin/admin-shell-client';
import { AdminUsersClient } from '@/components/admin/admin-users-client';

export default function AdminUsersPage() {
  return (
    <AdminShell>
      <AdminUsersClient />
    </AdminShell>
  );
}
