import { AdminShell } from '@/components/admin/admin-shell-client';
import { AdminSystemClient } from '@/components/admin/admin-system-client';

export default function AdminSystemPage() {
  return (
    <AdminShell>
      <AdminSystemClient />
    </AdminShell>
  );
}
