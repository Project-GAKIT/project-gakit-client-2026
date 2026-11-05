import { Archive } from 'lucide-react';
import type { Notification } from '@/lib/notifications';

interface DismissAlertModalProps {
  notification: Notification | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DismissAlertModal({
  notification,
  onClose,
  onConfirm,
}: DismissAlertModalProps) {
  if (!notification) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="dismiss-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-contrast/40 p-4 backdrop-blur-xs"
    >
      <div className="w-full max-w-sm rounded-xl bg-panel p-6 shadow-xl ring-1 ring-strong/5">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-secondary">
          <Archive className="h-5 w-5" />
        </div>
        <h3 id="dismiss-dialog-title" className="mt-3 text-base font-bold text-primary">
          Archive notification?
        </h3>
        <p className="mt-2 text-sm text-secondary">
          Archive &ldquo;{notification.title}&rdquo;? You can restore it from the Archived tab.
        </p>
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-default px-4 py-2.5 text-sm font-semibold text-secondary hover:bg-page"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-on-accent hover:brightness-110"
          >
            Archive
          </button>
        </div>
      </div>
    </div>
  );
}
