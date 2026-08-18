import { AdminShell } from '@/components/admin/admin-shell-client';
import { AdminMatchDetailClient } from '@/components/admin/admin-match-detail-client';

export default function AdminMatchDetailPage() {
  return (
    <AdminShell>
      <AdminMatchDetailClient />
    </AdminShell>
  );
}
