'use client';

import { useId, useState } from 'react';
import { Shield, X } from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';
import { Dialog } from '@/components/ui/Dialog';
import { Switch } from '@/components/ui/Switch';
import { createRole, updateRole } from '../../actions/admin';
import type { RoleView } from '@/types/admin';

const MIN_ROLE_NAME_LENGTH = 2;
const MAX_ROLE_NAME_LENGTH = 50;
const SLUG_RE = /^[a-z0-9_]+$/;

export function RoleModal({
  role,
  onClose,
  onSaved,
}: {
  role?: RoleView | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEditing = Boolean(role);
  const [name, setName] = useState(role?.name ?? '');
  const [description, setDescription] = useState(role?.description ?? '');
  const [isActive, setIsActive] = useState(role?.isActive ?? true);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const titleId = useId();

  const trimmedName = name.trim().toLowerCase();
  const nameError = !trimmedName
    ? null
    : trimmedName.length < MIN_ROLE_NAME_LENGTH
    ? `Use at least ${MIN_ROLE_NAME_LENGTH} characters.`
    : trimmedName.length > MAX_ROLE_NAME_LENGTH
    ? `Use at most ${MAX_ROLE_NAME_LENGTH} characters.`
    : !SLUG_RE.test(trimmedName)
    ? 'Use lowercase letters, digits, and underscores only.'
    : null;
  const canSubmit = trimmedName.length > 0 && !nameError && !submitting;
  const membersBlockDeactivation = Boolean(role && role.memberCount > 0);

  const handleSubmit = async () => {
    setSubmitting(true);
    setServerError(null);
    try {
      if (isEditing && role) {
        await updateRole(role.id, {
          description: description.trim() || null,
          is_active: isActive,
        });
      } else {
        await createRole({
          name: trimmedName,
          description: description.trim() || null,
        });
      }
      onSaved();
    } catch (err: unknown) {
      setServerError(
        err instanceof Error ? err.message : 'Failed to save the role.'
      );
      setSubmitting(false);
    }
  };

  return (
    <Dialog isOpen onClose={onClose} ariaLabelledBy={titleId} maxWidthClass="max-w-md">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
              <Shield className="h-5 w-5 text-secondary" />
            </div>
            <div>
              <h2 id={titleId} className="text-base font-semibold text-primary">
                {isEditing ? 'Edit role' : 'Add a role'}
              </h2>
              <p className="text-sm text-muted-foreground">
                {isEditing
                  ? 'Update the description or activation state.'
                  : 'A role is an organizational label users can be assigned to.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-page hover:text-secondary"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 rounded-lg bg-info-bg px-3 py-2 text-xs text-info-text">
          Custom roles have the same access as staff, so users assigned this
          role can sign in to the monitoring and reports portals. Only the
          built-in <span className="font-semibold">admin</span> role unlocks the
          Administration portal.
        </div>

        {serverError && (
          <div className="mt-4 rounded-lg bg-error-bg px-3 py-2 text-sm text-error-text">
            {serverError}
          </div>
        )}

        <div className="mt-5 space-y-4">
          {!isEditing && (
            <label className="block">
              <span className="text-sm font-semibold text-secondary">Name</span>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. dispatcher"
                maxLength={MAX_ROLE_NAME_LENGTH}
                autoFocus
                className="mt-1.5 w-full rounded-lg border border-default bg-page px-3 py-2.5 font-mono text-sm text-secondary outline-none transition-colors placeholder:font-sans placeholder:text-muted-foreground focus:border-strong/40 focus:bg-panel focus:ring-2 focus:ring-focus/10"
              />
              {nameError && (
                <span className="mt-1 block text-xs text-error-text">{nameError}</span>
              )}
            </label>
          )}

          <label className="block">
            <span className="text-sm font-semibold text-secondary">Description</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Optional description of what this role is for."
              className="mt-1.5 w-full resize-none rounded-lg border border-default bg-page px-3 py-2.5 text-sm text-secondary outline-none transition-colors placeholder:text-muted-foreground focus:border-strong/40 focus:bg-panel focus:ring-2 focus:ring-focus/10"
            />
          </label>

          {isEditing && (
            <Switch
              checked={isActive}
              onChange={setIsActive}
              disabled={membersBlockDeactivation}
              label="Active role"
              description={
                membersBlockDeactivation
                  ? `Reassign the ${role?.memberCount} member${
                      role?.memberCount === 1 ? '' : 's'
                    } before deactivating this role.`
                  : "Inactive roles can't be assigned to new users."
              }
            />
          )}
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
            {submitting ? 'Saving…' : isEditing ? 'Save changes' : 'Create role'}
          </button>
        </div>
    </Dialog>
  );
}