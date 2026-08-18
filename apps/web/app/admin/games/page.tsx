import { AdminShell } from '@/components/admin/admin-shell-client';
import { AdminGamesClient } from '@/components/admin/admin-games-client';

export default function AdminGamesPage() {
  return (
    <AdminShell>
      <AdminGamesClient />
    </AdminShell>
  );
}
