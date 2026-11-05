'use client';

import { useState, type ReactNode } from 'react';
import { ArrowUpRight, Check, Clock3, MapPin, ShieldAlert, ShieldCheck, Waves } from 'lucide-react';
import type { DashboardSnapshot } from '@/types/dashboard';
import type { Report } from '@/types/report';
import { formatReportDepth, STATUS_META, timeAgo } from '@/lib/reports/reportFormatting';
import { INFLOW_STATUSES, inflowInterval, inflowSummary, manilaTime } from './operational';

export const PANEL_CLASS =
  'min-w-0 overflow-hidden rounded-xl border border-default bg-panel shadow-panel';

function PanelHeading({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-default px-4 py-2">
      <h2 className="text-sm font-bold text-primary">{title}</h2>
      {action}
    </div>
  );
}

const REASONS = {
  high_severity: 'High reported depth',
  older_review: 'Older observation · review backlog',
  conflicting_evidence: 'Conflicting evidence',
  needs_review: 'Awaiting evidence or review',
};

function PriorityReportRow({ report, snapshot, onOpen }: {
  report: DashboardSnapshot['priorityReports'][number];
  snapshot: DashboardSnapshot;
  onOpen: (report: Report) => void;
}) {
  const meta = STATUS_META[report.status];
  const older = report.priorityReason === 'older_review';
  return (
    <button type="button" onClick={() => onOpen(report)} className="group flex w-full items-center gap-3 px-4 py-1.5 text-left hover:bg-page">
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${older ? 'bg-hover' : report.priorityReason === 'high_severity' ? 'bg-red-500' : 'bg-violet-500'}`} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-semibold text-primary">{report.location.address || 'Unnamed report location'}</span>
        <span className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
          <span className="font-semibold text-secondary">{formatReportDepth(report.depth, report.depthCm)}</span>
          <span>{REASONS[report.priorityReason]}</span>
          <span title={manilaTime(report.observedAt, true)}>Observed {timeAgo(report.observedAt, Date.parse(snapshot.asOf))}</span>
        </span>
      </span>
      <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-semibold ${meta.badgeClass}`}>{meta.label}</span>
      <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
    </button>
  );
}

export function PriorityReports({ snapshot, onOpen, onBrowse }: {
  snapshot: DashboardSnapshot;
  onOpen: (report: Report) => void;
  onBrowse: (status: 'UNVERIFIED') => void;
}) {
  const start = Date.parse(snapshot.windowStart);
  const end = Date.parse(snapshot.asOf);
  // Also guard old snapshots while client and server updates roll out.
  const visible = snapshot.priorityReports.filter(report =>
    (report.status === 'UNVERIFIED' || report.status === 'ANOMALY') &&
    Date.parse(report.observedAt) >= start && Date.parse(report.observedAt) <= end).slice(0, 3);
  const older = (snapshot.olderReviewReports ?? snapshot.priorityReports.filter(report =>
    (report.status === 'UNVERIFIED' || report.status === 'ANOMALY') && Date.parse(report.observedAt) < start))
    .slice(0, 3);
  return (
    <section className={`${PANEL_CLASS} flex h-full flex-col`} aria-label="Priority reports">
      <PanelHeading title="Priority queue" action={<span className="text-[10px] text-muted-foreground">Observed in last 24h</span>} />
      <div className="flex-1 divide-y divide-default">
        {visible.length ? visible.map(report => <PriorityReportRow key={report.id} report={report} snapshot={snapshot} onOpen={onOpen} />)
          : <div className="flex items-center gap-3 px-4 py-5 text-xs text-muted-foreground"><Check className="h-5 w-5 text-muted-foreground" />No unresolved reports observed in the last 24 hours.</div>}
      </div>
      <details className="border-t border-default bg-page/50" aria-label="Older unresolved reports">
        <summary className="cursor-pointer px-4 py-2 text-xs font-semibold text-secondary">
          Older unresolved <span className="tabular-nums">({snapshot.totals.olderReviews})</span>
          <span className="ml-2 text-[10px] font-normal text-muted-foreground">Review backlog</span>
        </summary>
        <div className="px-4 pb-1">
          <span className="text-[10px] text-muted-foreground">Observed over 24h ago · review backlog</span>
        </div>
        <div className="divide-y divide-default">
          {older.map(report => <PriorityReportRow key={report.id} report={{ ...report, priorityReason: 'older_review' }} snapshot={snapshot} onOpen={onOpen} />)}
          {snapshot.totals.olderReviews === 0 && <p className="px-4 pb-2 text-[10px] text-muted-foreground">No older unresolved reports.</p>}
        </div>
      </details>
      <div className="border-t border-default px-4 py-2">
        <button type="button" onClick={() => onBrowse('UNVERIFIED')} className="text-[11px] font-semibold text-secondary">View all pending · All time ({snapshot.totals.pending})</button>
      </div>
    </section>
  );
}

