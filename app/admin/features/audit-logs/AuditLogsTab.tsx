'use client';

import { useEffect, useRef, useState } from 'react';
import { RotateCcw, Search } from 'lucide-react';
import { FeaturePageShell } from '@/components/FeaturePageShell';
import { AdminPagination } from '../shared/AdminPagination';
import {
  AUDIT_ACTION_OPTIONS,
  auditActionMeta,
  formatJsonDetails,
  shortenId,
} from '../shared/adminFormatting';
import { listAuditLogs } from '../../actions/admin';
import type { AuditLogEntry } from '@/types/admin';
import { formatDateTime } from '@/lib/reports/reportFormatting';

const LOGS_PER_PAGE = 15;

export function AuditLogsTab({ active = true }: { active?: boolean }) {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState('all');
  const [actorEmail, setActorEmail] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const requestSeqRef = useRef(0);

  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => {
      const seq = requestSeqRef.current + 1;
      requestSeqRef.current = seq;
      setLoading(true);
      setError(null);

      void listAuditLogs({
        page: currentPage,
        limit: LOGS_PER_PAGE,
        action: action === 'all' ? undefined : action,
        actor_email: actorEmail.trim() || undefined,
        from_date: fromDate ? `${fromDate}T00:00:00Z` : undefined,
        to_date: toDate ? `${toDate}T23:59:59Z` : undefined,
      })
        .then((result) => {
          if (seq !== requestSeqRef.current) return;
          setLogs(result.items);
          setTotal(result.total);
          setTotalPages(Math.max(1, result.totalPages));
        })
        .catch((err: unknown) => {
          if (seq !== requestSeqRef.current) return;
          setError(
            err instanceof Error ? err.message : 'Failed to load audit logs'
          );
          setLogs([]);
          setTotal(0);
          setTotalPages(1);
        })
        .finally(() => {
          if (seq === requestSeqRef.current) setLoading(false);
        });
    }, 300);

    return () => clearTimeout(timer);
  }, [active, currentPage, action, actorEmail, fromDate, toDate]);

  const canReset =
    action !== 'all' ||
    actorEmail.trim() !== '' ||
    fromDate !== '' ||
    toDate !== '';

  const resetFilters = () => {
    setAction('all');
    setActorEmail('');
    setFromDate('');
    setToDate('');
    setCurrentPage(1);
  };

  return (
    <FeaturePageShell
      bare
      toolbar={
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(14rem,1fr)_12rem_10rem_10rem_auto]">
          <label className="flex items-center gap-2 rounded-lg border border-default bg-page px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={actorEmail}
              onChange={(event) => {
                setActorEmail(event.target.value);
                setCurrentPage(1);
              }}
              placeholder="Filter by actor email"
              aria-label="Filter audit logs by actor email"
              className="w-full bg-transparent text-sm outline-none text-secondary placeholder:text-muted-foreground"
            />
          </label>
          <select
            value={action}
            onChange={(event) => {
              setAction(event.target.value);
              setCurrentPage(1);
            }}
            aria-label="Filter by action"
            className="rounded-lg border border-default bg-page px-3 py-2 text-sm text-secondary outline-none focus:border-strong/40 focus:bg-panel"
          >
            <option value="all">All actions</option>
            {AUDIT_ACTION_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {auditActionMeta(value).label}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 rounded-lg border border-default bg-page px-3 py-2">
            <span className="text-xs font-semibold text-muted-foreground">From</span>
            <input
              type="date"
              value={fromDate}
              onChange={(event) => {
                setFromDate(event.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-transparent text-sm text-secondary outline-none"
            />
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-default bg-page px-3 py-2">
            <span className="text-xs font-semibold text-muted-foreground">To</span>
            <input
              type="date"
              value={toDate}
              onChange={(event) => {
                setToDate(event.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-transparent text-sm text-secondary outline-none"
            />
          </label>
          <button
            type="button"
            onClick={resetFilters}
            disabled={!canReset}
            className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
              canReset
                ? 'border-default bg-panel text-secondary hover:bg-page hover:border-default cursor-pointer'
                : 'border-default/60 bg-page/60 text-muted-foreground cursor-not-allowed opacity-60'
            }`}
          >
            <RotateCcw
              className={`h-4 w-4 transition-colors ${
                canReset ? 'text-secondary' : 'text-muted-foreground'
              }`}
            />
            Reset
          </button>
        </div>
      }
    >
      <div
        aria-busy={loading}
        className="overflow-hidden rounded-2xl border border-default bg-panel shadow-sm"
      >
        {error ? (
          <div className="p-6 text-sm text-error-text">{error}</div>
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full text-sm">
                <thead className="bg-page text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-5 py-3 text-left font-semibold">Time</th>
                    <th scope="col" className="px-5 py-3 text-left font-semibold">Action</th>
                    <th scope="col" className="px-5 py-3 text-left font-semibold">Actor</th>
                    <th scope="col" className="px-5 py-3 text-left font-semibold">Resource</th>
                    <th scope="col" className="px-5 py-3 text-left font-semibold">Details</th>
                    <th scope="col" className="px-5 py-3 text-left font-semibold">IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-default">
                  {logs.map((log) => {
                    const meta = auditActionMeta(log.action);
                    const detailsText = formatJsonDetails(log.details);
                    return (
                      <tr key={log.id} className="hover:bg-page/70">
                        <td className="whitespace-nowrap px-5 py-3.5 text-secondary">
                          {formatDateTime(log.createdAt)}
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${meta.className}`}
                          >
                            {meta.label}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="text-primary">
                            {log.actorEmail ?? 'System'}
                          </div>
                          <div className="font-mono text-xs text-muted-foreground">
                            {shortenId(log.actorUserId)}
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            {log.resourceType}
                          </div>
                          <div className="font-mono text-xs text-muted-foreground">
                            {shortenId(log.resourceId)}
                          </div>
                        </td>
                        <td className="max-w-[16rem] px-5 py-3.5 text-xs text-secondary">
                          {detailsText ? (
                            <details className="group">
                              <summary
                                className="cursor-pointer list-none [&::-webkit-details-marker]:hidden"
                                title={detailsText}
                              >
                                <span className="block truncate group-open:whitespace-normal group-open:break-words">
                                  {detailsText}
                                </span>
                                <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-wide text-secondary group-open:hidden">
                                  Show more
                                </span>
                              </summary>
                              <pre className="mt-2 whitespace-pre-wrap break-words font-sans">
                                {detailsText}
                              </pre>
                            </details>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 font-mono text-xs text-muted-foreground">
                          {log.ipAddress ?? '—'}
                        </td>
                      </tr>
                    );
                  })}
                  {logs.length === 0 && !loading && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-5 py-10 text-center text-sm text-muted-foreground"
                      >
                        No audit entries match the current filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-default lg:hidden">
              {logs.map((log) => {
                const meta = auditActionMeta(log.action);
                const detailsText = formatJsonDetails(log.details);
                return (
                  <div key={log.id} className="space-y-1.5 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${meta.className}`}
                      >
                        {meta.label}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDateTime(log.createdAt)}
                      </span>
                    </div>
                    <div className="text-sm font-semibold text-primary">
                      {log.actorEmail ?? 'System'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {log.resourceType}
                      {log.resourceId ? ` · ${shortenId(log.resourceId)}` : ''}
                      {log.ipAddress ? ` · ${log.ipAddress}` : ''}
                    </div>
                    {detailsText && (
                      <details className="text-xs text-secondary">
                        <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                          <span className="line-clamp-2">{detailsText}</span>
                          <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-wide text-secondary">
                            Show more
                          </span>
                        </summary>
                        <pre className="mt-2 whitespace-pre-wrap break-words font-sans">
                          {detailsText}
                        </pre>
                      </details>
                    )}
                  </div>
                );
              })}
              {logs.length === 0 && !loading && (
                <div className="px-5 py-10 text-center text-sm text-muted-foreground">
                  No audit entries match the current filters.
                </div>
              )}
            </div>

            <AdminPagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={total}
              pageSize={LOGS_PER_PAGE}
              itemLabel="entries"
              onPageChange={setCurrentPage}
            />
          </>
        )}
      </div>
    </FeaturePageShell>
  );
}