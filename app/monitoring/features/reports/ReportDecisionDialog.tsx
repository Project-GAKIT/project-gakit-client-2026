'use client';

import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useModalA11y } from '@/hooks/useModalA11y';
import { STATUS_META } from '@/lib/reports/reportFormatting';
import { DECISION_REASONS, DECISION_STATUSES, decisionStatus, type DecisionReason, type DecisionStatus } from '@/lib/reports/decisionReasons';
import type { Report } from '@/types/report';

export function ReportDecisionDialog({ report, isUpdating, onClose, onConfirm }: {
  report: Report;
  isUpdating: boolean;
  onClose: () => void;
  onConfirm: (status: DecisionStatus, reason: DecisionReason) => Promise<boolean>;
}) {
  const [status, setStatus] = useState<DecisionStatus>(decisionStatus(report.status));
  const [reasonCode, setReasonCode] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const id = useId();
  const busy = isUpdating || submitting;
  const unchangedHuman = report.decisionSource === 'manual' && status === decisionStatus(report.status)
    && !report.validationSummary?.reviewAvailable;
  const validReason = DECISION_REASONS[status].some(reason => reason.code === reasonCode);
  const selectedReason = DECISION_REASONS[status].find(reason => reason.code === reasonCode)?.label;
  const panelRef = useModalA11y<HTMLDivElement>({ enabled: true });
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) { event.preventDefault(); onClose(); }
    };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [busy, onClose]);
  return createPortal(
    <div className="fixed inset-0 z-[1500] flex items-center justify-center bg-contrast/40 p-3 backdrop-blur-xs"
      onClick={event => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} tabIndex={-1}
        className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-default bg-panel p-4 shadow-xl outline-none sm:p-5">
        <div className="mb-4 flex items-start justify-between gap-2">
          <div><h3 id={`${id}-title`} className="text-sm font-bold text-primary">Update report status</h3>
            <p className="mt-1 text-xs text-muted-foreground">Current status: {STATUS_META[report.status].label} · #{report.id.slice(0, 8)}</p></div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close status update dialog" className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={async event => {
          event.preventDefault();
          if (busy || !validReason || unchangedHuman) return;
          setSubmitting(true); setError('');
          try {
            if (await onConfirm(status, { reasonCode, note: note.trim() || undefined })) onClose();
            else setError('The status was not saved. Please try again.');
          } catch { setError('The status was not saved. Please try again.'); }
          finally { setSubmitting(false); }
        }} className="space-y-4">
          <div><label htmlFor={`${id}-status`} className="mb-1 block text-xs font-semibold text-secondary">New status <span aria-hidden="true">*</span></label>
            <select id={`${id}-status`} required value={status} disabled={busy}
              onChange={event => { setStatus(event.target.value as DecisionStatus); setReasonCode(''); setError(''); }}
              className="h-10 w-full rounded-lg border border-default bg-panel px-2.5 text-sm text-secondary outline-none focus:border-strong">
              {DECISION_STATUSES.map(value => <option key={value} value={value}>{STATUS_META[value].label}</option>)}
            </select>
          </div>
          <div><label htmlFor={`${id}-reason`} className="mb-1 block text-xs font-semibold text-secondary">Reason <span aria-hidden="true">*</span></label>
            <select id={`${id}-reason`} required value={reasonCode} disabled={busy} onChange={event => setReasonCode(event.target.value)}
              className="h-10 w-full rounded-lg border border-default bg-panel px-2.5 text-xs text-secondary outline-none focus:border-strong">
              <option value="" disabled>Select a reason</option>
              {DECISION_REASONS[status].map(reason => <option key={reason.code} value={reason.code}>{reason.label}</option>)}
            </select>
            {selectedReason && selectedReason.length > 50 && <p className="mt-2 text-xs leading-5 text-secondary">{selectedReason}</p>}
          </div>
          <p className="text-xs leading-5 text-secondary">{status === 'UNVERIFIED'
            ? 'Pending requires a staff decision. Automatic checks will not replace this staff decision.'
            : status === 'VERIFIED' ? 'Confirm that you checked the selected evidence. Validation accepts the report for operational use; it does not certify its reported depth.'
            : 'Record why this report cannot be accepted. Missing weather data alone is not evidence that a report is false.'}</p>
          <div><label htmlFor={`${id}-note`} className="mb-1 block text-xs font-semibold text-secondary">Staff note <span className="font-normal text-muted-foreground">(optional, staff only)</span></label>
            <textarea id={`${id}-note`} value={note} maxLength={1000} onChange={event => setNote(event.target.value)} disabled={busy} rows={2}
              placeholder="Add context or an evidence reference"
              className="w-full rounded-lg border border-default px-2.5 py-2 text-sm text-secondary outline-none focus:border-strong" />
          </div>
          <p className="text-[11px] leading-4 text-muted-foreground">Saving records your decision, selected reason and time in the report history. The selected reason is visible to the reporter.</p>
          {unchangedHuman && <p className="text-xs text-secondary">This staff decision is already saved. Choose a different status to change it.</p>}
          {error && <p role="alert" className="text-xs text-error-text">{error}</p>}
          <div className="flex justify-end gap-2 border-t border-default pt-3">
            <button type="button" onClick={onClose} disabled={busy} className="h-9 rounded-lg border border-default px-3 text-xs font-semibold text-secondary">Cancel</button>
            <button type="submit" disabled={!validReason || unchangedHuman || busy} className="min-h-9 rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-on-accent disabled:opacity-50">{busy ? 'Saving…' : 'Save status'}</button>
          </div>
        </form>
      </div>
    </div>, document.body,
  );
}
