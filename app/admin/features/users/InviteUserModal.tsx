'use client';

import { useId, useState } from 'react';
import { Check, Mail, X } from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';
import { Dialog } from '@/components/ui/Dialog';
import { inviteUser } from '../../actions/admin';
import { InviteResultNotice } from './InviteResultNotice';
import type { InviteResult, RoleView } from '@/types/admin';

export function InviteUserModal({
  roles,
  onClose,
  onInvited,
}: {
  roles: RoleView[];
  onClose: () => void;
  onInvited: () => void;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [result, setResult] = useState<InviteResult | null>(null);
  const titleId = useId();

  const canSubmit =
    name.trim() !== '' && email.trim() !== '' && role !== '' && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setServerError(null);
    try {
      const invite = await inviteUser({
        email: email.trim(),
        name: name.trim(),
        role,
      });
      setResult(invite);
    } catch (err: unknown) {
      setServerError(
        err instanceof Error ? err.message : 'Failed to send the invitation.'
      );
      setSubmitting(false);
    }
  };

  // Before a successful invite, dismissing must not trigger a refetch (Cancel
  // and the close button share behaviour). After success, dismissing refreshes
  // the list so the new member appears, matching the "Done" button.
  const dismiss = () => {
    if (result) onInvited();
    else onClose();
  };

  return (
    <Dialog isOpen onClose={dismiss} ariaLabelledBy={titleId} maxWidthClass="max-w-md">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
              {result ? (
                <Check className="h-5 w-5 text-success-text" />
              ) : (
                <Mail className="h-5 w-5 text-secondary" />
              )}
            </div>
            <div>
              <h2 id={titleId} className="text-base font-semibold text-primary">
                {result ? 'Invitation sent' : 'Invite a user'}
              </h2>
              <p className="text-sm text-muted-foreground">
                {result
                  ? `An invitation was created for ${result.name?.trim() || result.email || 'the user'}.`
                  : 'An invitation email will be sent to the address below.'}
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
                onClick={onInvited}
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

            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="text-sm font-semibold text-secondary">Name</span>
                <input
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. Juan Dela Cruz"
                  maxLength={120}
                  autoFocus
                  className="mt-1.5 w-full rounded-lg border border-default bg-page px-3 py-2.5 text-sm text-secondary outline-none transition-colors placeholder:text-muted-foreground focus:border-strong/40 focus:bg-panel focus:ring-2 focus:ring-focus/10"
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-secondary">Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@organization.gov.ph"
                  className="mt-1.5 w-full rounded-lg border border-default bg-page px-3 py-2.5 text-sm text-secondary outline-none transition-colors placeholder:text-muted-foreground focus:border-strong/40 focus:bg-panel focus:ring-2 focus:ring-focus/10"
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-secondary">Role</span>
                <select
                  value={role}
                  onChange={(event) => setRole(event.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-default bg-page px-3 py-2.5 text-sm text-secondary outline-none transition-colors focus:border-strong/40 focus:bg-panel focus:ring-2 focus:ring-focus/10"
                >
                  <option value="">Select a role…</option>
                  {roles
                    .filter((item) => item.isActive)
                    .map((item) => (
                      <option key={item.id} value={item.name}>
                        {item.name}
                      </option>
                    ))}
                </select>
              </label>

              <p className="text-xs text-muted-foreground">
                The user&apos;s name is shown in User Management. Custom roles
                have the same access as staff; only the built-in{' '}
                <span className="font-semibold">admin</span> role unlocks the
                Administration portal.
              </p>
            </div>

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
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-on-accent hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting && <Spinner size="sm" />}
                {submitting ? 'Sending…' : 'Send invitation'}
              </button>
            </div>
          </>
        )}
    </Dialog>
  );
}
