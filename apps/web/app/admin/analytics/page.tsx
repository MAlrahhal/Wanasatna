import { AdminShell } from '@/components/admin/admin-shell-client';
import { AdminAnalyticsClient } from '@/components/admin/admin-analytics-client';

export default function AdminAnalyticsPage() {
  return (
    <AdminShell>
      <AdminAnalyticsClient />
    </AdminShell>
  );
}