export function WorkloadSummary({ snapshot, onReview }: { snapshot: DashboardSnapshot; onReview: () => void }) {
  const { totals } = snapshot;
  const metrics = [
    { label: 'High severity', detail: 'Observed in 24h', value: totals.highSeverity, icon: Waves, color: 'text-error-text' },
    { label: 'Recent pending', detail: 'Observed in 24h', value: totals.recentReviews ?? Math.max(0, totals.pending - totals.olderReviews), icon: Clock3, color: 'text-warning-text' },
    { label: 'Older pending', detail: 'Observed over 24h ago', value: totals.olderReviews, icon: Clock3, color: 'text-secondary' },
    { label: 'Evidence conflicts', detail: 'All unresolved · all dates', value: totals.flagged, icon: ShieldAlert, color: 'text-warning-text' },
    { label: 'Validated observations', detail: 'Observed in 24h', value: totals.verifiedObservations, icon: ShieldCheck, color: 'text-success-text' },
  ];
  return (
    <section className={`${PANEL_CLASS} flex h-full flex-col`} aria-label="Workload summary">
      <PanelHeading title="Workload summary" />
      <div className="flex-1 divide-y divide-default">
        {metrics.map((metric) => (
          <div key={metric.label} className="flex items-center gap-2.5 px-4 py-1.5">
            <metric.icon className={`h-3.5 w-3.5 shrink-0 ${metric.color}`} />
            <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="text-xs font-medium text-secondary">{metric.label}</span>
              <span className="text-[9px] text-muted-foreground">{metric.detail}</span>
            </span>
            <span className="text-lg font-bold leading-none text-primary tabular-nums">{metric.value.toLocaleString()}</span>
          </div>
        ))}
      </div>
      <div className="border-t border-default px-4 py-2">
        <button type="button" onClick={onReview} className="w-full rounded-md bg-accent px-3 py-1.5 text-[11px] font-semibold text-on-accent hover:bg-accent-hover">Open report management</button>
      </div>
    </section>
  );
}

