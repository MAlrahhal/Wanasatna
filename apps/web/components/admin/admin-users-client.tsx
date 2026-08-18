'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { AdminUsersData } from '@wanasatna/shared';
import { fetchAdminUsers } from '@/lib/admin/api';
import { ADMIN_COPY, ADMIN_ROLE_LABEL } from '@/lib/admin/copy';
import { formatAdminDateTime } from '@/lib/admin/format';
import { adminUserPath } from '@/lib/admin/routes';

export function AdminUsersClient() {
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AdminUsersData | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchAdminUsers({ q: submittedQuery, page });
      if (!result.ok) {
        setError(true);
        return;
      }
      setData(result.data);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [page, submittedQuery]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div>
      <h1 className="text-2xl font-bold text-wanas-text-primary">{ADMIN_COPY.usersTitle}</h1>

      <form
        className="mt-6 flex flex-col gap-3 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          setPage(1);
          setSubmittedQuery(query.trim());
        }}
      >
        <label className="sr-only" htmlFor="admin-user-search">
          {ADMIN_COPY.searchLabel}
        </label>
        <input
          id="admin-user-search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
          }}
          placeholder={ADMIN_COPY.searchPlaceholder}
          className="h-11 flex-1 rounded-xl border border-wanas-border bg-wanas-surface px-3 text-sm"
        />
        <button
          type="submit"
          className="inline-flex h-11 items-center justify-center rounded-xl border border-wanas-border px-4 text-sm font-semibold"
        >
          {ADMIN_COPY.searchCta}
        </button>
      </form>

      {loading && !data ? (
        <p className="mt-8 text-sm text-wanas-text-muted">{ADMIN_COPY.resolving}</p>
      ) : null}

      {error && !data ? (
        <div className="mt-8 space-y-3 rounded-2xl border border-wanas-error-border bg-wanas-error-surface p-4">
          <p role="alert" className="text-sm font-semibold text-wanas-error">
            {ADMIN_COPY.loadFailed}
          </p>
          <button
            type="button"
            onClick={() => {
              void load();
            }}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-wanas-border bg-wanas-surface px-4 text-sm font-semibold"
          >
            {ADMIN_COPY.retry}
          </button>
        </div>
      ) : null}

      {data && data.users.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-wanas-border bg-wanas-surface px-4 py-6 text-sm text-wanas-text-muted">
          {ADMIN_COPY.emptyUsers}
        </p>
      ) : null}

      {data && data.users.length > 0 ? (
        <>
          <div className="mt-8 hidden overflow-x-auto rounded-2xl border border-wanas-border md:block">
            <table className="w-full min-w-[720px] text-right text-sm">
              <thead className="bg-wanas-surface-soft text-wanas-text-muted">
                <tr>
                  <th className="px-3 py-2 font-semibold">الاسم</th>
                  <th className="px-3 py-2 font-semibold">البريد</th>
                  <th className="px-3 py-2 font-semibold">الدور</th>
                  <th className="px-3 py-2 font-semibold">{ADMIN_COPY.matchCount}</th>
                  <th className="px-3 py-2 font-semibold">{ADMIN_COPY.lastMatch}</th>
                  <th className="px-3 py-2 font-semibold">{ADMIN_COPY.accountCreated}</th>
                </tr>
              </thead>
              <tbody>
                {data.users.map((user) => (
                  <tr key={user.id} className="border-t border-wanas-border">
                    <td className="px-3 py-2 font-semibold">
                      <Link
                        href={adminUserPath(user.id)}
                        className="underline decoration-wanas-border underline-offset-4 hover:text-wanas-accent"
                      >
                        {user.preferredDisplayName}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{user.email}</td>
                    <td className="px-3 py-2">{ADMIN_ROLE_LABEL[user.role] ?? user.role}</td>
                    <td className="px-3 py-2">{user.matchCount}</td>
                    <td className="px-3 py-2">
                      {user.lastMatchAt ? formatAdminDateTime(user.lastMatchAt) : '—'}
                    </td>
                    <td className="px-3 py-2">{formatAdminDateTime(user.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-8 space-y-3 md:hidden">
            {data.users.map((user) => (
              <Link
                key={user.id}
                href={adminUserPath(user.id)}
                className="block rounded-2xl border border-wanas-border bg-wanas-surface p-4 text-sm"
              >
                <p className="font-bold">{user.preferredDisplayName}</p>
                <p className="mt-1 text-wanas-text-secondary">{user.email}</p>
                <p className="mt-2 text-wanas-text-muted">
                  {ADMIN_ROLE_LABEL[user.role] ?? user.role} · {user.matchCount} {ADMIN_COPY.matchCount}
                </p>
              </Link>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm">
            <p className="text-wanas-text-muted">
              {ADMIN_COPY.pageLabel} {data.page} / {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => {
                  setPage((current) => Math.max(1, current - 1));
                }}
                className="inline-flex h-10 items-center rounded-xl border border-wanas-border px-3 disabled:opacity-40"
              >
                {ADMIN_COPY.previousPage}
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => {
                  setPage((current) => current + 1);
                }}
                className="inline-flex h-10 items-center rounded-xl border border-wanas-border px-3 disabled:opacity-40"
              >
                {ADMIN_COPY.nextPage}
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
