import { AdminShell } from '@/components/admin/admin-shell-client';
import { AdminHistoryClient } from '@/components/admin/admin-history-client';

export default function AdminHistoryPage() {
  return (
    <AdminShell>
      <AdminHistoryClient />
    </AdminShell>
  );
}
