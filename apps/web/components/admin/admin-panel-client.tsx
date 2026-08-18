'use client';

import { AdminDashboardClient } from '@/components/admin/admin-dashboard-client';
import { AdminShell } from '@/components/admin/admin-shell-client';
import { ADMIN_COPY } from '@/lib/admin/copy';

export function AdminPanelClient() {
  return (
    <AdminShell>
      <h1 className="text-2xl font-bold text-wanas-text-primary">{ADMIN_COPY.panelTitle}</h1>
      <AdminDashboardClient />
    </AdminShell>
  );
}
