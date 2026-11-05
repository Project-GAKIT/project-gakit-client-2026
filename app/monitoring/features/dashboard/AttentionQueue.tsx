'use client';

import { CheckCircle2, ShieldAlert } from 'lucide-react';
import { formatReportDepth, STATUS_META } from '@/lib/reports/reportFormatting';
import type { ReportStatus } from '@/types/report';
import type { QueueCounts, QueueGroup, QueueItem } from './aggregate';

interface AttentionQueueProps {
  items: QueueItem[];
  counts: QueueCounts;
  loading?: boolean;
  onReview: (reportId: string, status: ReportStatus) => void;
  onViewAll: (status: ReportStatus) => void;
}

const GROUP_ORDER_HINT: Record<QueueGroup, string> = {
  critical: 'High Severity · Immediate Action',
  flagged: 'Pending · Evidence conflict',
  pending: 'Pending · Awaiting Review',
};

const GROUP_ROW_BAR: Record<QueueGroup, string> = {
  critical: 'border-l-notice-border',
  flagged: 'border-l-warning-border',
  pending: 'border-l-default',
};

const GROUP_ICON: Record<QueueGroup, string> = {
  critical: 'text-notice-text',
  flagged: 'text-warning-text',
  pending: 'text-muted-foreground',
};

const QUEUE_LIMIT = 5;

export function AttentionQueue({
  items,
  counts,
  loading = false,
  onReview,
  onViewAll,
}: AttentionQueueProps) {
  const visible = items.slice(0, QUEUE_LIMIT);
  const remaining = items.length - visible.length;
  const total = items.length;

  return (
    <div className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-default bg-panel shadow-panel">
      <div className="flex flex-col gap-2 border-b border-default px-4 py-3 sm:px-5 sm:py-3.5 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-sm font-bold text-primary sm:text-base">Priority Triage Queue</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Citizen flood reports requiring verification or triage.
          </p>
        </div>
        {total > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {counts.critical > 0 && (
              <CountChip label={`${counts.critical} critical`} className="bg-notice-bg text-notice-text border-notice-border" />
            )}
            {counts.flagged > 0 && (
              <CountChip label={`${counts.flagged} flagged`} className="bg-warning-bg text-warning-text border-warning-border" />
            )}
            {counts.pending > 0 && (
              <CountChip label={`${counts.pending} pending`} className="bg-muted text-secondary border-default" />
            )}
          </div>
        ) : null}
      </div>

      {loading ? (
        <div className="divide-y divide-default">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="flex items-center justify-between px-4 py-2.5 sm:px-5 sm:py-3">
              <div className="space-y-1.5">
                <div className="h-3.5 w-36 animate-pulse rounded bg-muted" />
                <div className="h-3 w-24 animate-pulse rounded bg-muted" />
              </div>
              <div className="h-7 w-14 animate-pulse rounded-lg bg-muted" />
            </div>
          ))}
        </div>
      ) : total === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-10 text-center">
          <CheckCircle2 className="h-8 w-8 text-hazard-safe" />
          <p className="text-sm font-semibold text-primary">Queue Clear · All Reports Processed</p>
          <p className="text-xs text-muted-foreground">New citizen flood reports will appear here as they are received.</p>
        </div>
      ) : (
        <div className="divide-y divide-default">
          {visible.map(({ report, group, ageLabel }) => {
            const meta = STATUS_META[report.status];
            return (
              <div key={report.id} className={`flex items-start gap-3 border-l-[3px] bg-panel px-4 py-2.5 sm:px-5 sm:py-3 ${GROUP_ROW_BAR[group]}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
                    <span className={`text-xs font-semibold sm:text-sm ${GROUP_ICON[group]}`}>
                      {report.location.address || 'Unknown location'}
                    </span>
                    <span className="text-[11px] text-muted-foreground sm:text-xs sm:text-muted-foreground">{ageLabel}</span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-secondary">
                    <span className="font-semibold">
                      {formatReportDepth(report.depth, report.depthCm)}
                    </span>
                    <span className="hidden text-muted-foreground sm:inline">·</span>
                    <span className="text-[11px] text-muted-foreground sm:text-xs sm:text-muted-foreground">{GROUP_ORDER_HINT[group]}</span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className={`hidden rounded-full border px-2 py-0.5 text-[11px] font-semibold sm:inline-flex ${meta.badgeClass}`}>
                    {meta.label}
                  </span>
                  <button
                    type="button"
                    onClick={() => onReview(report.id, report.status)}
                    className="rounded-lg bg-accent px-2.5 py-1.5 text-xs font-semibold text-on-accent transition-colors hover:bg-accent-hover"
                  >
                    Review
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {total > 0 && (
        <div className="flex flex-col gap-2 border-t border-default bg-page/50 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-3">
          {remaining > 0 ? (
            <p className="text-xs text-muted-foreground">
              {remaining} additional report{remaining === 1 ? '' : 's'} awaiting review in Report Management.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              {total} report{total === 1 ? '' : 's'} awaiting operational triage.
            </p>
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onViewAll('UNVERIFIED')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-default bg-panel px-2.5 py-1.5 text-xs font-semibold text-secondary transition-colors hover:border-strong hover:text-primary"
            >
              <ShieldAlert className="h-3.5 w-3.5" />
              View pending
            </button>

          </div>
        </div>
      )}
    </div>
  );
}

function CountChip({ label, className }: { label: string; className: string }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold ${className}`}>
      {label}
    </span>
  );
}