export function ReportInflow({ snapshot, onBrowse }: { snapshot: DashboardSnapshot; onBrowse: () => void }) {
  const [selectedAt, setSelectedAt] = useState<string | null>(null);
  const rows = snapshot.hourly;
  const { delta, peak } = inflowSummary(snapshot);
  const selected = rows.find((row) => row.at === selectedAt) ?? rows.at(-1);
  const interval = selected ? inflowInterval(selected, snapshot) : null;
  const maximum = Math.max(2, ...rows.map((row) => row.count));
  const step = Math.max(1, Math.ceil(maximum / 3));
  const ceiling = step * 3;
  const ticks = [ceiling, step * 2, step, 0];
  const labels = [...new Set([0, Math.floor(rows.length / 3), Math.floor(rows.length * 2 / 3), rows.length - 1])];
  return (
    <section className={`${PANEL_CLASS} h-full`} aria-label="Report inflow">
      <PanelHeading title="Report Inflow" action={<button type="button" onClick={onBrowse} className="text-[10px] font-semibold text-secondary">View reports ↗</button>} />
      <div className="px-4 pb-3 pt-2.5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <div className="flex items-baseline gap-2">
            <strong className="text-2xl font-bold leading-none tracking-tight text-primary tabular-nums">{snapshot.totals.submissions.toLocaleString()}</strong>
            <span className="text-[10px] text-muted-foreground">received · last 24h</span>
            <span className="text-[10px] font-semibold text-secondary" title={`Previous 24 hours: ${snapshot.totals.previousSubmissions}`}>
              {delta > 0 ? '+' : ''}{delta} vs prior 24h
            </span>
          </div>
          <div className="text-[10px] text-muted-foreground">
            Last hour <b className="text-secondary">{snapshot.totals.lastHourSubmissions}</b>
            {peak && <> · Peak full hour <b className="text-secondary">{peak.count}</b> at {manilaTime(peak.at)}</>}
          </div>
        </div>
        <div className="flex h-20 gap-2" aria-label="Hourly submissions by current validation status">
          <div className="flex w-5 shrink-0 flex-col justify-between text-right text-[9px] leading-none text-muted-foreground" aria-hidden>
            {ticks.map((tick) => <span key={tick}>{tick}</span>)}
          </div>
          <div className="relative min-w-0 flex-1">
            <div className="pointer-events-none absolute inset-0 flex flex-col justify-between" aria-hidden>
              {ticks.map((tick) => <span key={tick} className="border-t border-default" />)}
            </div>
            <div className="absolute inset-0 flex items-end gap-1">
              {rows.map((hour) => {
                const bounds = inflowInterval(hour, snapshot);
                const description = `${manilaTime(bounds.start, true)}–${manilaTime(bounds.end)}${bounds.partial ? ' (partial)' : ''}: ${hour.count} received; ${INFLOW_STATUSES.map((status) => `${hour[status.key]} ${status.label.toLowerCase()}`).join(', ')}`;
                return (
                  <button type="button" key={hour.at} onClick={() => setSelectedAt(hour.at)}
                    onFocus={() => setSelectedAt(hour.at)} onMouseEnter={() => setSelectedAt(hour.at)}
                    aria-label={description} title={description} aria-pressed={selected?.at === hour.at}
                    className={`relative flex h-full min-w-0 flex-1 items-end rounded-t outline-offset-2 ${selected?.at === hour.at ? 'bg-muted' : 'hover:bg-page'}`}>
                    <span className={`flex w-full flex-col-reverse overflow-hidden rounded-t-sm ${bounds.partial ? 'opacity-60' : ''}`}
                      style={{ height: `${hour.count / ceiling * 100}%` }}>
                      {INFLOW_STATUSES.map((status) => <span key={status.key} style={{ background: status.color, height: `${hour.count ? hour[status.key] / hour.count * 100 : 0}%` }} />)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <div className="mb-2 ml-7 mt-1 flex justify-between text-[9px] text-muted-foreground" aria-hidden>
          {labels.map((index) => rows[index] && <span key={index}>{manilaTime(rows[index].at)}</span>)}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <div className="flex flex-wrap gap-x-2.5 gap-y-1">
            {INFLOW_STATUSES.map((status) => <span key={status.key} className="flex items-center gap-1 text-[9px] text-muted-foreground"><span className="h-1.5 w-1.5 rounded-sm" style={{ background: status.color }} />{status.label}</span>)}
          </div>
          <span className="text-[9px] text-muted-foreground">Current status · PHT · faded = partial hour</span>
        </div>
        <p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground" aria-live="polite">
          {selected && interval ? <><span className="font-semibold text-secondary">{manilaTime(interval.start)}–{manilaTime(interval.end)}{interval.partial ? ' (partial)' : ''}</span> · {selected.count} received · {selected.verified} validated, {selected.pending} pending, {selected.rejected} rejected ({selected.flagged} pending with conflicts)</> : 'No submissions in the selected period.'}
        </p>
      </div>
    </section>
  );
}

export function GeographicHighlights({ snapshot, kind, onBrowse }: {
  snapshot: DashboardSnapshot;
  kind: 'depth' | 'hotspots';
  onBrowse: () => void;
}) {
  const isDepth = kind === 'depth';
  const rows = [...snapshot.barangays].sort((a, b) => isDepth
    ? b.maxDepthCm - a.maxDepthCm || b.total - a.total || a.name.localeCompare(b.name)
    : b.total - a.total || b.maxDepthCm - a.maxDepthCm || a.name.localeCompare(b.name)).slice(0, 3);
  const Icon = isDepth ? Waves : MapPin;
  return (
    <section className={`${PANEL_CLASS} flex h-full flex-col`} aria-label={isDepth ? 'Peak flood depths' : 'Report hotspots'}>
      <PanelHeading title={isDepth ? 'Peak depths' : 'Report hotspots'} action={<Icon className="h-3.5 w-3.5 text-muted-foreground" />} />
      <div className="flex-1 divide-y divide-default px-4">
        {rows.length ? rows.map((area, index) => (
          <div key={area.id} className="flex items-center gap-2 py-2">
            <span className="text-[10px] font-semibold text-muted-foreground">{index + 1}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-semibold text-secondary">{area.name}</span>
              <span className="mt-0.5 block text-[9px] text-muted-foreground">{isDepth ? `Latest · ${manilaTime(area.latestObservedAt)}` : `${area.verified} validated · ${area.pending} to review`}</span>
            </span>
            <span className={`shrink-0 rounded px-1.5 py-1 text-[10px] font-bold tabular-nums ${isDepth && area.maxDepthCm >= 159 ? 'bg-error-bg text-error-text' : 'bg-muted text-secondary'}`}>{isDepth ? `${area.maxDepthCm} cm` : area.total}</span>
          </div>
        )) : <p className="py-8 text-xs text-muted-foreground">No recent observations matched a barangay.</p>}
      </div>
      <div className="border-t border-default px-4 py-2 text-[9px] leading-relaxed text-muted-foreground">
        Observed in 24h · rejected excluded.
        <div className="mt-1 flex items-center justify-between gap-1">
          <button type="button" onClick={onBrowse} className="text-[10px] font-semibold text-secondary">Browse reports ↗</button>
          {!isDepth && snapshot.totals.unlocated > 0 && <span title="Recent observations outside matched barangay boundaries">{snapshot.totals.unlocated} unmatched</span>}
        </div>
      </div>
    </section>
  );
}
