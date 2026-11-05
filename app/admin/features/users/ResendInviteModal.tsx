'use client';

import { useId, useState } from 'react';
import { Check, MailPlus, X } from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';
import { Dialog } from '@/components/ui/Dialog';
import { resendUserInvite } from '../../actions/admin';
import { InviteResultNotice } from './InviteResultNotice';
import type { AdminUser, InviteResult } from '@/types/admin';

export function ResendInviteModal({
  user,
  onClose,
  onResent,
}: {
  user: AdminUser;
  onClose: () => void;
  onResent: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [result, setResult] = useState<InviteResult | null>(null);
  const titleId = useId();

  const identity = user.name?.trim() || user.email || 'this user';

  // Closing after a successful resend refreshes the table, matching the
  // invite flow. Before success, closing must not trigger a refetch.
  const dismiss = () => {
    if (result) onResent();
    else onClose();
  };

  const handleResend = async () => {
    setSubmitting(true);
    setServerError(null);
    try {
      setResult(await resendUserInvite(user.id));
    } catch (err: unknown) {
      setServerError(
        err instanceof Error ? err.message : 'Failed to resend the invitation.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog isOpen onClose={dismiss} ariaLabelledBy={titleId} maxWidthClass="max-w-md">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
            {result ? (
              <Check className="h-5 w-5 text-success-text" />
            ) : (
              <MailPlus className="h-5 w-5 text-secondary" />
            )}
          </div>
          <div>
            <h2 id={titleId} className="text-base font-semibold text-primary">
              {result ? 'Invitation resent' : 'Resend invitation'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {result
                ? `A fresh setup link was generated for ${identity}.`
                : `Send a fresh setup link to ${identity}.`}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Close"
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-page hover:text-secondary"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {result ? (
        <div className="mt-5 space-y-4">
          <InviteResultNotice
            email={result.email}
            emailSent={result.emailSent}
            inviteLink={result.inviteLink}
          />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onResent}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-on-accent hover:bg-accent-hover"
            >
              Done
            </button>
          </div>
        </div>
      ) : (
        <>
          {serverError && (
            <div className="mt-4 rounded-lg bg-error-bg px-3 py-2 text-sm text-error-text">
              {serverError}
            </div>
          )}

          <p className="mt-4 text-sm text-secondary">
            This replaces the previous invitation link for{' '}
            <span className="font-semibold text-primary">
              {user.email ?? 'the address on file'}
            </span>
            . The old link will no longer work.
          </p>

          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-lg border border-default px-4 py-2 text-sm font-semibold text-secondary hover:bg-page disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleResend()}
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-on-accent hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting && <Spinner size="sm" />}
              {submitting ? 'Sending…' : 'Resend invitation'}
            </button>
          </div>
        </>
      )}
    </Dialog>
  );
}
