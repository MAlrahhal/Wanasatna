import { AdminExperimentalGamesClient } from '@/components/admin/admin-experimental-games-client';
import { AdminShell } from '@/components/admin/admin-shell-client';

export default function AdminExperimentalGamesPage() {
  return (
    <AdminShell>
      <AdminExperimentalGamesClient />
    </AdminShell>
  );
}
