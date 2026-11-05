'use client';

import { useId } from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';
import { Dialog } from './Dialog';

/** Shared failure presentation for recoverable features; callers own retry state. */
export function FailureModal({ isOpen, title = 'Temporarily unavailable', message, onClose, onRetry }: {
  isOpen: boolean;
  title?: string;
  message: string;
  onClose: () => void;
  onRetry?: () => void;
}) {
  const titleId = useId();
  return <Dialog isOpen={isOpen} onClose={onClose} ariaLabelledBy={titleId} maxWidthClass="max-w-sm">
    <div className="flex items-start gap-3">
      <span className="rounded-full bg-warning-bg p-2 text-warning-text"><AlertCircle className="h-5 w-5" aria-hidden="true" /></span>
      <div><h2 id={titleId} className="text-sm font-semibold text-primary">{title}</h2><p className="mt-1 text-sm leading-relaxed text-secondary">{message}</p></div>
    </div>
    <div className="mt-5 flex justify-end gap-2">
      <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-sm font-medium text-secondary hover:bg-muted">Close</button>
      {onRetry && <button type="button" onClick={onRetry} className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-on-accent hover:opacity-90"><RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />Try again</button>}
    </div>
  </Dialog>;
}
